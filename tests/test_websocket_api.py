"""Tests for the topology WebSocket API."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

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
