"""Tests for the UniFi Insights diagnostics."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

import pytest
from homeassistant.components.diagnostics.const import REDACTED

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant
    from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.unifi_insights.coordinators.config import (
    UnifiConfigCoordinator,
)
from custom_components.unifi_insights.diagnostics import (
    async_get_config_entry_diagnostics,
)


async def test_diagnostics(
    hass: HomeAssistant,
    init_integration: MockConfigEntry,
    enable_custom_integrations,
) -> None:
    """Test diagnostics."""
    diagnostics = await async_get_config_entry_diagnostics(hass, init_integration)

    assert "library_version" in diagnostics
    assert "connection" in diagnostics
    assert "entry" in diagnostics
    assert "data" in diagnostics

    # Check connection info - host is always redacted in diagnostics
    assert diagnostics["connection"]["host"] == "**REDACTED**"
    assert diagnostics["connection"]["network_client_connected"] is True
    assert diagnostics["connection"]["protect_client_connected"] is True

    # Check that actual API key value is redacted (not appearing in output)
    assert "test_api_key" not in str(diagnostics)
    # The key name "api_key" will appear, but the value should be redacted
    assert diagnostics["entry"]["data"]["api_key"] == "**REDACTED**"


async def test_diagnostics_includes_websocket_health(
    hass: HomeAssistant,
    init_integration: MockConfigEntry,
    enable_custom_integrations,
) -> None:
    """Test diagnostics surface the Protect WebSocket health signal.

    There was previously no way to tell "WS connected and delivering" from
    "connected but silent" from "reconnect-looping" (task 5) - diagnostics
    is the first place an operator would look to distinguish those.
    """
    diagnostics = await async_get_config_entry_diagnostics(hass, init_integration)

    assert "websocket" in diagnostics
    assert diagnostics["websocket"]["connected"] is False
    assert diagnostics["websocket"]["last_message_at"] is None

    # Review finding 1: a single shared connected/last_message_at pair
    # cannot tell "both subscriptions healthy" apart from "devices healthy,
    # events silently hung" - per-subscription detail must reach this
    # diagnostics payload too, not just the coordinator's own property.
    assert diagnostics["websocket"]["devices"] == {
        "connected": False,
        "last_message_at": None,
    }
    assert diagnostics["websocket"]["events"] == {
        "connected": False,
        "last_message_at": None,
    }


def _strings(value: Any) -> list[str]:
    """Return every string key and value in a nested diagnostics payload."""
    if isinstance(value, str):
        return [value]
    if isinstance(value, dict):
        return [s for k, v in value.items() for s in (*_strings(k), *_strings(v))]
    if isinstance(value, (list, tuple, set)):
        return [s for item in value for s in _strings(item)]
    return []


@pytest.mark.parametrize(
    ("passphrase", "escaped"),
    [
        ("simple-password", "simple-password"),
        ('sp;e:c,i"a\\l-pass', 'sp\\;e\\:c\\,i\\"a\\\\l-pass'),
    ],
)
async def test_diagnostics_redacts_wifi_qr_code(
    hass: HomeAssistant,
    init_integration: MockConfigEntry,
    enable_custom_integrations,
    passphrase: str,
    escaped: str,
) -> None:
    """Test diagnostics does not disclose password-bearing Wi-Fi QR payloads."""
    wifi = {"wifi-1": {"name": "Test WiFi"}}
    UnifiConfigCoordinator._enrich_wifi(
        wifi,
        [
            {
                "name": "Test WiFi",
                "x_passphrase": passphrase,
                "security": "wpa2",
            }
        ],
        [],
    )
    qr_code = wifi["wifi-1"]["qr_code"]
    coordinator = init_integration.runtime_data.coordinator
    coordinator.data["wifi"] = {"site-1": wifi}

    diagnostics = await async_get_config_entry_diagnostics(hass, init_integration)
    diagnostic_wifi = diagnostics["data"]["wifi"]["site-1"]["wifi-1"]

    assert qr_code.startswith("WIFI:T:WPA;S:Test WiFi;P:")
    assert wifi["wifi-1"]["passphrase"] == passphrase
    assert coordinator.data["wifi"]["site-1"]["wifi-1"]["qr_code"] == qr_code
    assert diagnostic_wifi["passphrase"] == REDACTED
    assert diagnostic_wifi["qr_code"] == REDACTED
    assert f"P:{escaped};" in qr_code
    for text in _strings(diagnostics):
        assert passphrase not in text
        assert escaped not in text
