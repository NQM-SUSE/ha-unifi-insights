"""Services for the UniFi Insights integration."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

import voluptuous as vol
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError
from homeassistant.helpers import (
    config_validation as cv,
)
from homeassistant.helpers import (
    device_registry as dr,
)
from homeassistant.helpers import (
    entity_registry as er,
)

from .const import (
    CHIME_RINGTONE_CHRISTMAS,
    CHIME_RINGTONE_CUSTOM_1,
    CHIME_RINGTONE_CUSTOM_2,
    CHIME_RINGTONE_DEFAULT,
    CHIME_RINGTONE_DIGITAL,
    CHIME_RINGTONE_MECHANICAL,
    CHIME_RINGTONE_TRADITIONAL,
    DOMAIN,
    HDR_MODE_AUTO,
    HDR_MODE_OFF,
    HDR_MODE_ON,
    LIGHT_MODE_ALWAYS,
    LIGHT_MODE_MOTION,
    LIGHT_MODE_OFF,
    SERVICE_AUTHORIZE_GUEST,
    SERVICE_CREATE_LIVEVIEW,
    SERVICE_DELETE_VOUCHER,
    SERVICE_GENERATE_VOUCHER,
    SERVICE_PLAY_CHIME_RINGTONE,
    SERVICE_PTZ_MOVE,
    SERVICE_PTZ_PATROL,
    SERVICE_SET_CHIME_REPEAT_TIMES,
    SERVICE_SET_CHIME_RINGTONE,
    SERVICE_SET_CHIME_VOLUME,
    SERVICE_SET_HDR_MODE,
    SERVICE_SET_LIGHT_LEVEL,
    SERVICE_SET_LIGHT_MODE,
    SERVICE_SET_LIVEVIEW,
    SERVICE_SET_MIC_VOLUME,
    SERVICE_SET_RECORDING_MODE,
    SERVICE_SET_VIDEO_MODE,
    SERVICE_TRIGGER_ALARM,
    VIDEO_MODE_DEFAULT,
    VIDEO_MODE_HIGH_FPS,
    VIDEO_MODE_SLOW_SHUTTER,
    VIDEO_MODE_SPORT,
)

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant, ServiceCall


_LOGGER = logging.getLogger(__name__)


def _get_coordinators(hass: HomeAssistant) -> list[Any]:
    """Get all UniFi Insights coordinators from config entries."""
    return [
        entry.runtime_data.coordinator
        for entry in hass.config_entries.async_entries(DOMAIN)
        if hasattr(entry, "runtime_data") and entry.runtime_data
    ]


def _coord_data(entry: Any) -> dict[str, Any] | None:
    """Extract coordinator data dictionary if available and valid."""
    runtime_data = getattr(entry, "runtime_data", None)
    coord = getattr(runtime_data, "coordinator", None) if runtime_data else None
    if coord and hasattr(coord, "data") and isinstance(coord.data, dict):
        return coord.data
    return None


def _entry_has_site(entry: Any, site_id: str) -> bool:
    """Check if config entry owns the given site ID."""
    data = _coord_data(entry)
    if data is None:
        return True
    sites = data.get("sites")
    if not isinstance(sites, dict):
        return True
    return site_id in sites


def _entry_has_device(entry: Any, site_id: str | None, device_id: str) -> bool:
    """Check if config entry owns the given device ID."""
    data = _coord_data(entry)
    if data is None:
        return True
    devices = data.get("devices")
    if not isinstance(devices, dict):
        return True
    if site_id is not None:
        site_devices = devices.get(site_id)
        if not isinstance(site_devices, dict):
            return True
        return device_id in site_devices
    return any(
        isinstance(devs, dict) and device_id in devs for devs in devices.values()
    )


def _entry_owns_device(entry: Any, site_id: str | None, device_id: str) -> bool:
    """Return whether the entry's loaded data positively contains the device."""
    devices = _coord_section(entry, "devices")
    if devices is None:
        return False
    if site_id:
        site_devices = devices.get(site_id)
        if isinstance(site_devices, dict) and device_id in site_devices:
            return True
    return any(
        isinstance(devs, dict) and device_id in devs for devs in devices.values()
    )


def _entry_owns_client(entry: Any, site_id: str | None, client_id: str) -> bool:
    """Return whether the entry's loaded data positively contains the client."""
    clients = _coord_section(entry, "clients")
    if clients is None:
        return False
    if site_id:
        site_clients = clients.get(site_id)
        if isinstance(site_clients, dict) and _client_records_match(
            site_clients, client_id
        ):
            return True
    return any(
        isinstance(cls, dict) and _client_records_match(cls, client_id)
        for cls in clients.values()
    )


def _entry_has_client(entry: Any, site_id: str | None, client_id: str) -> bool:
    """Check if config entry owns the given client ID or MAC."""
    data = _coord_data(entry)
    if data is None:
        return True
    clients = data.get("clients")
    if not isinstance(clients, dict):
        return True
    if site_id is not None:
        site_clients = clients.get(site_id)
        if not isinstance(site_clients, dict):
            return True
        return _client_records_match(site_clients, client_id)
    return any(
        isinstance(cls, dict) and _client_records_match(cls, client_id)
        for cls in clients.values()
    )


def _coord_section(entry: Any, key: str) -> dict[str, Any] | None:
    """Return a top-level dict section of the entry's coordinator data."""
    data = _coord_data(entry)
    if data is None:
        return None
    section = data.get(key)
    return section if isinstance(section, dict) else None


def _mac_key(value: Any) -> str | None:
    """
    Reduce a MAC to a separator-free lowercase key, or None if it is not one.

    ``DeviceCoordinator._normalize_mac`` only strips and lowercases, because it
    builds lookup keys from raw API values. Here the input is whatever a user
    typed in an action call, so ``aa:bb``, ``AA-BB`` and ``aabb`` must all
    compare equal.
    """
    if not isinstance(value, str):
        return None
    key = value.strip().lower().replace(":", "").replace("-", "").replace(".", "")
    return key or None


