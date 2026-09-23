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
