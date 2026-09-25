"""
Per-entry secret keys for opaque topology node ids.

A MAC-derived node id is an HMAC of the MAC under its entry's key, so a
snapshot recipient cannot enumerate candidate MACs to reverse it. Keys are
random, stored in Home Assistant's private storage (never in the config entry,
so diagnostics cannot leak them) and kept across restarts so node ids stay
stable. The store is loaded once at component setup, before the topology
commands are registered, which lets the synchronous command handlers read a
key without an await (and without a window in which the entry can unload).
"""

from __future__ import annotations

import logging
import re
import secrets
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Final

from homeassistant.core import callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.storage import Store
from homeassistant.util.hass_dict import HassKey

from .const import DOMAIN

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

_STORAGE_KEY: Final = f"{DOMAIN}.topology_keys"
_STORAGE_VERSION: Final = 1
_SAVE_DELAY: Final = 1
_KEY_BYTES: Final = 32
_KEY_RE: Final = re.compile(rf"[0-9a-f]{{{_KEY_BYTES * 2}}}")


@dataclass
class _NodeKeys:
    """Loaded keys (entry_id -> hex) and the store that persists them."""

    store: Store[dict[str, Any]]
    keys: dict[str, str]

    def data(self) -> dict[str, Any]:
        """Return the payload to persist."""
        return {"keys": dict(self.keys)}


_NODE_KEYS: HassKey[_NodeKeys] = HassKey(f"{DOMAIN}_topology_node_keys")


async def async_load_node_keys(hass: HomeAssistant) -> None:
    """Load the stored keys into memory (once per Home Assistant instance)."""
    if _NODE_KEYS in hass.data:
        return
    store: Store[dict[str, Any]] = Store(
        hass, _STORAGE_VERSION, _STORAGE_KEY, private=True
    )
    try:
        stored = await store.async_load()
    except HomeAssistantError:
        # Losing the keys only changes MAC-derived node ids once; failing
        # component setup over it would take every entity down with it.
        _LOGGER.warning("Could not read topology node keys; generating new ones")
        stored = None
    raw = stored.get("keys") if isinstance(stored, dict) else None
    keys = {
        entry_id: key
        for entry_id, key in (raw.items() if isinstance(raw, dict) else ())
        if isinstance(key, str) and _KEY_RE.fullmatch(key)
    }
    hass.data.setdefault(_NODE_KEYS, _NodeKeys(store, keys))


@callback
def async_get_node_key(hass: HomeAssistant, entry_id: str) -> bytes:
    """Return the entry's node-id key, creating and persisting it on first use."""
    node_keys = hass.data[_NODE_KEYS]
    key = node_keys.keys.get(entry_id)
    if key is None:
        key = node_keys.keys[entry_id] = secrets.token_hex(_KEY_BYTES)
        node_keys.store.async_delay_save(node_keys.data, _SAVE_DELAY)
    return bytes.fromhex(key)


async def async_remove_node_key(hass: HomeAssistant, entry_id: str) -> None:
    """Forget a deleted entry's key."""
    await async_load_node_keys(hass)
    node_keys = hass.data[_NODE_KEYS]
    if node_keys.keys.pop(entry_id, None) is not None:
        node_keys.store.async_delay_save(node_keys.data, _SAVE_DELAY)