def _client_records_match(records: dict[str, Any], client_id: str) -> bool:
    """Check a site's client records for an ID or MAC address match."""
    if client_id in records:
        return True
    wanted = _mac_key(client_id)
    if wanted is None:
        return False
    for record in records.values():
        if not isinstance(record, dict):
            continue
        for field in ("mac", "macAddress", "mac_address"):
            if _mac_key(record.get(field)) == wanted:
                return True
    return False


def _protect_owns_resource(
    entry: Any, collection_key: str, resource_id: str
) -> bool | None:
    """
    Return whether the entry positively owns a Protect resource.

    ``None`` means "cannot tell": the entry has loaded none of the collections
    that could hold the resource, so callers must not read the answer as the
    entry either owning or disowning it.
    """
    data = _coord_data(entry)
    if data is None:
        return None
    protect_data = data.get("protect")
    if not isinstance(protect_data, dict):
        return None
    collection = protect_data.get(collection_key)
    if not isinstance(collection, dict):
        return None
    return resource_id in collection


def _protect_entry_has_resource(
    entry: Any, collection_key: str, resource_id: str
) -> bool:
    """
    Check if a Protect config entry may own the given Protect resource ID.

    An entry that has not loaded the relevant data yet stays a candidate, so a
    console that is still warming up never silently loses a service call.
    """
    owns = _protect_owns_resource(entry, collection_key, resource_id)
    return True if owns is None else owns


def _get_coordinator_for_network_resource(
    hass: HomeAssistant,
    *,
    site_id: str | None = None,
    device_id: str | None = None,
    client_id: str | None = None,
) -> Any:
    """Get the UniFi Insights coordinator owning the specified network resource."""
    entries = [
        entry
        for entry in hass.config_entries.async_entries(DOMAIN)
        if hasattr(entry, "runtime_data") and entry.runtime_data
    ]
    if not entries:
        msg = "No UniFi Insights coordinator found"
        raise ServiceValidationError(msg)

    # 1. Check Home Assistant device and entity registries
    resolved_entry: Any | None = None
    if device_id and hasattr(hass, "data") and isinstance(hass.data, dict):
        if dr.DATA_REGISTRY in hass.data:
            dev_reg = dr.async_get(hass)
            dev_entry = dev_reg.async_get(device_id)
            if dev_entry and dev_entry.config_entries:
                matching_e = [
                    e for e in entries if e.entry_id in dev_entry.config_entries
                ]
                if matching_e:
                    resolved_entry = matching_e[0]
        if resolved_entry is None and er.DATA_REGISTRY in hass.data:
            ent_reg = er.async_get(hass)
            ent_entry = ent_reg.async_get(device_id)
            if ent_entry and ent_entry.config_entry_id:
                matching_e = [
                    e for e in entries if e.entry_id == ent_entry.config_entry_id
                ]
                if matching_e:
                    resolved_entry = matching_e[0]

    # 2. Filter entries by site_id
    if site_id is not None:
        matching_entries = [
            entry for entry in entries if _entry_has_site(entry, site_id)
        ]
        if not matching_entries:
            msg = f"Site '{site_id}' not found on any configured UniFi console"
            raise ServiceValidationError(msg)
    else:
        matching_entries = entries

    # If already resolved via registry, verify it conforms to site_id
    if resolved_entry is not None:
        if resolved_entry not in matching_entries:
            msg = (
                f"Device '{device_id}' belongs to a different console than"
                f" site '{site_id}'"
            )
            raise ServiceValidationError(msg)
        return resolved_entry.runtime_data.coordinator

    # 3. Filter / validate by device_id if specified
    if device_id is not None:
        entries_with_device = [
            entry
            for entry in matching_entries
            if _entry_has_device(entry, site_id, device_id)
        ]
        if not entries_with_device:
            cross_console_entries = [
                entry
                for entry in entries
                if entry not in matching_entries
                and _entry_has_device(entry, None, device_id)
            ]
            if cross_console_entries and site_id:
                msg = (
                    f"Device '{device_id}' belongs to a different console than"
                    f" site '{site_id}'"
                )
                raise ServiceValidationError(msg)
            msg = (
                f"Device '{device_id}' not found on console for site '{site_id}'"
                if site_id
                else f"Device '{device_id}' not found on any configured UniFi console"
            )
            raise ServiceValidationError(msg)

        if len(entries_with_device) > 1:
            explicit_matches = [
                e
                for e in entries_with_device
                if _entry_owns_device(e, site_id, device_id)
            ]
            if len(explicit_matches) == 1:
                return explicit_matches[0].runtime_data.coordinator
            msg = (
                f"Multiple consoles found for site '{site_id}' and device"
                f" '{device_id}'; target is ambiguous"
                if site_id
                else (
                    f"Multiple consoles found for device '{device_id}';"
                    " target is ambiguous"
                )
            )
            raise ServiceValidationError(msg)

        return entries_with_device[0].runtime_data.coordinator

    # 4. Filter by client_id if specified
    if client_id is not None and len(matching_entries) > 1:
        entries_with_client = [
            entry
            for entry in matching_entries
            if _entry_has_client(entry, site_id, client_id)
        ]
        if len(entries_with_client) == 1:
            return entries_with_client[0].runtime_data.coordinator
        owning_entries = [
            entry
            for entry in matching_entries
            if _entry_owns_client(entry, site_id, client_id)
        ]
        if len(owning_entries) == 1:
            return owning_entries[0].runtime_data.coordinator
        if len(owning_entries) > 1:
            msg = f"Multiple consoles contain client '{client_id}'; target is ambiguous"
            raise ServiceValidationError(msg)

    # 5. When multiple entries match site_id
    if len(matching_entries) > 1:
        explicit_matches = [
            entry
            for entry in matching_entries
            if site_id in (_coord_section(entry, "sites") or {})
        ]
        if len(explicit_matches) > 1:
            msg = f"Multiple consoles contain site '{site_id}'; target is ambiguous"
            raise ServiceValidationError(msg)
        if len(explicit_matches) == 1:
            return explicit_matches[0].runtime_data.coordinator

    return matching_entries[0].runtime_data.coordinator


