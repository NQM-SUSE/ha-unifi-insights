"""Tests for the topology graph builder."""

from __future__ import annotations

import json
import random

import pytest

from custom_components.unifi_insights.topology import (
    MAX_CLIENTS_PER_SITE,
    build_site_topology,
    build_unavailable_topology,
    device_kind,
    device_state,
    normalize_mac,
    opaque_node_id,
    site_display_name,
)

ENTRY = "entry-1"
SITE = "site-1"


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("28:70:4E:C1:A6:13", "28:70:4e:c1:a6:13"),
        ("28-70-4e-c1-a6-13", "28:70:4e:c1:a6:13"),
        ("28704ec1a613", "28:70:4e:c1:a6:13"),
        (" 28:70:4e:c1:a6:13 ", "28:70:4e:c1:a6:13"),
        ("dc4eaf35-9daf-352c-9e34-2e428120ff1a", None),
        ("69d19121c4862038869ff37f", None),
        ("device1", None),
        ("", None),
        (None, None),
        (42, None),
    ],
)
def test_normalize_mac(value, expected) -> None:
    """Only MAC-shaped strings normalise; UUIDs and legacy ids do not."""
    assert normalize_mac(value) == expected


def test_opaque_node_id_keeps_uuid_and_hashes_mac() -> None:
    """UUIDs pass through; MAC-shaped ids never appear in the node id."""
    assert opaque_node_id("dev", ENTRY, "uuid-1") == "dev:uuid-1"
    assert opaque_node_id("cli", ENTRY, "uuid-9") == "cli:uuid-9"
    hashed = opaque_node_id("dev", ENTRY, "AA:BB:CC:DD:EE:FF")
    assert hashed.startswith("dev:h")
    assert len(hashed) == len("dev:h") + 16
    assert "aa:bb" not in hashed.lower()
    # Stable across spellings of the same MAC, scoped per entry.
    assert hashed == opaque_node_id("dev", ENTRY, "aabbccddeeff")
    assert hashed != opaque_node_id("dev", "entry-2", "aabbccddeeff")


@pytest.mark.parametrize(
    ("device", "expected"),
    [
        ({"topology": {"legacy_type": "udm"}, "features": ["switching"]}, "gateway"),
        ({"topology": {"legacy_type": "uxg"}}, "gateway"),
        ({"topology": {"legacy_type": "ugw"}}, "gateway"),
        ({"topology": {"legacy_type": "udr"}}, "gateway"),
        ({"topology": {"legacy_type": "ucg"}}, "gateway"),
        ({"topology": {"legacy_type": "usw"}}, "switch"),
        ({"topology": {"legacy_type": "uap"}}, "access_point"),
        ({"type": "GATEWAY"}, "gateway"),
        ({"type": "switch"}, "switch"),
        ({"type": "accessPoint"}, "access_point"),
        ({"features": ["accessPoint"]}, "access_point"),
        ({"features": ["switching"]}, "switch"),
        ({"type": "sensor", "features": []}, "other"),
        ({"topology": {"legacy_type": "uph"}}, "other"),
        ({}, "other"),
    ],
)
def test_device_kind(device, expected) -> None:
    """Legacy type wins, then v1 type, then features, then other."""
    assert device_kind(device) == expected


@pytest.mark.parametrize(
    ("device", "expected"),
    [
        ({"state": "ONLINE"}, "online"),
        ({"state": "connected"}, "online"),
        ({"status": "UP"}, "online"),
        ({"state": "OFFLINE"}, "offline"),
        ({"state": "DISCONNECTED"}, "offline"),
        ({"state": "PENDING_ADOPTION"}, "unknown"),
        ({"state": 1}, "unknown"),
        ({}, "unknown"),
    ],
)
def test_device_state(device, expected) -> None:
    """Device state strings map onto the three contract states."""
    assert device_state(device) == expected


