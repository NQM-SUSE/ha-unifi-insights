"""Tests for the topology WebSocket API."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any
from unittest.mock import patch

from homeassistant.config_entries import ConfigEntryState
from homeassistant.helpers import device_registry as dr
from pytest_homeassistant_custom_component.common import (
    MockConfigEntry as MockConfigEntryForTest,
)

from custom_components.unifi_insights.const import DOMAIN

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant
    from pytest_homeassistant_custom_component.common import MockConfigEntry

SITE = "site-1"
GW_MAC = "02:00:00:00:00:01"


def _seed(entry: MockConfigEntry) -> dict[str, Any]:
    """
    Add a two-device site with one client beside the mocked setup's data.

    The mocked "default" site is kept (merged, not replaced) so the entity
    listeners that also run on facade updates still find their own data.
    """
    runtime = entry.runtime_data
    runtime.device_coordinator.last_update_success = True
    site = {SITE: {"id": SITE, "name": "Home"}}
    runtime.config_coordinator.data["sites"] = {
        **runtime.config_coordinator.data.get("sites", {}),
        **site,
    }
    data = runtime.coordinator.data
    data["sites"] = {**data.get("sites", {}), **site}
    data["devices"] = {
        **data.get("devices", {}),
        SITE: {
            "uuid-gw": {
                "id": "uuid-gw",
                "name": "Gateway",
                "model": "UDM Pro SE",
                "macAddress": GW_MAC,
                "state": "ONLINE",
                "topology": {"legacy_type": "udm"},
            },
            "uuid-ap": {
                "id": "uuid-ap",
                "name": "AP",
                "model": "U7 Pro XGS",
                "macAddress": "02:00:00:00:00:08",
                "state": "ONLINE",
                "topology": {
                    "legacy_type": "uap",
                    "uplink_mac": GW_MAC,
                    "uplink_type": "wire",
                },
            },
        },
    }
    data["clients"] = {
        **data.get("clients", {}),
        SITE: {
            "cli-1": {
                "id": "cli-1",
                "name": "Phone",
                "type": "WIRELESS",
                "macAddress": "12:00:00:00:00:02",
                "ipAddress": "10.2.0.9",
                "uplinkDeviceId": "uuid-ap",
            }
        },
    }
    return data


async def test_sources_lists_loaded_entries(
    hass: HomeAssistant, init_integration: MockConfigEntry, hass_ws_client
) -> None:
    """Sources returns each loaded entry with its selected sites."""
    _seed(init_integration)
    client = await hass_ws_client(hass)

    await client.send_json({"id": 1, "type": "unifi_insights/topology/sources"})
    msg = await client.receive_json()

    assert msg["success"]
    (source,) = msg["result"]
    assert source["entry_id"] == init_integration.entry_id
    assert source["title"] == init_integration.title
    assert {"id": SITE, "name": "Home"} in source["sites"]


async def test_get_returns_snapshot(
    hass: HomeAssistant, init_integration: MockConfigEntry, hass_ws_client
) -> None:
    """Get returns an allowlisted snapshot with registry ids attached."""
    _seed(init_integration)
    registry_device = dr.async_get(hass).async_get_or_create(
        config_entry_id=init_integration.entry_id,
        identifiers={(DOMAIN, f"{SITE}_uuid-ap")},
    )
    client = await hass_ws_client(hass)

    await client.send_json(
        {
            "id": 1,
            "type": "unifi_insights/topology/get",
            "entry_id": init_integration.entry_id,
            "site_id": SITE,
        }
    )
    msg = await client.receive_json()

    assert msg["success"]
    snapshot = msg["result"]
    assert snapshot["status"] == "ok"
    assert snapshot["site_name"] == "Home"
    assert {edge["source"]: edge["target"] for edge in snapshot["edges"]} == {
        "dev:uuid-ap": "dev:uuid-gw",
        "cli:cli-1": "dev:uuid-ap",
    }
    ap = next(node for node in snapshot["nodes"] if node["id"] == "dev:uuid-ap")
    assert ap["ha_device_id"] == registry_device.id
    assert "10.2.0.9" not in str(snapshot)
    assert GW_MAC not in str(snapshot)


async def test_get_non_admin_user_allowed(
    hass: HomeAssistant,
    init_integration: MockConfigEntry,
    hass_ws_client,
    hass_read_only_access_token: str,
) -> None:
    """Dashboards are used by non-admins, so plain authentication suffices."""
    _seed(init_integration)
    client = await hass_ws_client(hass, hass_read_only_access_token)

    await client.send_json(
        {
            "id": 1,
            "type": "unifi_insights/topology/get",
            "entry_id": init_integration.entry_id,
            "site_id": SITE,
        }
    )
    msg = await client.receive_json()

    assert msg["success"]


async def test_get_max_clients(
    hass: HomeAssistant, init_integration: MockConfigEntry, hass_ws_client
) -> None:
    """max_clients is honoured and validated against the hard cap."""
    _seed(init_integration)
    client = await hass_ws_client(hass)

    await client.send_json(
        {
            "id": 1,
            "type": "unifi_insights/topology/get",
            "entry_id": init_integration.entry_id,
            "site_id": SITE,
            "max_clients": 0,
        }
    )
    msg = await client.receive_json()
    assert msg["result"]["truncation"] == {"clients_total": 1, "clients_included": 0}

    await client.send_json(
        {
            "id": 2,
            "type": "unifi_insights/topology/get",
            "entry_id": init_integration.entry_id,
            "site_id": SITE,
            "max_clients": 501,
        }
    )
    msg = await client.receive_json()
    assert not msg["success"]
    assert msg["error"]["code"] == "invalid_format"


async def test_get_errors(
    hass: HomeAssistant, init_integration: MockConfigEntry, hass_ws_client
) -> None:
    """Unknown entry, foreign domain and unselected site are reported by code."""
    _seed(init_integration)
    client = await hass_ws_client(hass)

    async def _get(msg_id: int, entry_id: str, site_id: str) -> dict:
        await client.send_json(
            {
                "id": msg_id,
                "type": "unifi_insights/topology/get",
                "entry_id": entry_id,
                "site_id": site_id,
            }
        )
        return await client.receive_json()

    missing = await _get(1, "nope", SITE)
    assert missing["error"]["code"] == "entry_not_found"

    other_domain = MockConfigEntryForTest(domain="other_domain")
    other_domain.add_to_hass(hass)
    foreign = await _get(2, other_domain.entry_id, SITE)
    assert foreign["error"]["code"] == "entry_not_found"

    unselected = await _get(3, init_integration.entry_id, "site-9")
    assert unselected["error"]["code"] == "site_not_selected"

    await hass.config_entries.async_unload(init_integration.entry_id)
    await hass.async_block_till_done()
    unloaded = await _get(4, init_integration.entry_id, SITE)
    assert unloaded["error"]["code"] == "entry_not_loaded"


async def _subscribe(client, entry: MockConfigEntry, msg_id: int = 1) -> dict:
    """Subscribe and return the initial snapshot event."""
    await client.send_json(
        {
            "id": msg_id,
            "type": "unifi_insights/topology/subscribe",
            "entry_id": entry.entry_id,
            "site_id": SITE,
        }
    )
    ack = await client.receive_json()
    assert ack["success"], ack
    event = await client.receive_json()
    assert event["type"] == "event"
    return event["event"]


async def _assert_no_event(client, ping_id: int) -> None:
    """Prove nothing was pushed: the next message is the ping's pong."""
    await client.send_json({"id": ping_id, "type": "ping"})
    msg = await client.receive_json()
    assert msg["type"] == "pong", msg


