"""
Per-site network topology graph derived from coordinator data.

This module is pure: it performs no I/O and imports nothing from Home
Assistant or the rest of the integration, so the graph logic is unit-testable
in isolation and cheap enough to run on every coordinator update.
(``coordinators/config.py`` imports ``normalize_mac`` from here, so importing
``.entity`` or ``.coordinators`` would create an import cycle.)

Relationship sources, verified against real hardware:

* Device -> parent device comes from the classic ``/stat/device`` ``uplink``
  block, which the device coordinator copies onto each device as
  ``device["topology"]``. The v1 API leaves ``uplink`` and ``type`` null on
  current firmware, so they are only fallbacks.
* Client -> device comes from the v1 client ``uplinkDeviceId``.

The coordinator only holds clients the controller currently reports, so
offline clients never appear in the graph.

The snapshot is an allowlisted contract for the frontend: MAC addresses, IP
addresses, hostnames, firmware and traffic counters are never emitted, and
MAC-shaped identifiers are replaced by opaque hashes.
"""

from __future__ import annotations

import hashlib
import json
import re
from typing import TYPE_CHECKING, Any, Final, Literal, NotRequired, TypedDict

if TYPE_CHECKING:
    from collections.abc import Mapping

TOPOLOGY_SCHEMA_VERSION: Final = 1
# Hard server-side cap on client nodes per site; requests may ask for fewer.
MAX_CLIENTS_PER_SITE: Final = 500

NodeKind = Literal["gateway", "switch", "access_point", "client", "other"]
NodeState = Literal["online", "offline", "unknown"]
LinkMedium = Literal["wired", "wireless", "unknown"]
ClientConnection = Literal["wired", "wireless"]
TopologyStatus = Literal["ok", "partial", "unavailable"]
IssueSeverity = Literal["info", "warning", "error"]
UnresolvedReason = Literal["parent_not_found", "no_uplink_data"]


class TopologyNode(TypedDict):
    """A device or client in the graph."""

    id: str
    kind: NodeKind
    name: str
    state: NodeState
    model: NotRequired[str]
    ha_device_id: NotRequired[str]
    connection: NotRequired[ClientConnection]


class TopologyEdge(TypedDict):
    """A child -> parent link."""

    source: str
    target: str
    medium: LinkMedium
    speed_mbps: NotRequired[int]
    parent_port: NotRequired[int]
    child_port: NotRequired[int]
    poe_power_w: NotRequired[float]


class TopologyIssue(TypedDict):
    """A machine-readable problem with the snapshot."""

    code: str
    severity: IssueSeverity


class TopologyUnresolved(TypedDict):
    """A node whose parent could not be placed in the graph."""

    node_id: str
    reason: UnresolvedReason


class TopologyTruncation(TypedDict):
    """How many clients were left out by the client cap."""

    clients_total: int
    clients_included: int


class SiteTopology(TypedDict):
    """One site's topology snapshot (contract version 1)."""

    schema_version: int
    entry_id: str
    site_id: str
    site_name: str
    revision: str
    status: TopologyStatus
    issues: list[TopologyIssue]
    nodes: list[TopologyNode]
    edges: list[TopologyEdge]
    unresolved: list[TopologyUnresolved]
    truncation: TopologyTruncation | None


_GATEWAY_LEGACY_TYPES: Final = frozenset({"udm", "uxg", "ugw", "udr", "ucg"})
_ONLINE_STATES: Final = frozenset({"ONLINE", "CONNECTED", "UP"})
_OFFLINE_STATES: Final = frozenset({"OFFLINE", "DISCONNECTED", "DOWN"})
_MAC_RE: Final = re.compile(r"[0-9a-f]{2}(?:[:-]?[0-9a-f]{2}){5}")


def _field(data: Mapping[str, Any], *keys: str) -> Any:
    """Return the first non-None value among ``keys`` (get_field semantics)."""
    for key in keys:
        value = data.get(key)
        if value is not None:
            return value
    return None


def normalize_mac(value: Any) -> str | None:
    """Return ``value`` as a lower-case colon MAC, or None if it is not one."""
    if not isinstance(value, str):
        return None
    candidate = value.strip().lower()
    if not _MAC_RE.fullmatch(candidate):
        return None
    digits = candidate.replace(":", "").replace("-", "")
    return ":".join(digits[index : index + 2] for index in range(0, 12, 2))