def _entry_matches_console(entry: Any, console_id: str) -> bool:
    """Match a config entry by its entry ID or its title."""
    wanted = console_id.strip().lower()
    if str(getattr(entry, "entry_id", "")).lower() == wanted:
        return True
    return str(getattr(entry, "title", "")).strip().lower() == wanted


def _select_console(entries: list[Any], console_id: str, what: str) -> Any:
    """Pick the entry the user named, or explain why it could not be picked."""
    matches = [entry for entry in entries if _entry_matches_console(entry, console_id)]
    if len(matches) == 1:
        return matches[0]
    if not matches:
        known = ", ".join(sorted(str(getattr(e, "title", e.entry_id)) for e in entries))
        msg = (
            f"No configured {what} matches console '{console_id}'. Configured: {known}"
        )
        raise ServiceValidationError(msg)
    msg = f"Console '{console_id}' matches more than one {what}; use the entry ID"
    raise ServiceValidationError(msg)


def _get_coordinator_for_protect_resource(
    hass: HomeAssistant,
    *,
    resource_type: str | None = None,
    resource_id: str | None = None,
    secondary_resource_type: str | None = None,
    secondary_resource_id: str | None = None,
    console_id: str | None = None,
) -> Any:
    """Get the UniFi Protect coordinator owning the specified protect resource."""
    protect_entries = [
        entry
        for entry in hass.config_entries.async_entries(DOMAIN)
        if hasattr(entry, "runtime_data")
        and entry.runtime_data
        and getattr(entry.runtime_data.coordinator, "protect_client", None) is not None
    ]
    if not protect_entries:
        msg = "No UniFi Protect coordinator found"
        raise ServiceValidationError(msg)

    # 0. An explicit console always wins.
    if console_id:
        entry = _select_console(protect_entries, console_id, "UniFi Protect console")
        return entry.runtime_data.coordinator

    # 1. Check Home Assistant device and entity registries
    resolved_entry: Any | None = None
    if resource_id and hasattr(hass, "data") and isinstance(hass.data, dict):
        if dr.DATA_REGISTRY in hass.data:
            dev_reg = dr.async_get(hass)
            dev_entry = dev_reg.async_get(resource_id)
            if dev_entry and dev_entry.config_entries:
                matching_e = [
                    e for e in protect_entries if e.entry_id in dev_entry.config_entries
                ]
                if matching_e:
                    resolved_entry = matching_e[0]
        if resolved_entry is None and er.DATA_REGISTRY in hass.data:
            ent_reg = er.async_get(hass)
            ent_entry = ent_reg.async_get(resource_id)
            if ent_entry and ent_entry.config_entry_id:
                matching_e = [
                    e
                    for e in protect_entries
                    if e.entry_id == ent_entry.config_entry_id
                ]
                if matching_e:
                    resolved_entry = matching_e[0]

    if resource_type is None or resource_id is None:
        if resolved_entry is not None:
            return resolved_entry.runtime_data.coordinator
        if len(protect_entries) > 1:
            known = ", ".join(
                sorted(str(getattr(e, "title", e.entry_id)) for e in protect_entries)
            )
            msg = (
                "Multiple UniFi Protect consoles are configured and this action"
                " carries no target to route on; set 'console_id' to one of:"
                f" {known}"
            )
            raise ServiceValidationError(msg)
        return protect_entries[0].runtime_data.coordinator

    collection_key = {
        "camera": "cameras",
        "light": "lights",
        "chime": "chimes",
        "viewer": "viewers",
    }.get(resource_type, f"{resource_type}s")

    if resolved_entry is not None:
        matching_entries = [resolved_entry]
    else:
        matching_entries = [
            entry
            for entry in protect_entries
            if _protect_entry_has_resource(entry, collection_key, resource_id)
        ]

    if not matching_entries:
        msg = (
            f"{resource_type.capitalize()} '{resource_id}' not found on any"
            " configured UniFi Protect console"
        )
        raise ServiceValidationError(msg)

    if len(matching_entries) > 1:
        explicit_matches = [
            entry
            for entry in matching_entries
            if _protect_owns_resource(entry, collection_key, resource_id) is True
        ]
        if len(explicit_matches) == 1:
            matching_entries = explicit_matches
        elif len(explicit_matches) > 1:
            msg = (
                f"Multiple Protect consoles contain {resource_type} '{resource_id}';"
                " target is ambiguous"
            )
            raise ServiceValidationError(msg)
        else:
            # Nobody positively claims it and more than one console is still a
            # candidate: that only happens when their data has not loaded, so
            # say so instead of guessing at the first one.
            msg = (
                f"Cannot tell which Protect console owns {resource_type}"
                f" '{resource_id}' yet; set 'console_id' or retry once the"
                " consoles have refreshed"
            )
            raise ServiceValidationError(msg)

    target_entry = matching_entries[0]

    # Validate secondary resource if provided (e.g. chime camera_id,
    # or viewer liveview_id)
    if secondary_resource_type and secondary_resource_id:
        sec_collection_key = {
            "camera": "cameras",
            "liveview": "liveviews",
        }.get(secondary_resource_type, f"{secondary_resource_type}s")

        if not _protect_entry_has_resource(
            target_entry, sec_collection_key, secondary_resource_id
        ):
            cross_entries = [
                entry
                for entry in protect_entries
                if entry != target_entry
                and _protect_owns_resource(
                    entry, sec_collection_key, secondary_resource_id
                )
                is True
            ]
            if cross_entries:
                msg = (
                    f"{secondary_resource_type.capitalize()} '{secondary_resource_id}'"
                    " belongs to a different Protect console than"
                    f" {resource_type} '{resource_id}'"
                )
                raise ServiceValidationError(msg)
            # Nothing positively claims it. The resource may simply be newer
            # than the last refresh - a liveview created moments ago, say - so
            # stay on the console the primary resource chose rather than fail a
            # call that used to work.
            _LOGGER.debug(
                "%s '%s' is not in cached Protect data; proceeding on the console"
                " owning %s '%s'",
                secondary_resource_type.capitalize(),
                secondary_resource_id,
                resource_type,
                resource_id,
            )

    return target_entry.runtime_data.coordinator