def test_site_display_name() -> None:
    """Site name falls back to description, then to the id."""
    data = {
        "sites": {
            "a": {"name": "Home"},
            "b": {"name": "", "desc": "Office"},
            "c": {},
        }
    }
    assert site_display_name(data, "a") == "Home"
    assert site_display_name(data, "b") == "Office"
    assert site_display_name(data, "c") == "c"
    assert site_display_name(data, "missing") == "missing"


GW_MAC = "02:00:00:00:00:01"
CORE_MAC = "02:00:00:00:00:02"


def _device(
    device_id: str,
    name: str,
    *,
    mac: str,
    legacy_type: str | None = None,
    uplink_mac: str | None = None,
    remote_port: int | None = None,
    port_idx: int | None = None,
    speed: int | None = None,
    model: str = "USW",
    state: str = "ONLINE",
    ports: list[dict] | None = None,
    features: list[str] | None = None,
) -> dict:
    """Return a coordinator-shaped device (keys as seen live on VM113)."""
    device = {
        "id": device_id,
        "name": name,
        "model": model,
        "macAddress": mac,
        "ipAddress": "10.1.0.9",
        "firmwareVersion": "7.4.2.1039",
        "state": state,
        "type": None,
        "uplink": None,
        "features": features if features is not None else ["switching"],
        "ports": ports or [],
    }
    topology: dict = {}
    if legacy_type is not None:
        topology["legacy_type"] = legacy_type
    if uplink_mac is not None:
        topology["uplink_mac"] = uplink_mac
        topology["uplink_type"] = "wire"
    if remote_port is not None:
        topology["uplink_remote_port"] = remote_port
    if port_idx is not None:
        topology["uplink_port_idx"] = port_idx
    if speed is not None:
        topology["uplink_speed"] = speed
    if topology:
        device["topology"] = topology
    return device


def _client(
    client_id: str,
    name: str,
    *,
    uplink: str | None,
    wired: bool = True,
    mac: str = "11:22:33:44:55:66",
) -> dict:
    """Return a coordinator-shaped v1 client."""
    return {
        "id": client_id,
        "name": name,
        "hostname": f"{name.lower()}-host",
        "macAddress": mac,
        "ipAddress": "10.2.0.5",
        "type": "WIRED" if wired else "WIRELESS",
        "connected": True,
        "uplinkDeviceId": uplink,
        "swMac": None,
        "swPort": None,
        "vlan": None,
    }


def _data(devices: dict, clients: dict | None = None) -> dict:
    """Wrap one site's devices/clients in facade-shaped data."""
    return {
        "sites": {SITE: {"id": SITE, "name": "Home"}},
        "devices": {SITE: devices},
        "clients": {SITE: clients or {}},
    }


def _live_layout() -> dict:
    """Sanitised copy of the VM113 layout (fictitious MACs and names)."""
    devices = {
        "uuid-gw": _device(
            "uuid-gw",
            "Gateway",
            mac=GW_MAC,
            legacy_type="udm",
            model="UDM Pro SE",
        ),
        "uuid-core": _device(
            "uuid-core",
            "Core 24",
            mac=CORE_MAC,
            legacy_type="usw",
            uplink_mac=GW_MAC,
            remote_port=11,
            port_idx=26,
            speed=10000,
            model="USW Pro Max 24",
            ports=[
                {"idx": 20, "port_idx": 20, "poe": {"enabled": True, "power": "12.34"}},
                {"idx": 8, "port_idx": 8, "poe": {"enabled": False, "power": "0.00"}},
                {"idx": 26, "port_idx": 26, "is_uplink": True},
            ],
        ),
    }
    children = [
        ("uuid-u1", "Ultra A", "02:00:00:00:00:03", 6, 1000, "usw", ["switching"]),
        ("uuid-pdu", "PDU", "02:00:00:00:00:04", 8, 100, "usw", ["switching"]),
        ("uuid-u2", "Ultra B", "02:00:00:00:00:05", 10, 1000, "usw", ["switching"]),
        ("uuid-lite", "Lite 8", "02:00:00:00:00:06", 12, 1000, "usw", ["switching"]),
        ("uuid-flex", "Flex", "02:00:00:00:00:07", 17, 2500, "usw", ["switching"]),
        ("uuid-ap", "AP", "02:00:00:00:00:08", 20, 2500, "uap", ["accessPoint"]),
    ]
    for device_id, name, mac, port, speed, legacy_type, features in children:
        devices[device_id] = _device(
            device_id,
            name,
            mac=mac,
            legacy_type=legacy_type,
            uplink_mac=CORE_MAC,
            remote_port=port,
            speed=speed,
            features=features,
            ports=[{"idx": 1, "port_idx": 1, "is_uplink": True}],
        )
    clients = {
        "cli-tv": _client("cli-tv", "TV", uplink="uuid-u1", mac="12:00:00:00:00:01"),
        "cli-phone": _client(
            "cli-phone", "Phone", uplink="uuid-ap", wired=False, mac="12:00:00:00:00:02"
        ),
    }
    return _data(devices, clients)


