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
from homeassistant.util.hass_dict import HassKey

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


def _snapshot_inputs(
    hass: HomeAssistant, entry: UnifiInsightsConfigEntry, site_id: str
) -> tuple[object, ...]:
    """
    Return what one site's snapshot is built from, for cheap change detection.

    The coordinators publish each poll by replacing the per-site dicts (the
    device coordinator builds fresh ``devices``/``clients`` dicts per site,
    the config coordinator a fresh ``sites`` dict), never by mutating them in
    place, so object identity says whether the data changed. The registry
    size stands in for the ``ha_device_id`` links: it changes when a device
    is first registered or removed. Any other registry-only change is picked
    up at the next data poll.
    """
    runtime = entry.runtime_data
    data = runtime.coordinator.data
    per_site = []
    for section in ("devices", "clients", "client_links"):
        by_site = data.get(section)
        per_site.append(by_site.get(site_id) if isinstance(by_site, dict) else None)
    return (
        data.get("sites"),
        *per_site,
        runtime.coordinator.device_available,
        site_id in runtime.config_coordinator.get_site_ids(),
        len(dr.async_get(hass).devices),
    )


def _same_inputs(old: tuple[object, ...], new: tuple[object, ...]) -> bool:
    """
    Compare inputs by identity (data dicts) or value (flags and counts).

    The previous inputs hold the dicts themselves rather than their id(), so
    a replaced dict stays alive and its address cannot be reused by a new
    one and mistaken for "unchanged".
    """
    return all(
        a is b or (isinstance(a, int) and a == b) for a, b in zip(old, new, strict=True)
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
ISSUE_SITE_UNAVAILABLE = "site_unavailable"

# hass.data key: entry_id -> callbacks to run when that entry unloads.
_UNLOAD_WATCHERS: HassKey[dict[str, set[Callable[[], None]]]] = HassKey(
    f"{DOMAIN}_topology_unload_watchers"
)


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
    watchers = hass.data.setdefault(_UNLOAD_WATCHERS, {})
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
    whichever comes first, and only once (Home Assistant's remove-listener
    callback raises if called twice). The paths cannot overlap: unload pops
    the subscription from connection.subscriptions before the connection
    could call it, and unsubscribing stops watching the entry, so the unload
    hook never reaches it afterwards. The ``removed`` flag is belt and
    braces on top of that. Unload is observed via one shared hook per entry
    (_async_watch_unload), so repeated subscriptions leave nothing behind on
    the entry.
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
    last_inputs = _snapshot_inputs(hass, entry, site_id)
    site_name = snapshot["site_name"]
    removed = False

    @callback
    def _async_forward() -> None:
        nonlocal last_inputs, last_revision, site_name
        # The facade notifies on every sub-coordinator update, including each
        # Protect WebSocket message, so skip the rebuild (registry lookups,
        # JSON and a hash) unless something the snapshot reads has changed.
        inputs = _snapshot_inputs(hass, entry, site_id)
        if _same_inputs(inputs, last_inputs):
            return
        last_inputs = inputs
        try:
            update = _build_snapshot(hass, entry, site_id, max_clients)
        except _RequestError:
            # The site left the selection without an entry reload: it was
            # deleted on the console, or the Network API went away and the
            # config coordinator dropped its sites. Report that once (the
            # revision dedupes repeats) and keep listening, so the stream
            # recovers on its own when the site comes back. Deselecting the
            # site in the options reloads the entry instead, which ends the
            # stream through _async_entry_unloaded.
            update = build_unavailable_topology(
                entry.entry_id, site_id, site_name, ISSUE_SITE_UNAVAILABLE
            )
        except Exception:
            # Home Assistant already isolates listener failures, but its log
            # line names neither the feature nor the site. Log a clear
            # per-site error instead; last_revision is untouched, so the
            # next good build is compared against what the card last got.
            _LOGGER.exception("Failed to rebuild the topology snapshot for %s", site_id)
            return
        if update["revision"] == last_revision:
            return
        last_revision = update["revision"]
        site_name = update["site_name"]
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
