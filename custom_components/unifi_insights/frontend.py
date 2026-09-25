"""Serve the topology Lovelace card bundle from the integration."""

from __future__ import annotations

import hashlib
import logging
from pathlib import Path
from typing import TYPE_CHECKING, Final

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.components.lovelace.const import LOVELACE_DATA
from homeassistant.components.lovelace.resources import ResourceStorageCollection
from homeassistant.loader import async_get_integration
from homeassistant.util.hass_dict import HassKey

from .const import DOMAIN

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

CARD_URL: Final = f"/{DOMAIN}/topology-card.js"
CARD_PATH: Final = Path(__file__).parent / "frontend" / "topology-card.js"
_REGISTERED: HassKey[bool] = HassKey(f"{DOMAIN}_frontend_registered")
_STATIC_REGISTERED: HassKey[bool] = HassKey(f"{DOMAIN}_frontend_static_registered")


def _bundle_digest() -> str:
    """Short content hash of the bundle, so a rebuild busts caches too."""
    return hashlib.sha256(CARD_PATH.read_bytes()).hexdigest()[:8]


async def async_register_frontend(hass: HomeAssistant) -> None:
    """
    Serve the card bundle and register it as a Lovelace resource once.

    Called from async_setup, like the topology WebSocket commands, so it runs
    once per Home Assistant instance rather than once per config entry. The
    bundle is served with long-lived cache headers, so the URL carries the
    integration version plus a hash of the bundle: a release or a rebuilt
    bundle under the same version (a fork or test build) busts browser caches.
    Lovelace loads its resources before creating cards. An extra frontend JS
    URL can run after card creation on a cold dashboard load, leaving a
    permanent "custom element doesn't exist" error until the page reloads.
    Storage-mode Lovelace gets a managed resource; YAML-mode keeps the extra
    JS URL as a fallback. Static paths cannot be unregistered, so nothing is
    undone on unload; the card shows its own "no integration loaded" state.
    """
    if hass.data.get(_REGISTERED):
        return
    if not {"http", "frontend"} <= hass.config.components:
        _LOGGER.debug("http/frontend not loaded; topology card not registered")
        return
    try:
        integration = await async_get_integration(hass, DOMAIN)
        digest = await hass.async_add_executor_job(_bundle_digest)
        if not hass.data.get(_STATIC_REGISTERED):
            await hass.http.async_register_static_paths(
                [StaticPathConfig(CARD_URL, str(CARD_PATH), cache_headers=True)]
            )
            hass.data[_STATIC_REGISTERED] = True
        url = f"{CARD_URL}?v={integration.version}-{digest}"
        lovelace = hass.data.get(LOVELACE_DATA)
        resources = lovelace.resources if lovelace is not None else None
        if isinstance(resources, ResourceStorageCollection):
            await resources.async_get_info()  # Load before inspecting items.
            existing = next(
                (
                    item
                    for item in resources.async_items()
                    if item["url"].partition("?")[0] == CARD_URL
                ),
                None,
            )
            if existing is None:
                await resources.async_create_item({"url": url, "res_type": "module"})
            elif existing["url"] != url or existing["type"] != "module":
                await resources.async_update_item(
                    existing["id"], {"url": url, "res_type": "module"}
                )
        else:
            add_extra_js_url(hass, url)
    except Exception:
        _LOGGER.exception("Unable to register optional topology card frontend")
    else:
        hass.data[_REGISTERED] = True
