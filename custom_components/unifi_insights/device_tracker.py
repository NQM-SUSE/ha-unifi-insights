"""Support for UniFi Insights device tracker."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from homeassistant.components.device_tracker import ScannerEntity
from homeassistant.components.device_tracker.const import SourceType
from homeassistant.core import callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import (
    CONF_TRACK_CLIENTS,
    CONF_TRACK_WIFI_CLIENTS,
    CONF_TRACK_WIRED_CLIENTS,
    DEFAULT_TRACK_CLIENTS,
    DOMAIN,
    MANUFACTURER,
)
from .coordinators import UnifiFacadeCoordinator
from .entity import get_client_type as _get_client_type, get_field

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant
    from homeassistant.helpers.entity_platform import AddEntitiesCallback

    from . import UnifiInsightsConfigEntry

_LOGGER = logging.getLogger(__name__)

# Coordinator handles updates centrally
PARALLEL_UPDATES = 0


def _client_should_be_tracked(
    client_data: dict[str, Any],
    *,
    track_wifi: bool,
    track_wired: bool,
) -> bool:
    """Return True if a connected client should be tracked per the options."""
    client_type = _get_client_type(client_data)
    if client_type == "WIRELESS":
        return track_wifi
    if client_type == "WIRED":
        return track_wired
    # Unknown type: track only if any tracking is enabled.
    return track_wifi or track_wired


def _partition_connected_clients(
    coordinator: UnifiFacadeCoordinator,
    *,
    track_wifi: bool,
    track_wired: bool,
) -> tuple[dict[str, str], set[str]]:
    """Split connected clients into tracked (MAC -> site_id) and untracked MACs."""
    wanted: dict[str, str] = {}
    untracked: set[str] = set()
    for site_id, clients in coordinator.data.get("clients", {}).items():
        if not isinstance(clients, dict):
            continue
        for client_data in clients.values():
            mac = get_field(client_data, "macAddress", "mac_address", "mac", default="")
            if not mac:
                continue
            if _client_should_be_tracked(
                client_data, track_wifi=track_wifi, track_wired=track_wired
            ):
                wanted[mac.lower()] = site_id
            else:
                untracked.add(mac.lower())
    return wanted, untracked


def _connected_clients_to_track(
    coordinator: UnifiFacadeCoordinator,
    *,
    track_wifi: bool,
    track_wired: bool,
) -> dict[str, str]:
    """Map MAC (lowercase) -> site_id for connected clients that should track."""
    wanted, _ = _partition_connected_clients(
        coordinator, track_wifi=track_wifi, track_wired=track_wired
    )
    return wanted


def _client_tracker_entries(
    registry: er.EntityRegistry, entry_id: str
) -> list[er.RegistryEntry]:
    """Return this platform's device_tracker entries for a config entry."""
    return [
        reg_entry
        for reg_entry in er.async_entries_for_config_entry(registry, entry_id)
        if reg_entry.domain == "device_tracker" and reg_entry.platform == DOMAIN
    ]