def _build(data: dict, **kwargs):
    kwargs.setdefault("ha_device_ids", {})
    return build_site_topology(data, ENTRY, SITE, **kwargs)


def _edge(snapshot, source: str) -> dict:
    (edge,) = [edge for edge in snapshot["edges"] if edge["source"] == source]
    return edge


def test_live_layout_builds_the_tree() -> None:
    """Every switch/AP hangs off the core; the core hangs off the gateway."""
    snapshot = _build(_live_layout())

    assert snapshot["schema_version"] == 1
    assert snapshot["status"] == "ok"
    assert snapshot["issues"] == []
    assert snapshot["unresolved"] == []
    device_edges = {
        edge["source"]: edge["target"]
        for edge in snapshot["edges"]
        if edge["source"].startswith("dev:")
    }
    assert device_edges == {
        "dev:uuid-core": "dev:uuid-gw",
        "dev:uuid-u1": "dev:uuid-core",
        "dev:uuid-pdu": "dev:uuid-core",
        "dev:uuid-u2": "dev:uuid-core",
        "dev:uuid-lite": "dev:uuid-core",
        "dev:uuid-flex": "dev:uuid-core",
        "dev:uuid-ap": "dev:uuid-core",
    }
    kinds = {node["id"]: node["kind"] for node in snapshot["nodes"]}
    assert kinds["dev:uuid-gw"] == "gateway"
    assert kinds["dev:uuid-ap"] == "access_point"
    assert kinds["dev:uuid-core"] == "switch"


def test_device_edge_enrichment() -> None:
    """Ports, speed, medium and PoE draw ride on the device edge."""
    snapshot = _build(_live_layout())

    assert _edge(snapshot, "dev:uuid-core") == {
        "source": "dev:uuid-core",
        "target": "dev:uuid-gw",
        "medium": "wired",
        "speed_mbps": 10000,
        "parent_port": 11,
        "child_port": 26,
    }
    ap_edge = _edge(snapshot, "dev:uuid-ap")
    assert ap_edge["poe_power_w"] == 12.3
    # Child port falls back to the port flagged is_uplink.
    assert ap_edge["child_port"] == 1
    # PoE disabled on the parent port -> no wattage (not a fake 0.0).
    assert "poe_power_w" not in _edge(snapshot, "dev:uuid-pdu")


