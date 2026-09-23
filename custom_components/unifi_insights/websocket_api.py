"""
WebSocket API exposing the network topology graph to the frontend.

Commands are available to any authenticated user (dashboards are used by
non-admins); privacy comes from the topology builder's field allowlist and
from scoping every request to one loaded entry and one selected site.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import callback
from homeassistant.helpers import device_registry as dr

from .const import DOMAIN
from .topology import MAX_CLIENTS_PER_SITE, build_site_topology, site_display_name

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

    from . import UnifiInsightsConfigEntry
    from .topology import SiteTopology

ERR_ENTRY_NOT_FOUND = "entry_not_found"
ERR_ENTRY_NOT_LOADED = "entry_not_loaded"
ERR_SITE_NOT_SELECTED = "site_not_selected"

_MAX_CLIENTS = vol.All(vol.Coerce(int), vol.Range(min=0, max=MAX_CLIENTS_PER_SITE))
_SNAPSHOT_SCHEMA: dict[str | vol.Marker, Any] = {
    vol.Required("entry_id"): str,
    vol.Required("site_id"): str,
    vol.Optional("max_clients", default=MAX_CLIENTS_PER_SITE): _MAX_CLIENTS,
}


class _RequestError(Exception):
    """A request that cannot be served, carrying a WebSocket error code."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@callback
def async_register_websocket_commands(hass: HomeAssistant) -> None:
    """Register the topology WebSocket commands (once per HA instance)."""
    websocket_api.async_register_command(hass, ws_topology_sources)
    websocket_api.async_register_command(hass, ws_topology_get)


def _resolve_entry(hass: HomeAssistant, entry_id: str) -> UnifiInsightsConfigEntry:
    """Return a loaded UniFi Insights entry or raise _RequestError."""
    entry = hass.config_entries.async_get_entry(entry_id)
    if entry is None or entry.domain != DOMAIN:
        msg = f"No UniFi Insights config entry {entry_id}"
        raise _RequestError(ERR_ENTRY_NOT_FOUND, msg)
    if (
        entry.state is not ConfigEntryState.LOADED
        or getattr(entry, "runtime_data", None) is None
    ):
        msg = f"UniFi Insights config entry {entry_id} is not loaded"
        raise _RequestError(ERR_ENTRY_NOT_LOADED, msg)
    return entry


def _ha_device_ids(
    hass: HomeAssistant, data: dict[str, Any], site_id: str
) -> dict[str, str]:
    """Map the site's device ids to their Home Assistant device registry ids."""
    registry = dr.async_get(hass)
    devices = data.get("devices", {}).get(site_id, {})
    result: dict[str, str] = {}
    for device_id in devices if isinstance(devices, dict) else ():
        device = registry.async_get_device(
            identifiers={(DOMAIN, f"{site_id}_{device_id}")}
        )
        if device is not None:
            result[device_id] = device.id
    return result


def _build_snapshot(
    hass: HomeAssistant,
    entry: UnifiInsightsConfigEntry,
    site_id: str,
    max_clients: int,
) -> SiteTopology:
    """Build one site's snapshot, enforcing that the site is selected."""
    runtime = entry.runtime_data
    if site_id not in runtime.config_coordinator.get_site_ids():
        msg = f"Site {site_id} is not enabled for this UniFi Insights entry"
        raise _RequestError(ERR_SITE_NOT_SELECTED, msg)
    facade = runtime.coordinator
    return build_site_topology(
        facade.data,
        entry.entry_id,
        site_id,
        ha_device_ids=_ha_device_ids(hass, facade.data, site_id),
        max_clients=max_clients,
        devices_available=facade.device_available,
    )


@websocket_api.websocket_command(
    {vol.Required("type"): "unifi_insights/topology/sources"}
)
@callback
def ws_topology_sources(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """List loaded entries and their selected sites for the card editor."""
    sources = []
    for entry in hass.config_entries.async_loaded_entries(DOMAIN):
        runtime = getattr(entry, "runtime_data", None)
        if runtime is None:
            continue
        data = runtime.coordinator.data
        sources.append(
            {
                "entry_id": entry.entry_id,
                "title": entry.title,
                "sites": [
                    {"id": site_id, "name": site_display_name(data, site_id)}
                    for site_id in runtime.config_coordinator.get_site_ids()
                ],
            }
        )
    connection.send_result(msg["id"], sources)


@websocket_api.websocket_command(
    {vol.Required("type"): "unifi_insights/topology/get", **_SNAPSHOT_SCHEMA}
)
@callback
def ws_topology_get(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return one site's topology snapshot."""
    try:
        entry = _resolve_entry(hass, msg["entry_id"])
        snapshot = _build_snapshot(hass, entry, msg["site_id"], msg["max_clients"])
    except _RequestError as err:
        connection.send_error(msg["id"], err.code, str(err))
        return
    connection.send_result(msg["id"], snapshot)