async def test_subscribe_pushes_only_on_change(
    hass: HomeAssistant, init_integration: MockConfigEntry, hass_ws_client
) -> None:
    """Initial snapshot, then one push per real change, none for no-ops."""
    data = _seed(init_integration)
    facade = init_integration.runtime_data.coordinator
    # Settle dynamic entity/device discovery for the newly seeded site before
    # measuring: the platforms' own coordinator listeners (e.g. sensor.py's
    # async_discover_sensors) create HA device-registry entries for site-1's
    # devices on their first run after _seed(), which would otherwise look
    # like a spurious content change on the *next* listener call below.
    facade.async_update_listeners()
    await hass.async_block_till_done()
    client = await hass_ws_client(hass)

    initial = await _subscribe(client, init_integration)
    assert initial["status"] == "ok"

    facade.async_update_listeners()
    await _assert_no_event(client, 50)

    data["devices"][SITE]["uuid-ap"]["name"] = "Hallway AP"
    facade.async_update_listeners()
    pushed = await client.receive_json()
    assert pushed["type"] == "event"
    assert pushed["event"]["revision"] != initial["revision"]
    names = {node["id"]: node["name"] for node in pushed["event"]["nodes"]}
    assert names["dev:uuid-ap"] == "Hallway AP"


async def test_subscribe_site_vanishes_then_recovers(
    hass: HomeAssistant, init_integration: MockConfigEntry, hass_ws_client
) -> None:
    """A site dropped without a reload is reported once, and the stream recovers."""
    _seed(init_integration)
    runtime = init_integration.runtime_data
    facade = runtime.coordinator
    facade.async_update_listeners()
    await hass.async_block_till_done()
    client = await hass_ws_client(hass)
    initial = await _subscribe(client, init_integration)

    # The site disappears from the selection without an entry reload (deleted
    # on the console, or the Network API went away).
    sites = runtime.config_coordinator.data["sites"]
    runtime.config_coordinator.data["sites"] = {
        site_id: site for site_id, site in sites.items() if site_id != SITE
    }
    facade.async_update_listeners()
    gone = await client.receive_json()
    assert gone["type"] == "event"
    assert gone["event"]["status"] == "unavailable"
    assert gone["event"]["issues"] == [
        {"code": "site_unavailable", "severity": "error"}
    ]
    assert gone["event"]["site_name"] == "Home"
    assert gone["event"]["nodes"] == []

    facade.async_update_listeners()
    await _assert_no_event(client, 60)

    runtime.config_coordinator.data["sites"] = sites
    facade.async_update_listeners()
    back = await client.receive_json()
    assert back["type"] == "event"
    assert back["event"]["status"] == "ok"
    assert back["event"]["revision"] == initial["revision"]