SERVICE_REFRESH_DATA = "refresh_data"
SERVICE_RESTART_DEVICE = "restart_device"

# Schema for refresh_data service
REFRESH_DATA_SCHEMA = vol.Schema(
    {
        vol.Optional("site_id"): cv.string,
    }
)

# Schema for restart_device service
RESTART_DEVICE_SCHEMA = vol.Schema(
    {
        vol.Required("site_id"): cv.string,
        vol.Required("device_id"): cv.string,
    }
)

# Schema for set_recording_mode service
SET_RECORDING_MODE_SCHEMA = vol.Schema(
    {
        vol.Required("camera_id"): cv.string,
        vol.Required("mode"): cv.string,
    }
)

# Schema for set_hdr_mode service
SET_HDR_MODE_SCHEMA = vol.Schema(
    {
        vol.Required("camera_id"): cv.string,
        vol.Required("mode"): vol.In([HDR_MODE_AUTO, HDR_MODE_ON, HDR_MODE_OFF]),
    }
)

# Schema for set_video_mode service
SET_VIDEO_MODE_SCHEMA = vol.Schema(
    {
        vol.Required("camera_id"): cv.string,
        vol.Required("mode"): vol.In(
            [
                VIDEO_MODE_DEFAULT,
                VIDEO_MODE_HIGH_FPS,
                VIDEO_MODE_SPORT,
                VIDEO_MODE_SLOW_SHUTTER,
            ]
        ),
    }
)

# Schema for set_mic_volume service
SET_MIC_VOLUME_SCHEMA = vol.Schema(
    {
        vol.Required("camera_id"): cv.string,
        vol.Required("volume"): vol.All(vol.Coerce(int), vol.Range(min=0, max=100)),
    }
)

# Schema for set_light_mode service
SET_LIGHT_MODE_SCHEMA = vol.Schema(
    {
        vol.Required("light_id"): cv.string,
        vol.Required("mode"): vol.In(
            [
                LIGHT_MODE_ALWAYS,
                LIGHT_MODE_MOTION,
                LIGHT_MODE_OFF,
            ]
        ),
    }
)

# Schema for set_light_level service
SET_LIGHT_LEVEL_SCHEMA = vol.Schema(
    {
        vol.Required("light_id"): cv.string,
        vol.Required("level"): vol.All(vol.Coerce(int), vol.Range(min=0, max=100)),
    }
)

# Schema for ptz_move service
PTZ_MOVE_SCHEMA = vol.Schema(
    {
        vol.Required("camera_id"): cv.string,
        vol.Required("preset"): vol.All(vol.Coerce(int), vol.Range(min=0, max=15)),
    }
)


# Schema for ptz_patrol service
PTZ_PATROL_SCHEMA = vol.Schema(
    {
        vol.Required("camera_id"): cv.string,
        vol.Required("action"): vol.In(["start", "stop"]),
        vol.Optional("slot", default=0): vol.All(
            vol.Coerce(int), vol.Range(min=0, max=15)
        ),
    }
)

# Schema for set_chime_volume service
SET_CHIME_VOLUME_SCHEMA = vol.Schema(
    {
        vol.Required("chime_id"): cv.string,
        vol.Required("volume"): vol.All(vol.Coerce(int), vol.Range(min=0, max=100)),
        vol.Optional("camera_id"): cv.string,
    }
)

# Schema for play_chime_ringtone service
PLAY_CHIME_RINGTONE_SCHEMA = vol.Schema(
    {
        vol.Required("chime_id"): cv.string,
        vol.Optional("ringtone_id"): vol.In(
            [
                CHIME_RINGTONE_DEFAULT,
                CHIME_RINGTONE_MECHANICAL,
                CHIME_RINGTONE_DIGITAL,
                CHIME_RINGTONE_CHRISTMAS,
                CHIME_RINGTONE_TRADITIONAL,
                CHIME_RINGTONE_CUSTOM_1,
                CHIME_RINGTONE_CUSTOM_2,
            ]
        ),
    }
)

# Schema for set_chime_ringtone service
SET_CHIME_RINGTONE_SCHEMA = vol.Schema(
    {
        vol.Required("chime_id"): cv.string,
        vol.Required("ringtone_id"): vol.In(
            [
                CHIME_RINGTONE_DEFAULT,
                CHIME_RINGTONE_MECHANICAL,
                CHIME_RINGTONE_DIGITAL,
                CHIME_RINGTONE_CHRISTMAS,
                CHIME_RINGTONE_TRADITIONAL,
                CHIME_RINGTONE_CUSTOM_1,
                CHIME_RINGTONE_CUSTOM_2,
            ]
        ),
        vol.Optional("camera_id"): cv.string,
    }
)

