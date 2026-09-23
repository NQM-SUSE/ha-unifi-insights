"""
WebSocket API exposing the network topology graph to the frontend.

Commands are available to any authenticated user (dashboards are used by
non-admins); privacy comes from the topology builder's field allowlist and
from scoping every request to one loaded entry and one selected site.
"""

from __future__ import annotations

import logging
from functools import partial
from typing import TYPE_CHECKING, Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import callback
from homeassistant.helpers import device_registry as dr

from .const import DOMAIN
from .topology import (
    MAX_CLIENTS_PER_SITE,
    build_site_topology,
    build_unavailable_topology,
    site_display_name,
)

if TYPE_CHECKING:
    from collections.abc import Callable

    from homeassistant.core import HomeAssistant

    from . import UnifiInsightsConfigEntry
    from .topology import SiteTopology

_LOGGER = logging.getLogger(__name__)

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
    websocket_api.async_register_command(hass, ws_topology_subscribe)


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


ISSUE_ENTRY_UNLOADED = "entry_unloaded"

# hass.data key: entry_id -> callbacks to run when that entry unloads.
_UNLOAD_WATCHERS = f"{DOMAIN}_topology_unload_watchers"


@callback
def _async_watch_unload(
    hass: HomeAssistant,
    entry: UnifiInsightsConfigEntry,
    watcher: Callable[[], None],
) -> Callable[[], None]:
    """
    Call watcher when the entry unloads and return a callback that cancels it.

    ConfigEntry.async_on_unload has no remover, so registering one hook per
    subscription would leave a dead closure on the entry for every
    subscribe/unsubscribe cycle. Instead each loaded entry gets a single
    hook that drains a watcher set; subscriptions add and discard themselves.
    Unloading pops the set, so a reloaded entry gets a fresh hook.
    """
    watchers: dict[str, set[Callable[[], None]]] = hass.data.setdefault(
        _UNLOAD_WATCHERS, {}
    )
    entry_watchers = watchers.get(entry.entry_id)
    if entry_watchers is None:
        entry_watchers = watchers[entry.entry_id] = set()

        @callback
        def _async_notify() -> None:
            for pending in list(watchers.pop(entry.entry_id, ())):
                pending()

        entry.async_on_unload(_async_notify)
    entry_watchers.add(watcher)
    return partial(entry_watchers.discard, watcher)


@websocket_api.websocket_command(
    {vol.Required("type"): "unifi_insights/topology/subscribe", **_SNAPSHOT_SCHEMA}
)
@callback
def ws_topology_subscribe(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """
    Stream one site's snapshot, pushing only when its revision changes.

    The listener rides on the facade coordinator, which never polls on its
    own, so a subscription adds no API traffic. It is removed when the client
    unsubscribes, when the connection closes, or when the entry unloads -
    whichever comes first; the removal is idempotent because Home Assistant's
    remove-listener callback raises if called twice. Unload is observed via
    one shared hook per entry (_async_watch_unload), and unsubscribing stops
    watching, so repeated subscriptions leave nothing behind on the entry.
    """
    msg_id: int = msg["id"]
    site_id: str = msg["site_id"]
    max_clients: int = msg["max_clients"]
    try:
        entry = _resolve_entry(hass, msg["entry_id"])
        snapshot = _build_snapshot(hass, entry, site_id, max_clients)
    except _RequestError as err:
        connection.send_error(msg_id, err.code, str(err))
        return

    last_revision = snapshot["revision"]
    site_name = snapshot["site_name"]
    removed = False

    @callback
    def _async_forward() -> None:
        nonlocal last_revision
        try:
            update = _build_snapshot(hass, entry, site_id, max_clients)
        except _RequestError:
            # The site was deselected; the options change reloads the entry,
            # which ends this subscription through _async_entry_unloaded.
            return
        except Exception:
            # Never let a builder bug escape: this runs inside the
            # coordinator's listener loop, and raising would stop every
            # entity on the entry from updating.
            _LOGGER.exception("Failed to rebuild the topology snapshot for %s", site_id)
            return
        if update["revision"] == last_revision:
            return
        last_revision = update["revision"]
        connection.send_message(websocket_api.event_message(msg_id, update))

    remove_listener = entry.runtime_data.coordinator.async_add_listener(_async_forward)

    @callback
    def _async_unsubscribe() -> None:
        nonlocal removed
        if removed:
            return
        removed = True
        remove_listener()
        stop_watching()

    @callback
    def _async_entry_unloaded() -> None:
        if removed:
            return
        _async_unsubscribe()
        connection.subscriptions.pop(msg_id, None)
        connection.send_message(
            websocket_api.event_message(
                msg_id,
                build_unavailable_topology(
                    entry.entry_id, site_id, site_name, ISSUE_ENTRY_UNLOADED
                ),
            )
        )

    stop_watching = _async_watch_unload(hass, entry, _async_entry_unloaded)
    connection.subscriptions[msg_id] = _async_unsubscribe
    connection.send_result(msg_id)
    connection.send_message(websocket_api.event_message(msg_id, snapshot))