@pytest.mark.parametrize(
    ("poe_enabled", "power", "expected_watts"),
    [
        (False, "9.44", None),
        (True, "9.44", 9.4),
        (True, "invalid", None),
    ],
)
def test_legacy_port_poe_and_uplink_fallback(
    *, poe_enabled: bool, power: str, expected_watts: float | None
) -> None:
    """Legacy PoE fields and a later uplink port enrich the device edge."""
    gateway = _device(
        "uuid-gw",
        "Gateway",
        mac=GW_MAC,
        legacy_type="udm",
        ports=[{"idx": 7, "poeEnabled": poe_enabled, "poePower": power}],
    )
    switch = _device(
        "uuid-switch",
        "Switch",
        mac=CORE_MAC,
        legacy_type="usw",
        uplink_mac=GW_MAC,
        remote_port=7,
        ports=[{"idx": 1}, {"idx": 2, "isUplink": True}],
    )
    switch["topology"]["uplink_type"] = "mesh"
    edge = _edge(
        _build(_data({"uuid-gw": gateway, "uuid-switch": switch})), "dev:uuid-switch"
    )

    assert edge["medium"] == "wireless"
    assert edge["child_port"] == 2
    assert edge["parent_port"] == 7
    if expected_watts is None:
        assert "poe_power_w" not in edge
    else:
        assert edge["poe_power_w"] == expected_watts


def test_unrecognized_uplink_medium_is_unknown() -> None:
    """A new legacy uplink type does not become a guessed wired link."""
    gateway = _device("uuid-gw", "Gateway", mac=GW_MAC, legacy_type="udm")
    switch = _device(
        "uuid-switch", "Switch", mac=CORE_MAC, legacy_type="usw", uplink_mac=GW_MAC
    )
    switch["topology"]["uplink_type"] = "fiber"

    edge = _edge(
        _build(_data({"uuid-gw": gateway, "uuid-switch": switch})), "dev:uuid-switch"
    )
    assert edge["medium"] == "unknown"


def test_client_edges_and_nodes() -> None:
    """Clients attach through uplinkDeviceId with their connection medium."""
    snapshot = _build(_live_layout())

    assert _edge(snapshot, "cli:cli-tv") == {
        "source": "cli:cli-tv",
        "target": "dev:uuid-u1",
        "medium": "wired",
    }
    assert _edge(snapshot, "cli:cli-phone")["medium"] == "wireless"
    phone = next(node for node in snapshot["nodes"] if node["id"] == "cli:cli-phone")
    assert phone == {
        "id": "cli:cli-phone",
        "kind": "client",
        "name": "Phone",
        "state": "online",
        "connection": "wireless",
    }


@pytest.mark.parametrize("client_type", ["BLUETOOTH", None])
def test_unknown_client_connection_is_omitted_from_node(
    client_type: str | None,
) -> None:
    """Unknown and absent connection types produce an unknown link medium."""
    gateway = _device("uuid-gw", "Gateway", mac=GW_MAC, legacy_type="udm")
    client = _client("cli-a", "Client", uplink="uuid-gw")
    client["type"] = client_type
    snapshot = _build(_data({"uuid-gw": gateway}, {"cli-a": client}))

    node = next(node for node in snapshot["nodes"] if node["id"] == "cli:cli-a")
    assert "connection" not in node
    assert _edge(snapshot, "cli:cli-a")["medium"] == "unknown"


def test_every_edge_endpoint_exists_in_nodes() -> None:
    """The graph never references a node it did not emit."""
    data = _live_layout()
    data["devices"][SITE]["uuid-orphan"] = _device(
        "uuid-orphan", "Orphan", mac="02:00:00:00:00:99", uplink_mac="02:ff:ff:ff:ff:ff"
    )
    data["clients"][SITE]["cli-lost"] = _client("cli-lost", "Lost", uplink="uuid-nope")
    snapshot = _build(data)

    node_ids = {node["id"] for node in snapshot["nodes"]}
    for edge in snapshot["edges"]:
        assert edge["source"] in node_ids
        assert edge["target"] in node_ids


def test_missing_parent_is_unresolved() -> None:
    """A parent MAC that matches nothing becomes an unresolved entry."""
    data = _live_layout()
    data["devices"][SITE]["uuid-orphan"] = _device(
        "uuid-orphan", "Orphan", mac="02:00:00:00:00:99", uplink_mac="02:ff:ff:ff:ff:ff"
    )
    snapshot = _build(data)

    assert {"node_id": "dev:uuid-orphan", "reason": "parent_not_found"} in snapshot[
        "unresolved"
    ]
    assert not [e for e in snapshot["edges"] if e["source"] == "dev:uuid-orphan"]
    assert snapshot["status"] == "partial"
    assert {"code": "parents_unresolved", "severity": "warning"} in snapshot["issues"]