def opaque_node_id(prefix: str, entry_id: str, raw_id: str) -> str:
    """Return a node id that never exposes a MAC address."""
    mac = normalize_mac(raw_id)
    if mac is None:
        return f"{prefix}:{raw_id}"
    digest = hashlib.sha256(f"{entry_id}:{mac}".encode()).hexdigest()[:16]
    return f"{prefix}:h{digest}"


def device_kind(device: Mapping[str, Any]) -> NodeKind:
    """Classify a device: legacy type, then v1 type, then features."""
    topology = device.get("topology")
    legacy_type = topology.get("legacy_type") if isinstance(topology, dict) else None
    if isinstance(legacy_type, str):
        lowered = legacy_type.lower()
        if lowered in _GATEWAY_LEGACY_TYPES:
            return "gateway"
        if lowered == "usw":
            return "switch"
        if lowered == "uap":
            return "access_point"

    v1_type = device.get("type")
    if isinstance(v1_type, str):
        lowered = v1_type.lower()
        if "gateway" in lowered:
            return "gateway"
        if "switch" in lowered:
            return "switch"
        if "access" in lowered or lowered in {"ap", "uap"}:
            return "access_point"

    features = device.get("features")
    if isinstance(features, list):
        if "accessPoint" in features:
            return "access_point"
        if "switching" in features:
            return "switch"
    return "other"


def device_state(device: Mapping[str, Any]) -> NodeState:
    """Map a device state string onto online/offline/unknown."""
    raw = _field(device, "state", "status")
    if isinstance(raw, str):
        upper = raw.upper()
        if upper in _ONLINE_STATES:
            return "online"
        if upper in _OFFLINE_STATES:
            return "offline"
    return "unknown"


def site_display_name(data: Mapping[str, Any], site_id: str) -> str:
    """Return a site's display name, falling back to its id."""
    sites = data.get("sites")
    site = sites.get(site_id) if isinstance(sites, dict) else None
    if isinstance(site, dict):
        for key in ("name", "desc"):
            value = site.get(key)
            if isinstance(value, str) and value:
                return value
    return site_id


_KIND_ORDER: Final[dict[str, int]] = {
    "gateway": 0,
    "switch": 1,
    "access_point": 2,
    "other": 3,
    "client": 4,
}
_UNKNOWN_CLIENT: Final = "Unknown client"
_UNKNOWN_DEVICE: Final = "Unknown device"


def _as_int(value: Any) -> int | None:
    """Return value when it is a real int (not a bool), else None."""
    if isinstance(value, bool) or not isinstance(value, int):
        return None
    return value


def _site_map(data: Mapping[str, Any], section: str, site_id: str) -> dict[str, Any]:
    """Return ``data[section][site_id]`` when it is a dict, else {}."""
    by_site = data.get(section)
    site_items = by_site.get(site_id) if isinstance(by_site, dict) else None
    return site_items if isinstance(site_items, dict) else {}


def _ports(device: Mapping[str, Any]) -> list[dict[str, Any]]:
    """Return a device's port dicts from ``ports`` or ``interfaces.ports``."""
    ports = device.get("ports")
    if not isinstance(ports, list):
        interfaces = device.get("interfaces")
        ports = interfaces.get("ports") if isinstance(interfaces, dict) else None
    if not isinstance(ports, list):
        return []
    return [port for port in ports if isinstance(port, dict)]


def _port_index(port: Mapping[str, Any]) -> int | None:
    """Return a port's index across the v1, interface and legacy shapes."""
    return _as_int(_field(port, "idx", "port_idx", "portIdx"))


def _uplink_port_index(device: Mapping[str, Any]) -> int | None:
    """Return the index of the port flagged as the device's uplink."""
    for port in _ports(device):
        if _field(port, "is_uplink", "isUplink") is True:
            return _port_index(port)
    return None


def _port_poe_watts(device: Mapping[str, Any], port_idx: int) -> float | None:
    """Return the PoE draw on one port, or None when PoE is off or unknown."""
    for port in _ports(device):
        if _port_index(port) != port_idx:
            continue
        poe = port.get("poe")
        if isinstance(poe, dict):
            if poe.get("enabled") is not True:
                return None
            power = poe.get("power")
        else:
            if _field(port, "poeEnabled", "poe_enabled") is False:
                return None
            power = _field(port, "poePower", "poe_power")
        try:
            return round(float(power), 1) if power is not None else None
        except TypeError, ValueError:
            return None
    return None