async def test_subscribe_errors_use_get_codes(
    hass: HomeAssistant, init_integration: MockConfigEntry, hass_ws_client
) -> None:
    """Subscribe rejects the same bad requests as get."""
    _seed(init_integration)
    client = await hass_ws_client(hass)

    await client.send_json(
        {
            "id": 1,
            "type": "unifi_insights/topology/subscribe",
            "entry_id": init_integration.entry_id,
            "site_id": "site-9",
        }
    )
    msg = await client.receive_json()

    assert msg["error"]["code"] == "site_not_selected"


async def test_unsubscribe_stops_pushes(
    hass: HomeAssistant, init_integration: MockConfigEntry, hass_ws_client
) -> None:
    """After unsubscribe_events, changes are no longer pushed."""
    data = _seed(init_integration)
    facade = init_integration.runtime_data.coordinator
    client = await hass_ws_client(hass)
    await _subscribe(client, init_integration, msg_id=7)

    await client.send_json({"id": 8, "type": "unsubscribe_events", "subscription": 7})
    assert (await client.receive_json())["success"]

    data["devices"][SITE]["uuid-ap"]["name"] = "Changed"
    facade.async_update_listeners()
    await _assert_no_event(client, 9)


async def test_subscribe_entry_unload_sends_final_snapshot(
    hass: HomeAssistant, init_integration: MockConfigEntry, hass_ws_client
) -> None:
    """Unloading the entry pushes an unavailable snapshot and ends the stream."""
    _seed(init_integration)
    client = await hass_ws_client(hass)
    await _subscribe(client, init_integration)

    await hass.config_entries.async_unload(init_integration.entry_id)
    await hass.async_block_till_done()

    final = await client.receive_json()
    assert final["type"] == "event"
    assert final["event"]["status"] == "unavailable"
    assert final["event"]["issues"] == [{"code": "entry_unloaded", "severity": "error"}]
    assert final["event"]["site_name"] == "Home"


