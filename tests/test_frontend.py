"""Tests for serving the topology card bundle."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from homeassistant.components.lovelace.const import LOVELACE_DATA

from custom_components.unifi_insights import async_setup, frontend
from custom_components.unifi_insights.frontend import (
    CARD_PATH,
    CARD_URL,
    async_register_frontend,
)

MANIFEST = Path(frontend.__file__).parent / "manifest.json"


class FakeResources:
    """A storage resource collection with the Home Assistant CRUD contract."""

    def __init__(self, items: list[dict] | None = None) -> None:
        self.items = items or []
        self.async_get_info = AsyncMock(return_value={"resources": len(self.items)})
        self.async_create_item = AsyncMock(side_effect=self._create)
        self.async_update_item = AsyncMock(side_effect=self._update)

    def async_items(self) -> list[dict]:
        """Return loaded resources."""
        return self.items

    def _create(self, data: dict) -> dict:
        item = {"id": "topology", "url": data["url"], "type": data["res_type"]}
        self.items.append(item)
        return item

    def _update(self, item_id: str, data: dict) -> dict:
        item = next(item for item in self.items if item["id"] == item_id)
        item.update(url=data["url"], type=data["res_type"])
        return item


@pytest.fixture
def http(hass):
    """Pretend the web components are loaded with a storage dashboard."""
    mock = MagicMock()
    mock.async_register_static_paths = AsyncMock()
    hass.http = mock
    hass.config.components.update({"http", "frontend", "lovelace"})
    hass.data[LOVELACE_DATA] = SimpleNamespace(resources=FakeResources())
    return mock


async def test_registers_bundle_once(hass, http, enable_custom_integrations) -> None:
    """The static path and the Lovelace module resource register once."""
    version = json.loads(MANIFEST.read_text(encoding="utf-8"))["version"]
    digest = hashlib.sha256(CARD_PATH.read_bytes()).hexdigest()[:8]
    with (
        patch.object(frontend, "ResourceStorageCollection", FakeResources),
        patch.object(frontend, "add_extra_js_url") as add_js,
    ):
        await async_register_frontend(hass)
        await async_register_frontend(hass)

    http.async_register_static_paths.assert_awaited_once()
    (configs,) = http.async_register_static_paths.await_args.args
    assert [(c.url_path, c.path, c.cache_headers) for c in configs] == [
        (CARD_URL, str(CARD_PATH), True)
    ]
    resources = hass.data[LOVELACE_DATA].resources
    assert resources.items == [
        {"id": "topology", "url": f"{CARD_URL}?v={version}-{digest}", "type": "module"}
    ]
    resources.async_create_item.assert_awaited_once()
    add_js.assert_not_called()


async def test_updates_resource_when_bundle_changes(
    hass, http, enable_custom_integrations
) -> None:
    """Upgrade an existing versioned resource rather than adding a duplicate."""
    resources = FakeResources(
        [{"id": "topology", "url": f"{CARD_URL}?v=old", "type": "module"}]
    )
    hass.data[LOVELACE_DATA].resources = resources
    with patch.object(frontend, "ResourceStorageCollection", FakeResources):
        await async_register_frontend(hass)

    resources.async_create_item.assert_not_awaited()
    resources.async_update_item.assert_awaited_once()
    assert resources.items[0]["url"] != f"{CARD_URL}?v=old"


async def test_keeps_current_resource_unchanged(
    hass, http, enable_custom_integrations
) -> None:
    """A current Lovelace resource needs neither creation nor an update."""
    version = json.loads(MANIFEST.read_text(encoding="utf-8"))["version"]
    digest = hashlib.sha256(CARD_PATH.read_bytes()).hexdigest()[:8]
    item = {
        "id": "topology",
        "url": f"{CARD_URL}?v={version}-{digest}",
        "type": "module",
    }
    resources = FakeResources([item])
    hass.data[LOVELACE_DATA].resources = resources

    with patch.object(frontend, "ResourceStorageCollection", FakeResources):
        await async_register_frontend(hass)

    resources.async_create_item.assert_not_awaited()
    resources.async_update_item.assert_not_awaited()
    assert resources.items == [item]
    http.async_register_static_paths.assert_awaited_once()


async def test_resource_failure_does_not_fail_setup_and_can_retry(
    hass, http, enable_custom_integrations, caplog
) -> None:
    """Optional card storage errors leave the integration and a retry usable."""
    resources = hass.data[LOVELACE_DATA].resources
    resources.async_create_item.side_effect = OSError("storage unavailable")
    with patch.object(frontend, "ResourceStorageCollection", FakeResources):
        await async_register_frontend(hass)
        assert not hass.data.get(frontend._REGISTERED)
        resources.async_create_item.side_effect = resources._create
        await async_register_frontend(hass)

    assert "Unable to register optional topology card frontend" in caplog.text
    assert hass.data[frontend._REGISTERED]
    http.async_register_static_paths.assert_awaited_once()
    assert len(resources.items) == 1


async def test_yaml_resources_use_frontend_fallback(
    hass, http, enable_custom_integrations
) -> None:
    """YAML resources cannot be written through the storage collection."""
    hass.data[LOVELACE_DATA].resources = MagicMock()
    with patch.object(frontend, "add_extra_js_url") as add_js:
        await async_register_frontend(hass)

    add_js.assert_called_once()


@pytest.mark.parametrize("missing", ["http", "frontend"])
async def test_skips_when_a_web_component_is_not_loaded(hass, missing) -> None:
    """Headless setups (and the test harness) get no card, and no error."""
    hass.http = MagicMock()
    hass.http.async_register_static_paths = AsyncMock()
    hass.config.components.update({"http", "frontend"} - {missing})
    with patch.object(frontend, "add_extra_js_url") as add_js:
        await async_register_frontend(hass)

    hass.http.async_register_static_paths.assert_not_awaited()
    add_js.assert_not_called()


async def test_async_setup_registers_the_card(hass) -> None:
    """Component setup registers the card alongside the WebSocket commands."""
    with (
        patch("custom_components.unifi_insights.async_setup_services"),
        patch("custom_components.unifi_insights.async_load_node_keys"),
        patch("custom_components.unifi_insights.async_register_websocket_commands"),
        patch("custom_components.unifi_insights.async_register_frontend") as register,
    ):
        assert await async_setup(hass, {})

    register.assert_awaited_once_with(hass)


def test_manifest_loads_after_web_components() -> None:
    """http/frontend are ordering hints, not hard dependencies.

    Tests run without hass_frontend.
    """
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    assert set(manifest["after_dependencies"]) >= {"http", "frontend", "lovelace"}
    assert "frontend" not in manifest["dependencies"]


def test_bundle_is_shipped() -> None:
    """HACS installs the repository tree, so the built bundle must be committed."""
    assert CARD_PATH.is_file()