def test_client_unresolved_reasons() -> None:
    """Unknown uplink -> parent_not_found; missing uplink -> no_uplink_data."""
    data = _data(
        {"uuid-gw": _device("uuid-gw", "Gateway", mac=GW_MAC, legacy_type="udm")},
        {
            "cli-a": _client("cli-a", "A", uplink="uuid-nope"),
            "cli-b": _client("cli-b", "B", uplink=None),
        },
    )
    snapshot = _build(data)

    assert snapshot["unresolved"] == [
        {"node_id": "cli:cli-a", "reason": "parent_not_found"},
        {"node_id": "cli:cli-b", "reason": "no_uplink_data"},
    ]


def test_gateway_without_uplink_is_root() -> None:
    """A lone gateway is a healthy one-node graph, not an unresolved node."""
    snapshot = _build(
        _data({"uuid-gw": _device("uuid-gw", "Gateway", mac=GW_MAC, legacy_type="udm")})
    )

    assert snapshot["status"] == "ok"
    assert snapshot["unresolved"] == []
    assert snapshot["edges"] == []


def test_gateway_with_unknown_upstream_is_root() -> None:
    """A gateway uplinked to a non-UniFi router (e.g. via LLDP) is still the root."""
    data = _live_layout()
    data["devices"][SITE]["uuid-gw"]["topology"]["uplink_mac"] = "02:ff:ff:ff:ff:ff"
    snapshot = _build(data)

    assert snapshot["status"] == "ok"
    assert snapshot["unresolved"] == []
    assert not [e for e in snapshot["edges"] if e["source"] == "dev:uuid-gw"]


def test_self_edge_is_skipped() -> None:
    """A device that claims itself as parent gets no edge."""
    snapshot = _build(
        _data(
            {
                "uuid-sw": _device(
                    "uuid-sw",
                    "Loop",
                    mac=CORE_MAC,
                    legacy_type="usw",
                    uplink_mac=CORE_MAC,
                )
            }
        )
    )

    assert snapshot["edges"] == []


def test_legacy_missing_is_partial_not_crash() -> None:
    """Without any legacy blocks, devices and clients still render."""
    data = _data(
        {
            "uuid-gw": _device(
                "uuid-gw", "Gateway", mac=GW_MAC, features=["switching"]
            ),
            "uuid-ap": _device(
                "uuid-ap", "AP", mac="02:00:00:00:00:08", features=["accessPoint"]
            ),
        },
        {"cli-a": _client("cli-a", "A", uplink="uuid-ap", wired=False)},
    )
    snapshot = _build(data)

    assert snapshot["status"] == "partial"
    codes = {issue["code"] for issue in snapshot["issues"]}
    assert codes == {"legacy_uplink_missing", "parents_unresolved"}
    assert _edge(snapshot, "cli:cli-a")["target"] == "dev:uuid-ap"
    assert {"node_id": "dev:uuid-ap", "reason": "no_uplink_data"} in snapshot[
        "unresolved"
    ]


def test_mac_keyed_device_resolves_and_is_opaque() -> None:
    """A device keyed by MAC still parents others and never leaks the MAC."""
    parent_mac = "aa:bb:cc:00:00:01"
    data = _data(
        {
            parent_mac: {
                "id": parent_mac,
                "name": "Old Switch",
                "state": "ONLINE",
                "topology": {"legacy_type": "usw", "uplink_mac": GW_MAC},
            },
            "uuid-gw": _device("uuid-gw", "Gateway", mac=GW_MAC, legacy_type="udm"),
            "uuid-ap": _device(
                "uuid-ap",
                "AP",
                mac="02:00:00:00:00:08",
                legacy_type="uap",
                uplink_mac=parent_mac.upper(),
            ),
        }
    )
    snapshot = _build(data)

    parent_node = opaque_node_id("dev", ENTRY, parent_mac)
    assert parent_node.startswith("dev:h")
    assert _edge(snapshot, "dev:uuid-ap")["target"] == parent_node
    assert _edge(snapshot, parent_node)["target"] == "dev:uuid-gw"
    assert "aa:bb:cc" not in json.dumps(snapshot).lower()