async def test_subscribe_unload_then_close_is_safe(
    hass: HomeAssistant,
    init_integration: MockConfigEntry,
    hass_ws_client,
    caplog,
) -> None:
    """Unload followed by connection close never removes the listener twice."""
    _seed(init_integration)
    client = await hass_ws_client(hass)
    await _subscribe(client, init_integration)

    await hass.config_entries.async_unload(init_integration.entry_id)
    await hass.async_block_till_done()
    await client.receive_json()  # final unavailable snapshot

    # A second remove_listener() raises KeyError, but ActiveConnection's close
    # handler catches every unsubscribe error and only logs it - so the proof
    # that nothing ran twice is the absence of an ERROR record, not a raise.
    with caplog.at_level(logging.ERROR):
        await client.close()
        await hass.async_block_till_done()

    errors = [rec for rec in caplog.records if rec.levelno >= logging.ERROR]
    assert not errors, [rec.getMessage() for rec in errors]


async def test_subscribe_close_then_unload_is_safe(
    hass: HomeAssistant, init_integration: MockConfigEntry, hass_ws_client
) -> None:
    """Connection close followed by unload never removes the listener twice."""
    _seed(init_integration)
    client = await hass_ws_client(hass)
    await _subscribe(client, init_integration)

    await client.close()
    await hass.async_block_till_done()
    assert await hass.config_entries.async_unload(init_integration.entry_id)
    await hass.async_block_till_done()

    assert init_integration.state is ConfigEntryState.NOT_LOADED


async def test_subscribe_cycles_share_one_unload_hook(
    hass: HomeAssistant, init_integration: MockConfigEntry, hass_ws_client
) -> None:
    """Repeated subscribe/unsubscribe adds at most one unload hook per entry."""
    _seed(init_integration)
    client = await hass_ws_client(hass)
    # _on_unload is private, but async_on_unload returns no remover, so the
    # hook list itself is the only place a per-subscription leak would show.
    hooks_before = len(init_integration._on_unload or [])

    for cycle in range(3):
        sub_id = 10 + cycle * 2
        await _subscribe(client, init_integration, msg_id=sub_id)
        await client.send_json(
            {"id": sub_id + 1, "type": "unsubscribe_events", "subscription": sub_id}
        )
        assert (await client.receive_json())["success"]

    assert len(init_integration._on_unload or []) <= hooks_before + 1
    watchers = hass.data[f"{DOMAIN}_topology_unload_watchers"]
    assert not watchers[init_integration.entry_id]


async def test_subscribe_builder_error_does_not_break_listeners(
    hass: HomeAssistant,
    init_integration: MockConfigEntry,
    hass_ws_client,
    caplog,
) -> None:
    """A builder bug is logged; other coordinator listeners still run."""
    _seed(init_integration)
    facade = init_integration.runtime_data.coordinator
    client = await hass_ws_client(hass)
    await _subscribe(client, init_integration)

    calls: list[str] = []
    facade.async_add_listener(lambda: calls.append("entity"))
    with (
        caplog.at_level(logging.ERROR),
        patch(
            "custom_components.unifi_insights.websocket_api.build_site_topology",
            side_effect=RuntimeError("boom"),
        ),
    ):
        facade.async_update_listeners()

    assert calls == ["entity"]
    assert "topology" in caplog.text.lower()