def _medium(value: Any) -> LinkMedium:
    """Map a legacy uplink type onto the contract medium."""
    if isinstance(value, str):
        lowered = value.lower()
        if lowered in {"wire", "wired"}:
            return "wired"
        if lowered in {"wireless", "mesh"}:
            return "wireless"
    return "unknown"


def _connection(client: Mapping[str, Any]) -> ClientConnection | None:
    """Return a client's wired/wireless connection, if known."""
    raw = client.get("type")
    if isinstance(raw, str):
        upper = raw.upper()
        if upper == "WIRED":
            return "wired"
        if upper == "WIRELESS":
            return "wireless"
    return None


def _display_name(value: Any, fallback: str) -> str:
    """Return a usable name; blank or MAC-shaped names use the fallback."""
    if isinstance(value, str) and value.strip() and normalize_mac(value) is None:
        return value.strip()
    return fallback


def _device_node(
    device: Mapping[str, Any],
    device_id: str,
    node_id: str,
    ha_device_ids: Mapping[str, str],
) -> TopologyNode:
    """Build the allowlisted node for one infrastructure device."""
    raw_model = device.get("model")
    model = raw_model if isinstance(raw_model, str) and raw_model else None
    node: TopologyNode = {
        "id": node_id,
        "kind": device_kind(device),
        "name": _display_name(device.get("name"), model or _UNKNOWN_DEVICE),
        "state": device_state(device),
    }
    if model is not None:
        node["model"] = model
    ha_device_id = ha_device_ids.get(device_id)
    if ha_device_id:
        node["ha_device_id"] = ha_device_id
    return node


def _client_node(client: Mapping[str, Any], node_id: str) -> TopologyNode:
    """Build the allowlisted node for one client."""
    node: TopologyNode = {
        "id": node_id,
        "kind": "client",
        "name": _display_name(client.get("name"), _UNKNOWN_CLIENT),
        "state": "offline" if client.get("connected") is False else "online",
    }
    connection = _connection(client)
    if connection is not None:
        node["connection"] = connection
    return node


def _device_edge(
    device: Mapping[str, Any],
    node_id: str,
    mac_index: Mapping[str, str],
    devices_by_node: Mapping[str, Mapping[str, Any]],
) -> TopologyEdge | UnresolvedReason | None:
    """
    Return the device's edge to its parent, an unresolved reason, or None.

    None means "no edge and nothing wrong": a gateway (the root) or a
    self-reference.
    """
    topology = device.get("topology")
    block = topology if isinstance(topology, dict) else {}
    parent_mac = normalize_mac(block.get("uplink_mac"))
    if parent_mac is None:
        return None if device_kind(device) == "gateway" else "no_uplink_data"
    parent_id = mac_index.get(parent_mac)
    if parent_id is None:
        return "parent_not_found"
    if parent_id == node_id:
        return None

    edge: TopologyEdge = {
        "source": node_id,
        "target": parent_id,
        "medium": _medium(block.get("uplink_type")),
    }
    speed = _as_int(block.get("uplink_speed"))
    if speed is not None:
        edge["speed_mbps"] = speed
    parent_port = _as_int(block.get("uplink_remote_port"))
    if parent_port is not None:
        edge["parent_port"] = parent_port
        poe_watts = _port_poe_watts(devices_by_node[parent_id], parent_port)
        if poe_watts is not None:
            edge["poe_power_w"] = poe_watts
    child_port = _as_int(block.get("uplink_port_idx"))
    if child_port is None:
        child_port = _uplink_port_index(device)
    if child_port is not None:
        edge["child_port"] = child_port
    return edge


def _select_clients(
    clients: Mapping[str, Any], max_clients: int
) -> tuple[list[tuple[str, dict[str, Any]]], int]:
    """Apply the client cap: wired first, then by name, then by id."""
    valid = [
        (client_id, client)
        for client_id, client in clients.items()
        if isinstance(client, dict)
    ]
    limit = max(0, min(max_clients, MAX_CLIENTS_PER_SITE))
    valid.sort(
        key=lambda item: (
            _connection(item[1]) != "wired",
            _display_name(item[1].get("name"), _UNKNOWN_CLIENT).casefold(),
            item[0],
        )
    )
    return valid[:limit], len(valid)


def _status(issues: list[TopologyIssue]) -> TopologyStatus:
    """Derive the snapshot status from its issues."""
    if any(issue["severity"] == "error" for issue in issues):
        return "unavailable"
    return "partial" if issues else "ok"