def test_device_without_mac_is_included_without_mac_index() -> None:
    """A device with a UUID id and no MAC remains visible in the graph."""
    snapshot = _build(_data({"uuid-device": {"name": "Device", "type": "switch"}}))

    assert {node["id"] for node in snapshot["nodes"]} == {"dev:uuid-device"}
    assert snapshot["edges"] == []
    assert snapshot["unresolved"] == [
        {"node_id": "dev:uuid-device", "reason": "no_uplink_data"}
    ]


def test_client_name_mac_shaped_is_replaced() -> None:
    """A client whose name is its MAC, or blank, is rendered generically."""
    data = _data(
        {"uuid-gw": _device("uuid-gw", "Gateway", mac=GW_MAC, legacy_type="udm")},
        {
            "cli-a": _client("cli-a", "8c:ed:e1:a2:21:17", uplink="uuid-gw"),
            "cli-b": _client("cli-b", "   ", uplink="uuid-gw"),
        },
    )
    snapshot = _build(data)

    names = {n["id"]: n["name"] for n in snapshot["nodes"] if n["kind"] == "client"}
    assert names == {"cli:cli-a": "Unknown client", "cli:cli-b": "Unknown client"}


def test_allowlist_never_emits_sensitive_values() -> None:
    """No MAC, IP, hostname or firmware reaches the payload."""
    snapshot = _build(_live_layout())
    payload = json.dumps(snapshot)

    for forbidden in ("02:00:00", "12:00:00", "10.1.0.", "10.2.0.", "-host", "7.4.2"):
        assert forbidden not in payload
    node_keys = {key for node in snapshot["nodes"] for key in node}
    assert node_keys <= {
        "id",
        "kind",
        "name",
        "state",
        "model",
        "ha_device_id",
        "connection",
    }
    edge_keys = {key for edge in snapshot["edges"] for key in edge}
    assert edge_keys <= {
        "source",
        "target",
        "medium",
        "speed_mbps",
        "parent_port",
        "child_port",
        "poe_power_w",
    }


def test_ha_device_ids_are_attached() -> None:
    """Registry ids from the caller land on infrastructure nodes only."""
    snapshot = _build(_live_layout(), ha_device_ids={"uuid-core": "reg-core"})

    core = next(node for node in snapshot["nodes"] if node["id"] == "dev:uuid-core")
    assert core["ha_device_id"] == "reg-core"
    assert not [
        n for n in snapshot["nodes"] if n["kind"] == "client" and "ha_device_id" in n
    ]


def test_client_cap_prefers_wired_and_reports_truncation() -> None:
    """Over the cap, wired clients are kept first and truncation is reported."""
    data = _data(
        {"uuid-gw": _device("uuid-gw", "Gateway", mac=GW_MAC, legacy_type="udm")},
        {
            "cli-w": _client("cli-w", "Aardvark", uplink="uuid-gw", wired=False),
            "cli-2": _client("cli-2", "Zulu", uplink="uuid-gw"),
            "cli-1": _client("cli-1", "Mike", uplink="uuid-gw"),
        },
    )
    snapshot = _build(data, max_clients=2)

    clients = [n["id"] for n in snapshot["nodes"] if n["kind"] == "client"]
    assert sorted(clients) == ["cli:cli-1", "cli:cli-2"]
    assert snapshot["truncation"] == {"clients_total": 3, "clients_included": 2}
    assert snapshot["status"] == "partial"
    assert {"code": "clients_truncated", "severity": "info"} in snapshot["issues"]

    none = _build(data, max_clients=0)
    assert [n for n in none["nodes"] if n["kind"] == "client"] == []
    assert none["truncation"] == {"clients_total": 3, "clients_included": 0}