# Schema for set_chime_repeat_times service
SET_CHIME_REPEAT_TIMES_SCHEMA = vol.Schema(
    {
        vol.Required("chime_id"): cv.string,
        vol.Required("repeat_times"): vol.All(
            vol.Coerce(int), vol.Range(min=1, max=10)
        ),
        vol.Optional("camera_id"): cv.string,
    }
)

# Schema for authorize_guest service
AUTHORIZE_GUEST_SCHEMA = vol.Schema(
    {
        vol.Required("site_id"): cv.string,
        vol.Required("client_id"): cv.string,
        # Note: the official UniFi Integration API authorize action does not
        # accept duration or bandwidth/data limits. These options are accepted
        # for backwards compatibility but ignored (a warning is logged).
        vol.Optional("duration_minutes"): vol.All(vol.Coerce(int), vol.Range(min=1)),
        vol.Optional("upload_limit_kbps"): vol.All(vol.Coerce(int), vol.Range(min=0)),
        vol.Optional("download_limit_kbps"): vol.All(vol.Coerce(int), vol.Range(min=0)),
        vol.Optional("data_limit_mb"): vol.All(vol.Coerce(int), vol.Range(min=0)),
    }
)

# Schema for generate_voucher service
GENERATE_VOUCHER_SCHEMA = vol.Schema(
    {
        vol.Required("site_id"): cv.string,
        vol.Optional("count", default=1): vol.All(
            vol.Coerce(int), vol.Range(min=1, max=100)
        ),
        vol.Optional("duration_minutes", default=480): vol.All(
            vol.Coerce(int), vol.Range(min=1)
        ),
        vol.Optional("upload_limit_kbps"): vol.All(vol.Coerce(int), vol.Range(min=0)),
        vol.Optional("download_limit_kbps"): vol.All(vol.Coerce(int), vol.Range(min=0)),
        vol.Optional("data_limit_mb"): vol.All(vol.Coerce(int), vol.Range(min=0)),
        vol.Optional("note"): cv.string,
    }
)

# Schema for delete_voucher service
DELETE_VOUCHER_SCHEMA = vol.Schema(
    {
        vol.Required("site_id"): cv.string,
        vol.Required("voucher_id"): cv.string,
    }
)

# Schema for trigger_alarm service
TRIGGER_ALARM_SCHEMA = vol.Schema(
    {
        vol.Required("alarm_id"): cv.string,
        vol.Optional("console_id"): cv.string,
    }
)

# Schema for create_liveview service
CREATE_LIVEVIEW_SCHEMA = vol.Schema(
    {
        vol.Required("name"): cv.string,
        vol.Required("layout"): vol.All(vol.Coerce(int), vol.Range(min=1, max=4)),
        vol.Optional("is_default", default=False): cv.boolean,
        vol.Optional("console_id"): cv.string,
    }
)

# Schema for set_liveview service
SET_LIVEVIEW_SCHEMA = vol.Schema(
    {
        vol.Required("viewer_id"): cv.string,
        vol.Required("liveview_id"): cv.string,
    }
)