def _finalize(snapshot: SiteTopology) -> SiteTopology:
    """Sort every list deterministically and stamp the content revision."""
    snapshot["nodes"].sort(key=lambda node: (_KIND_ORDER[node["kind"]], node["id"]))
    snapshot["edges"].sort(key=lambda edge: (edge["source"], edge["target"]))
    snapshot["unresolved"].sort(key=lambda entry: entry["node_id"])
    snapshot["issues"].sort(key=lambda issue: issue["code"])
    content = {key: value for key, value in snapshot.items() if key != "revision"}
    canonical = json.dumps(content, sort_keys=True, separators=(",", ":"))
    snapshot["revision"] = hashlib.sha256(canonical.encode()).hexdigest()[:16]
    return snapshot


def build_unavailable_topology(
    entry_id: str, site_id: str, site_name: str, issue_code: str
) -> SiteTopology:
    """Return an empty snapshot that reports why no graph is available."""
    return _finalize(
        {
            "schema_version": TOPOLOGY_SCHEMA_VERSION,
            "entry_id": entry_id,
            "site_id": site_id,
            "site_name": site_name,
            "revision": "",
            "status": "unavailable",
            "issues": [{"code": issue_code, "severity": "error"}],
            "nodes": [],
            "edges": [],
            "unresolved": [],
            "truncation": None,
        }
    )


def build_site_topology(
    data: Mapping[str, Any],
    entry_id: str,
    site_id: str,
    *,
    ha_device_ids: Mapping[str, str],
    max_clients: int = MAX_CLIENTS_PER_SITE,
    devices_available: bool = True,
) -> SiteTopology:
    """Build the allowlisted topology snapshot for one site."""
    devices = _site_map(data, "devices", site_id)
    clients = _site_map(data, "clients", site_id)
    nodes: list[TopologyNode] = []
    edges: list[TopologyEdge] = []
    unresolved: list[TopologyUnresolved] = []

    device_node_ids: dict[str, str] = {}
    devices_by_node: dict[str, dict[str, Any]] = {}
    mac_index: dict[str, str] = {}
    for device_id, device in devices.items():
        if not isinstance(device, dict):
            continue
        node_id = opaque_node_id("dev", entry_id, device_id)
        device_node_ids[device_id] = node_id
        devices_by_node[node_id] = device
        nodes.append(_device_node(device, device_id, node_id, ha_device_ids))
        mac = normalize_mac(_field(device, "macAddress", "mac")) or normalize_mac(
            device_id
        )
        if mac is not None:
            mac_index[mac] = node_id

    for node_id, device in devices_by_node.items():
        link = _device_edge(device, node_id, mac_index, devices_by_node)
        if isinstance(link, dict):
            edges.append(link)
        elif link is not None:
            unresolved.append({"node_id": node_id, "reason": link})

    included, clients_total = _select_clients(clients, max_clients)
    for client_id, client in included:
        node_id = opaque_node_id("cli", entry_id, client_id)
        nodes.append(_client_node(client, node_id))
        uplink = _field(client, "uplinkDeviceId", "uplink_device_id")
        if not isinstance(uplink, str):
            unresolved.append({"node_id": node_id, "reason": "no_uplink_data"})
            continue
        target = device_node_ids.get(uplink)
        if target is None:
            unresolved.append({"node_id": node_id, "reason": "parent_not_found"})
            continue
        edges.append(
            {
                "source": node_id,
                "target": target,
                "medium": _connection(client) or "unknown",
            }
        )

    issues: list[TopologyIssue] = []
    by_site = data.get("devices")
    if not devices_available or not isinstance(by_site, dict) or site_id not in by_site:
        issues.append({"code": "devices_unavailable", "severity": "error"})
    if devices_by_node and not any(
        isinstance(device.get("topology"), dict) for device in devices_by_node.values()
    ):
        issues.append({"code": "legacy_uplink_missing", "severity": "warning"})
    if unresolved:
        issues.append({"code": "parents_unresolved", "severity": "warning"})
    truncation: TopologyTruncation | None = None
    if len(included) < clients_total:
        truncation = {"clients_total": clients_total, "clients_included": len(included)}
        issues.append({"code": "clients_truncated", "severity": "info"})

    return _finalize(
        {
            "schema_version": TOPOLOGY_SCHEMA_VERSION,
            "entry_id": entry_id,
            "site_id": site_id,
            "site_name": site_display_name(data, site_id),
            "revision": "",
            "status": _status(issues),
            "issues": issues,
            "nodes": nodes,
            "edges": edges,
            "unresolved": unresolved,
            "truncation": truncation,
        }
    )