def _migrate_tracker_unique_ids(
    registry: er.EntityRegistry, client_trackers: list[er.RegistryEntry]
) -> None:
    """
    Re-key trackers registered under the bare MAC to the MAC-derived id.

    Before this platform declared its own `unique_id`, `ScannerEntity` supplied
    it from the live `mac_address`, so existing entries are keyed by the raw MAC
    as the API spelled it. Rename them in place rather than letting them be
    orphaned, which would lose the user's name, area and entity_id.
    """
    prefix = f"{DOMAIN}_"
    known = {reg_entry.unique_id for reg_entry in client_trackers}
    for reg_entry in client_trackers:
        if reg_entry.unique_id.startswith(prefix):
            continue
        new_unique_id = f"{prefix}{reg_entry.unique_id.lower()}"
        if new_unique_id in known:
            _LOGGER.warning(
                "Cannot migrate client tracker %s to unique_id %s: already in use",
                reg_entry.entity_id,
                new_unique_id,
            )
            continue
        _LOGGER.debug(
            "Migrating client tracker %s unique_id %s -> %s",
            reg_entry.entity_id,
            reg_entry.unique_id,
            new_unique_id,
        )
        registry.async_update_entity(reg_entry.entity_id, new_unique_id=new_unique_id)
        known.add(new_unique_id)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: UnifiInsightsConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up device tracker for UniFi Insights integration."""
    coordinator = entry.runtime_data.coordinator

    # Check which client types to track (support both old and new options).
    # Migrate from the old single option if the new options are not set.
    old_track_clients = entry.options.get(CONF_TRACK_CLIENTS, DEFAULT_TRACK_CLIENTS)
    track_wifi = entry.options.get(CONF_TRACK_WIFI_CLIENTS, old_track_clients)
    track_wired = entry.options.get(CONF_TRACK_WIRED_CLIENTS, old_track_clients)

    _LOGGER.debug("Client tracking - WiFi: %s, Wired: %s", track_wifi, track_wired)

    # Reconcile the entity registry with the current options. This runs on every
    # setup, including option-change reloads.
    #
    # Only remove a tracker when the configuration says it is unwanted: either
    # tracking is off entirely, or the client is currently connected with a type
    # that is no longer tracked.
    #
    # A client merely missing from the connected-client snapshot is NOT evidence
    # that its tracker should go -- it may be powered off or roaming, or the poll
    # behind `coordinator.data` may have failed or not run yet. Removing the
    # registry entry is permanent and destroys the user's name, area, and
    # entity_id customisation, and reporting `not_home` for an absent device is
    # the entire purpose of a device tracker.
    registry = er.async_get(hass)
    client_trackers = _client_tracker_entries(registry, entry.entry_id)

    if not track_wifi and not track_wired:
        for reg_entry in client_trackers:
            _LOGGER.debug(
                "Removing client tracker %s (client tracking disabled)",
                reg_entry.entity_id,
            )
            registry.async_remove(reg_entry.entity_id)
        _LOGGER.debug("Client tracking disabled - no client trackers created")
        return

    # Re-key legacy entries before anything compares unique_ids, so the
    # reconciliation below and the retained trackers all speak the same
    # identifier. Deliberately after the early return above: entries that are
    # about to be removed are not worth renaming first.
    _migrate_tracker_unique_ids(registry, client_trackers)
    client_trackers = _client_tracker_entries(registry, entry.entry_id)

    connected_macs, untracked_macs = _partition_connected_clients(
        coordinator, track_wifi=track_wifi, track_wired=track_wired
    )
    untracked_unique_ids = {f"{DOMAIN}_{mac}" for mac in untracked_macs}
    surviving: list[er.RegistryEntry] = []
    for reg_entry in client_trackers:
        if reg_entry.unique_id in untracked_unique_ids:
            _LOGGER.debug(
                "Removing client tracker %s (client type no longer tracked)",
                reg_entry.entity_id,
            )
            registry.async_remove(reg_entry.entity_id)
            continue
        surviving.append(reg_entry)

    # Per-setup dedup set (recreated on every reload so re-enabling re-adds
    # entities); MAC is globally unique so it is used as the key.
    tracked: set[str] = set()

    # Every surviving registry entry gets a live entity, even when its client is
    # absent from the current snapshot. A registry entry with no entity behind it
    # is restored as "unavailable" and stays that way until the client happens to
    # reconnect; adding the entity now makes it report `not_home` instead, which
    # is what a device tracker is for. Seeding `tracked` here is what stops
    # `async_add_clients` adding a second entity with the same unique_id when a
    # retained client comes back.
    prefix = f"{DOMAIN}_"
    retained: list[UnifiClientTracker] = []
    for reg_entry in surviving:
        if not reg_entry.unique_id.startswith(prefix):
            continue
        mac = reg_entry.unique_id[len(prefix) :].lower()
        retained.append(
            UnifiClientTracker(
                coordinator=coordinator,
                mac=mac,
                site_id=connected_macs.get(mac),
                restored_name=reg_entry.original_name,
            )
        )
        tracked.add(mac)
    if retained:
        _LOGGER.debug("Restoring %d client tracker(s) from the registry", len(retained))
        async_add_entities(retained)

    @callback
    def async_add_clients() -> None:
        """Add trackers for currently connected clients of the enabled types."""
        current = _connected_clients_to_track(
            coordinator, track_wifi=track_wifi, track_wired=track_wired
        )
        entities = [
            UnifiClientTracker(coordinator=coordinator, mac=mac, site_id=site_id)
            for mac, site_id in current.items()
            if mac not in tracked
        ]
        tracked.update(current)
        if entities:
            async_add_entities(entities)

    # Initial setup
    async_add_clients()

    # Listen for new clients connecting later
    entry.async_on_unload(coordinator.async_add_listener(async_add_clients))


class UnifiClientTracker(CoordinatorEntity[UnifiFacadeCoordinator], ScannerEntity):
    """Representation of a UniFi network client."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: UnifiFacadeCoordinator,
        mac: str,
        site_id: str | None = None,
        restored_name: str | None = None,
    ) -> None:
        """
        Initialize the tracker.

        `site_id` is only a starting hint and may be None for a tracker restored
        from the registry, which knows the MAC but not where it last connected.
        `restored_name` is the name the registry kept for such a tracker.
        """
        super().__init__(coordinator)
        self._site_id = site_id
        self._mac = mac.lower()

        # Get initial client data
        client_data = self._get_client_data() or {}

        # Set unique ID based on MAC address for stability
        self._attr_unique_id = f"{DOMAIN}_{self._mac}"

        # Set name from client data. With no live data, prefer the name the
        # registry retained over the "Client <mac>" placeholder, so restoring an
        # offline client does not rewrite what the user already sees.
        self._attr_name = get_field(
            client_data,
            "name",
            "hostname",
            default=restored_name or f"Client {self._mac}",
        )

        # Device info - associate with connected network device (switch/AP)
        # This groups client trackers under their uplink device for cleaner UI.
        # It is built once, from whatever data exists at construction time: a
        # client that is offline at setup has no uplink to group under, so it
        # lands on the standalone-client device below and only settles under its
        # uplink on the next reload after the client reconnects.
        uplink_device_id = get_field(client_data, "uplinkDeviceId", "uplink_device_id")
        if uplink_device_id:
            # Use the network device's identifiers to group under it
            self._device_info = DeviceInfo(
                identifiers={(DOMAIN, f"{self._site_id}_{uplink_device_id}")},
            )
        else:
            # Fallback: create a standalone client device if no uplink found
            model = get_field(
                client_data, "deviceName", "osName", default="Network Client"
            )
            self._device_info = DeviceInfo(
                identifiers={(DOMAIN, f"client_{self._mac}")},
                name=self._attr_name,
                manufacturer=MANUFACTURER,
                model=model,
            )

    @property
    def unique_id(self) -> str | None:
        """
        Return the unique ID of the entity.

        `ScannerEntity.unique_id` returns `mac_address`, which is read from the
        live client payload and is therefore None whenever the client is absent.
        A tracker restored from the registry has no payload at all, so identity
        has to come from the MAC it was built with instead.
        """
        return self._attr_unique_id

    @property  # type: ignore[misc]
    def device_info(self) -> DeviceInfo:
        """Return device info."""
        return self._device_info

    def _find_in_site(self, clients: Any) -> dict[str, Any] | None:
        """Return this MAC's entry within one site's client snapshot."""
        if not isinstance(clients, dict):
            return None
        for client_data in clients.values():
            if not isinstance(client_data, dict):
                continue
            mac = get_field(client_data, "macAddress", "mac_address", "mac", default="")
            if mac and mac.lower() == self._mac:
                return client_data
        return None

    def _get_client_data(self) -> dict[str, Any] | None:
        """
        Get connected-client data for this MAC, if currently connected.

        The MAC, not the site, identifies the client. `self._site_id` is only a
        hint: check it first (the common case), then fall back to scanning every
        site so a roamed client -- or one restored from the registry with no hint
        at all -- is still found. Remember where it turned up for next time.
        """
        all_clients = self.coordinator.data.get("clients", {})
        if not isinstance(all_clients, dict):
            return None
        if self._site_id is not None:
            client_data = self._find_in_site(all_clients.get(self._site_id, {}))
            if client_data is not None:
                return client_data
        for site_id, clients in all_clients.items():
            if site_id == self._site_id:
                continue
            client_data = self._find_in_site(clients)
            if client_data is not None:
                self._site_id = site_id
                return client_data
        return None

    @property
    def is_connected(self) -> bool:
        """Return true if the client is connected."""
        client_data = self._get_client_data()
        if not client_data:
            return False
        return bool(get_field(client_data, "connected", default=False))

    @property
    def source_type(self) -> SourceType:
        """Return the source type."""
        return SourceType.ROUTER

    @property
    def ip_address(self) -> str | None:
        """Return the IP address of the client."""
        client_data = self._get_client_data()
        if not client_data:
            return None
        return get_field(client_data, "ipAddress", "ip_address", "ip")  # type: ignore[no-any-return]

    @property
    def mac_address(self) -> str | None:
        """Return the MAC address of the client."""
        client_data = self._get_client_data()
        if not client_data:
            return None
        return get_field(client_data, "macAddress", "mac_address", "mac")  # type: ignore[no-any-return]

    @property
    def hostname(self) -> str | None:
        """Return the hostname of the client."""
        client_data = self._get_client_data()
        if not client_data:
            return None
        return get_field(client_data, "hostname", "name")  # type: ignore[no-any-return]

    @property
    def available(self) -> bool:
        """Return True if entity is available."""
        return bool(self.coordinator.last_update_success)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return extra state attributes."""
        client_data = self._get_client_data()
        if not client_data:
            return {}

        return {
            "connection_type": get_field(client_data, "type", "connection_type"),
            "connected_at": get_field(client_data, "connectedAt", "connected_at"),
            "uplink_device_id": get_field(
                client_data, "uplinkDeviceId", "uplink_device_id"
            ),
            "authorized": get_field(client_data, "authorized", default=True),
            "blocked": get_field(client_data, "blocked", default=False),
        }