async def async_setup_services(hass: HomeAssistant) -> None:
    """Set up the UniFi Insights services."""
    _LOGGER.debug("Setting up UniFi Insights services")

    async def async_handle_refresh_data(call: ServiceCall) -> None:
        """Handle the refresh data service call."""
        _LOGGER.debug("Handling refresh_data service call with data: %s", call.data)

        site_id = call.data.get("site_id")

        # Get all coordinators from config entries
        coordinators = _get_coordinators(hass)

        if not coordinators:
            _LOGGER.error("No UniFi Insights coordinators found")
            msg = "No UniFi Insights coordinators found"
            raise ServiceValidationError(msg)

        _LOGGER.info(
            "Refreshing data for %s site%s",
            "specific" if site_id else "all",
            f" (ID: {site_id})" if site_id else "s",
        )

        for coordinator in coordinators:
            try:
                # If site_id is specified, only refresh that site
                if site_id and site_id not in coordinator.data["sites"]:
                    _LOGGER.debug("Skipping coordinator - site %s not found", site_id)
                    continue

                _LOGGER.debug("Requesting coordinator refresh")
                await coordinator.async_refresh()
                _LOGGER.info("Successfully refreshed coordinator data")

            except Exception as err:
                _LOGGER.exception("Error refreshing coordinator data")
                msg = f"Error refreshing data: {err}"
                raise HomeAssistantError(msg) from err

    async def async_handle_restart_device(call: ServiceCall) -> None:
        """Handle the restart device service call."""
        site_id = call.data["site_id"]
        device_id = call.data["device_id"]

        coordinator = _get_coordinator_for_network_resource(
            hass, site_id=site_id, device_id=device_id
        )

        _LOGGER.info("Restarting device %s in site %s", device_id, site_id)
        await coordinator.async_restart_device(site_id, device_id)

    async def async_handle_set_recording_mode(call: ServiceCall) -> None:
        """Handle the set_recording_mode service call."""
        camera_id = call.data["camera_id"]
        mode = call.data["mode"]

        coordinator = _get_coordinator_for_protect_resource(
            hass, resource_type="camera", resource_id=camera_id
        )

        _LOGGER.info("Setting recording mode for camera %s to %s", camera_id, mode)
        await coordinator.async_set_recording_mode(camera_id, mode)

    async def async_handle_set_hdr_mode(call: ServiceCall) -> None:
        """Handle the set_hdr_mode service call."""
        camera_id = call.data["camera_id"]
        mode = call.data["mode"]

        coordinator = _get_coordinator_for_protect_resource(
            hass, resource_type="camera", resource_id=camera_id
        )

        _LOGGER.info("Setting HDR mode for camera %s to %s", camera_id, mode)
        await coordinator.async_set_hdr_mode(camera_id, mode)

    async def async_handle_set_video_mode(call: ServiceCall) -> None:
        """Handle the set_video_mode service call."""
        camera_id = call.data["camera_id"]
        mode = call.data["mode"]

        coordinator = _get_coordinator_for_protect_resource(
            hass, resource_type="camera", resource_id=camera_id
        )

        _LOGGER.info("Setting video mode for camera %s to %s", camera_id, mode)
        await coordinator.async_set_video_mode(camera_id, mode)

    async def async_handle_set_mic_volume(call: ServiceCall) -> None:
        """Handle the set_mic_volume service call."""
        camera_id = call.data["camera_id"]
        volume = call.data["volume"]

        coordinator = _get_coordinator_for_protect_resource(
            hass, resource_type="camera", resource_id=camera_id
        )

        _LOGGER.info("Setting mic volume for camera %s to %d%%", camera_id, volume)
        await coordinator.async_set_microphone_volume(camera_id, volume)

    # Register services
    _LOGGER.debug("Registering UniFi Insights services")
    hass.services.async_register(
        DOMAIN,
        SERVICE_REFRESH_DATA,
        async_handle_refresh_data,
        schema=REFRESH_DATA_SCHEMA,
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_RESTART_DEVICE,
        async_handle_restart_device,
        schema=RESTART_DEVICE_SCHEMA,
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_SET_RECORDING_MODE,
        async_handle_set_recording_mode,
        schema=SET_RECORDING_MODE_SCHEMA,
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_SET_HDR_MODE,
        async_handle_set_hdr_mode,
        schema=SET_HDR_MODE_SCHEMA,
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_SET_VIDEO_MODE,
        async_handle_set_video_mode,
        schema=SET_VIDEO_MODE_SCHEMA,
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_SET_MIC_VOLUME,
        async_handle_set_mic_volume,
        schema=SET_MIC_VOLUME_SCHEMA,
    )

    async def async_handle_set_light_mode(call: ServiceCall) -> None:
        """Handle the set_light_mode service call."""
        light_id = call.data["light_id"]
        mode = call.data["mode"]

        coordinator = _get_coordinator_for_protect_resource(
            hass, resource_type="light", resource_id=light_id
        )

        _LOGGER.info("Setting light mode for %s to %s", light_id, mode)
        await coordinator.async_set_light_mode(light_id, mode)

    async def async_handle_set_light_level(call: ServiceCall) -> None:
        """Handle the set_light_level service call."""
        light_id = call.data["light_id"]
        level = call.data["level"]

        coordinator = _get_coordinator_for_protect_resource(
            hass, resource_type="light", resource_id=light_id
        )

        _LOGGER.info("Setting light level for %s to %d%%", light_id, level)
        await coordinator.async_set_light_brightness(light_id, level)

    async def async_handle_ptz_move(call: ServiceCall) -> None:
        """Handle the ptz_move service call."""
        camera_id = call.data["camera_id"]
        preset = call.data["preset"]

        coordinator = _get_coordinator_for_protect_resource(
            hass, resource_type="camera", resource_id=camera_id
        )

        _LOGGER.info("Moving camera %s to preset %d", camera_id, preset)
        await coordinator.async_move_ptz_to_preset(camera_id, preset)

    async def async_handle_ptz_patrol(call: ServiceCall) -> None:
        """Handle the ptz_patrol service call."""
        camera_id = call.data["camera_id"]
        action = call.data["action"]
        slot = call.data.get("slot", 0)

        coordinator = _get_coordinator_for_protect_resource(
            hass, resource_type="camera", resource_id=camera_id
        )

        if action == "start":
            _LOGGER.info("Starting PTZ patrol slot %d for camera %s", slot, camera_id)
            await coordinator.async_start_ptz_patrol(camera_id, slot)
        else:
            _LOGGER.info("Stopping PTZ patrol for camera %s", camera_id)
            await coordinator.async_stop_ptz_patrol(camera_id)

    # Register light services
    hass.services.async_register(
        DOMAIN,
        SERVICE_SET_LIGHT_MODE,
        async_handle_set_light_mode,
        schema=SET_LIGHT_MODE_SCHEMA,
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_SET_LIGHT_LEVEL,
        async_handle_set_light_level,
        schema=SET_LIGHT_LEVEL_SCHEMA,
    )

    # Register PTZ services
    hass.services.async_register(
        DOMAIN,
        SERVICE_PTZ_MOVE,
        async_handle_ptz_move,
        schema=PTZ_MOVE_SCHEMA,
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_PTZ_PATROL,
        async_handle_ptz_patrol,
        schema=PTZ_PATROL_SCHEMA,
    )

    async def async_handle_set_chime_volume(call: ServiceCall) -> None:
        """Handle the set_chime_volume service call."""
        chime_id = call.data["chime_id"]
        volume = call.data["volume"]
        camera_id = call.data.get("camera_id")

        coordinator = _get_coordinator_for_protect_resource(
            hass,
            resource_type="chime",
            resource_id=chime_id,
            secondary_resource_type="camera" if camera_id else None,
            secondary_resource_id=camera_id,
        )

        if camera_id:
            # camera_id only narrows which console owns the chime. Chime
            # records do carry per-camera ringSettings, but this integration
            # has never used them, so the volume is applied chime-wide.
            _LOGGER.debug(
                "camera_id %s selects the console owning chime %s; volume"
                " applies to the whole chime",
                camera_id,
                chime_id,
            )
        _LOGGER.info("Setting chime %s volume to %d%%", chime_id, volume)
        await coordinator.async_set_chime_volume(chime_id, volume)

    async def async_handle_play_chime_ringtone(call: ServiceCall) -> None:
        """Handle the play_chime_ringtone service call."""
        chime_id = call.data["chime_id"]

        coordinator = _get_coordinator_for_protect_resource(
            hass, resource_type="chime", resource_id=chime_id
        )

        _LOGGER.info("Playing ringtone on chime %s", chime_id)
        await coordinator.async_play_chime(chime_id)

    async def async_handle_set_chime_ringtone(call: ServiceCall) -> None:
        """Handle the set_chime_ringtone service call."""
        chime_id = call.data["chime_id"]
        ringtone_id = call.data["ringtone_id"]
        camera_id = call.data.get("camera_id")

        coordinator = _get_coordinator_for_protect_resource(
            hass,
            resource_type="chime",
            resource_id=chime_id,
            secondary_resource_type="camera" if camera_id else None,
            secondary_resource_id=camera_id,
        )

        if camera_id:
            # camera_id only narrows which console owns the chime; this
            # integration applies the ringtone chime-wide.
            _LOGGER.debug(
                "camera_id %s selects the console owning chime %s; ringtone"
                " applies to the whole chime",
                camera_id,
                chime_id,
            )
        _LOGGER.info("Setting chime %s ringtone to %s", chime_id, ringtone_id)
        await coordinator.async_set_chime_ringtone(chime_id, ringtone_id)

    async def async_handle_set_chime_repeat_times(call: ServiceCall) -> None:
        """Handle the set_chime_repeat_times service call."""
        chime_id = call.data["chime_id"]
        repeat_times = call.data["repeat_times"]
        camera_id = call.data.get("camera_id")

        coordinator = _get_coordinator_for_protect_resource(
            hass,
            resource_type="chime",
            resource_id=chime_id,
            secondary_resource_type="camera" if camera_id else None,
            secondary_resource_id=camera_id,
        )

        if camera_id:
            # camera_id only narrows which console owns the chime; this
            # integration applies the repeat count chime-wide.
            _LOGGER.debug(
                "camera_id %s selects the console owning chime %s; repeat times"
                " apply to the whole chime",
                camera_id,
                chime_id,
            )
        _LOGGER.info("Setting chime %s repeat times to %d", chime_id, repeat_times)
        await coordinator.async_set_chime_repeat(chime_id, repeat_times)

    async def async_handle_authorize_guest(call: ServiceCall) -> None:
        """Handle the authorize_guest service call."""
        site_id = call.data["site_id"]
        client_id = call.data["client_id"]

        # The official Integration API authorize action does not accept the
        # duration or bandwidth/data limits the legacy guest portal supported;
        # warn so users understand those fields are ignored.
        ignored = [
            key
            for key in (
                "duration_minutes",
                "upload_limit_kbps",
                "download_limit_kbps",
                "data_limit_mb",
            )
            if call.data.get(key) is not None
        ]
        if ignored:
            _LOGGER.warning(
                "authorize_guest ignores unsupported option(s) %s; the UniFi "
                "Integration API authorizes guests using the network's default "
                "guest policy",
                ", ".join(ignored),
            )

        coordinator = _get_coordinator_for_network_resource(
            hass, site_id=site_id, client_id=client_id
        )

        await coordinator.async_authorize_guest(site_id, client_id)

    async def async_handle_generate_voucher(call: ServiceCall) -> None:
        """Handle the generate_voucher service call."""
        site_id = call.data["site_id"]
        count = call.data.get("count", 1)
        duration_minutes = call.data.get("duration_minutes")
        upload_limit_kbps = call.data.get("upload_limit_kbps")
        download_limit_kbps = call.data.get("download_limit_kbps")
        data_limit_mb = call.data.get("data_limit_mb")
        note = call.data.get("note")

        coordinator = _get_coordinator_for_network_resource(hass, site_id=site_id)

        await coordinator.async_generate_voucher(
            site_id,
            count=count,
            time_limit_minutes=duration_minutes,
            tx_rate_limit_kbps=upload_limit_kbps,
            rx_rate_limit_kbps=download_limit_kbps,
            data_usage_limit_mbytes=data_limit_mb,
            name=note,
        )

    async def async_handle_delete_voucher(call: ServiceCall) -> None:
        """Handle the delete_voucher service call."""
        site_id = call.data["site_id"]
        voucher_id = call.data["voucher_id"]

        coordinator = _get_coordinator_for_network_resource(hass, site_id=site_id)

        await coordinator.async_delete_voucher(site_id, voucher_id)

    async def async_handle_trigger_alarm(call: ServiceCall) -> None:
        """Handle the trigger_alarm service call."""
        alarm_id = call.data["alarm_id"]

        # alarm_id is a user-defined alarm-manager webhook trigger, not a
        # device: it appears in no coordinator collection, so the console is
        # the only thing that can be resolved.
        coordinator = _get_coordinator_for_protect_resource(
            hass, console_id=call.data.get("console_id")
        )

        await coordinator.async_trigger_alarm(alarm_id)

    async def async_handle_create_liveview(call: ServiceCall) -> None:
        """Handle the create_liveview service call."""
        name = call.data["name"]
        layout = call.data["layout"]
        is_default = call.data.get("is_default", False)

        coordinator = _get_coordinator_for_protect_resource(
            hass, console_id=call.data.get("console_id")
        )

        await coordinator.async_create_liveview(
            name=name,
            layout=layout,
            is_default=is_default,
        )

    async def async_handle_set_liveview(call: ServiceCall) -> None:
        """Handle the set_liveview service call."""
        viewer_id = call.data["viewer_id"]
        liveview_id = call.data["liveview_id"]

        coordinator = _get_coordinator_for_protect_resource(
            hass,
            resource_type="viewer",
            resource_id=viewer_id,
            secondary_resource_type="liveview",
            secondary_resource_id=liveview_id,
        )

        await coordinator.async_update_viewer(viewer_id, liveview=liveview_id)

    # Register chime services
    hass.services.async_register(
        DOMAIN,
        SERVICE_SET_CHIME_VOLUME,
        async_handle_set_chime_volume,
        schema=SET_CHIME_VOLUME_SCHEMA,
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_PLAY_CHIME_RINGTONE,
        async_handle_play_chime_ringtone,
        schema=PLAY_CHIME_RINGTONE_SCHEMA,
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_SET_CHIME_RINGTONE,
        async_handle_set_chime_ringtone,
        schema=SET_CHIME_RINGTONE_SCHEMA,
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_SET_CHIME_REPEAT_TIMES,
        async_handle_set_chime_repeat_times,
        schema=SET_CHIME_REPEAT_TIMES_SCHEMA,
    )

    # Register UniFi Network services
    hass.services.async_register(
        DOMAIN,
        SERVICE_AUTHORIZE_GUEST,
        async_handle_authorize_guest,
        schema=AUTHORIZE_GUEST_SCHEMA,
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_GENERATE_VOUCHER,
        async_handle_generate_voucher,
        schema=GENERATE_VOUCHER_SCHEMA,
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_DELETE_VOUCHER,
        async_handle_delete_voucher,
        schema=DELETE_VOUCHER_SCHEMA,
    )

    # Register UniFi Protect services
    hass.services.async_register(
        DOMAIN,
        SERVICE_TRIGGER_ALARM,
        async_handle_trigger_alarm,
        schema=TRIGGER_ALARM_SCHEMA,
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_CREATE_LIVEVIEW,
        async_handle_create_liveview,
        schema=CREATE_LIVEVIEW_SCHEMA,
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_SET_LIVEVIEW,
        async_handle_set_liveview,
        schema=SET_LIVEVIEW_SCHEMA,
    )

    _LOGGER.info("UniFi Insights services registered successfully")