def test_client_cap_is_clamped_to_hard_limit() -> None:
    """A request cannot raise the cap above MAX_CLIENTS_PER_SITE."""
    clients = {
        f"cli-{index}": _client(f"cli-{index}", f"C{index:04d}", uplink="uuid-gw")
        for index in range(MAX_CLIENTS_PER_SITE + 1)
    }
    data = _data(
        {"uuid-gw": _device("uuid-gw", "Gateway", mac=GW_MAC, legacy_type="udm")},
        clients,
    )
    snapshot = _build(data, max_clients=10_000)

    assert snapshot["truncation"] == {
        "clients_total": MAX_CLIENTS_PER_SITE + 1,
        "clients_included": MAX_CLIENTS_PER_SITE,
    }


def test_devices_unavailable() -> None:
    """A failed device coordinator or an unknown site reports unavailable."""
    snapshot = _build(_live_layout(), devices_available=False)
    assert snapshot["status"] == "unavailable"
    assert {"code": "devices_unavailable", "severity": "error"} in snapshot["issues"]

    missing = build_site_topology(_live_layout(), ENTRY, "other-site", ha_device_ids={})
    assert missing["status"] == "unavailable"
    assert missing["nodes"] == []


def test_multi_site_isolation() -> None:
    """Each site's graph only contains that site's devices and clients."""
    data = _live_layout()
    data["sites"]["site-2"] = {"id": "site-2", "name": "Cabin"}
    data["devices"]["site-2"] = {
        "uuid-cabin": _device(
            "uuid-cabin", "Cabin GW", mac="06:00:00:00:00:01", legacy_type="udm"
        )
    }
    data["clients"]["site-2"] = {}

    home = _build(data)
    cabin = build_site_topology(data, ENTRY, "site-2", ha_device_ids={})

    assert "dev:uuid-cabin" not in {n["id"] for n in home["nodes"]}
    assert [n["id"] for n in cabin["nodes"]] == ["dev:uuid-cabin"]
    assert cabin["site_name"] == "Cabin"


def test_deterministic_order_and_revision() -> None:
    """Insertion order does not matter; any content change moves the revision."""
    data = _live_layout()
    shuffled = _live_layout()
    items = list(shuffled["devices"][SITE].items())
    random.Random(4).shuffle(items)  # noqa: S311 -- deterministic test shuffle, not crypto
    shuffled["devices"][SITE] = dict(items)

    first = _build(data)
    assert first == _build(shuffled)
    assert first["revision"] == _build(data)["revision"]
    assert len(first["revision"]) == 16
    assert next(n["kind"] for n in first["nodes"]) == "gateway"

    data["devices"][SITE]["uuid-u1"]["name"] = "Renamed"
    assert _build(data)["revision"] != first["revision"]


def test_malformed_entries_are_skipped() -> None:
    """Non-dict devices/clients and non-dict site maps never crash the builder."""
    data = _live_layout()
    data["devices"][SITE]["bad"] = "not-a-dict"
    data["clients"][SITE]["bad"] = None
    snapshot = _build(data)
    assert "dev:bad" not in {n["id"] for n in snapshot["nodes"]}

    weird = {"sites": [], "devices": {SITE: []}, "clients": "x"}
    assert _build(weird)["nodes"] == []


def test_build_unavailable_topology() -> None:
    """The unavailable helper returns a valid, empty snapshot."""
    snapshot = build_unavailable_topology(ENTRY, SITE, "Home", "entry_unloaded")

    assert snapshot["status"] == "unavailable"
    assert snapshot["issues"] == [{"code": "entry_unloaded", "severity": "error"}]
    assert snapshot["nodes"] == snapshot["edges"] == snapshot["unresolved"] == []
    assert snapshot["truncation"] is None
    assert len(snapshot["revision"]) == 16