async def async_unload_services(hass: HomeAssistant) -> None:
    """Unload UniFi Insights services."""
    _LOGGER.debug("Unloading UniFi Insights services")

    # Unload core services
    if hass.services.has_service(DOMAIN, SERVICE_REFRESH_DATA):
        hass.services.async_remove(DOMAIN, SERVICE_REFRESH_DATA)

    if hass.services.has_service(DOMAIN, SERVICE_RESTART_DEVICE):
        hass.services.async_remove(DOMAIN, SERVICE_RESTART_DEVICE)

    # Unload Unifi Protect services
    if hass.services.has_service(DOMAIN, SERVICE_SET_RECORDING_MODE):
        hass.services.async_remove(DOMAIN, SERVICE_SET_RECORDING_MODE)

    if hass.services.has_service(DOMAIN, SERVICE_SET_HDR_MODE):
        hass.services.async_remove(DOMAIN, SERVICE_SET_HDR_MODE)

    if hass.services.has_service(DOMAIN, SERVICE_SET_VIDEO_MODE):
        hass.services.async_remove(DOMAIN, SERVICE_SET_VIDEO_MODE)

    if hass.services.has_service(DOMAIN, SERVICE_SET_MIC_VOLUME):
        hass.services.async_remove(DOMAIN, SERVICE_SET_MIC_VOLUME)

    if hass.services.has_service(DOMAIN, SERVICE_SET_LIGHT_MODE):
        hass.services.async_remove(DOMAIN, SERVICE_SET_LIGHT_MODE)

    if hass.services.has_service(DOMAIN, SERVICE_SET_LIGHT_LEVEL):
        hass.services.async_remove(DOMAIN, SERVICE_SET_LIGHT_LEVEL)

    if hass.services.has_service(DOMAIN, SERVICE_PTZ_MOVE):
        hass.services.async_remove(DOMAIN, SERVICE_PTZ_MOVE)

    if hass.services.has_service(DOMAIN, SERVICE_PTZ_PATROL):
        hass.services.async_remove(DOMAIN, SERVICE_PTZ_PATROL)

    # Unload chime services
    if hass.services.has_service(DOMAIN, SERVICE_SET_CHIME_VOLUME):
        hass.services.async_remove(DOMAIN, SERVICE_SET_CHIME_VOLUME)

    if hass.services.has_service(DOMAIN, SERVICE_PLAY_CHIME_RINGTONE):
        hass.services.async_remove(DOMAIN, SERVICE_PLAY_CHIME_RINGTONE)

    if hass.services.has_service(DOMAIN, SERVICE_SET_CHIME_RINGTONE):
        hass.services.async_remove(DOMAIN, SERVICE_SET_CHIME_RINGTONE)

    if hass.services.has_service(DOMAIN, SERVICE_SET_CHIME_REPEAT_TIMES):
        hass.services.async_remove(DOMAIN, SERVICE_SET_CHIME_REPEAT_TIMES)

    # Unload UniFi Network services
    if hass.services.has_service(DOMAIN, SERVICE_AUTHORIZE_GUEST):
        hass.services.async_remove(DOMAIN, SERVICE_AUTHORIZE_GUEST)

    if hass.services.has_service(DOMAIN, SERVICE_GENERATE_VOUCHER):
        hass.services.async_remove(DOMAIN, SERVICE_GENERATE_VOUCHER)

    if hass.services.has_service(DOMAIN, SERVICE_DELETE_VOUCHER):
        hass.services.async_remove(DOMAIN, SERVICE_DELETE_VOUCHER)

    # Unload UniFi Protect services
    if hass.services.has_service(DOMAIN, SERVICE_TRIGGER_ALARM):
        hass.services.async_remove(DOMAIN, SERVICE_TRIGGER_ALARM)

    if hass.services.has_service(DOMAIN, SERVICE_CREATE_LIVEVIEW):
        hass.services.async_remove(DOMAIN, SERVICE_CREATE_LIVEVIEW)

    if hass.services.has_service(DOMAIN, SERVICE_SET_LIVEVIEW):
        hass.services.async_remove(DOMAIN, SERVICE_SET_LIVEVIEW)

    _LOGGER.info("UniFi Insights services unloaded successfully")
