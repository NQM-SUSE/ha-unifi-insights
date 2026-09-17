"""Tests for the UniFi Insights integration initialization."""

from typing import TYPE_CHECKING
from unittest.mock import AsyncMock, MagicMock

from homeassistant.config_entries import ConfigEntryState
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

from custom_components.unifi_insights import (
    UnifiInsightsData,
    async_remove_config_entry_device,
)
from custom_components.unifi_insights.api import (
    UniFiAuthenticationError,
    UniFiConnectionError,
    UniFiResponseError,
    UniFiTimeoutError,
)


async def test_setup_entry_success(
    hass: HomeAssistant,
    mock_config_entry: MockConfigEntry,
    mock_network_client,
    mock_protect_client,
    mock_local_auth,
    enable_custom_integrations,
) -> None:
    """Test successful setup of config entry."""
    mock_config_entry.add_to_hass(hass)
    await hass.config_entries.async_setup(mock_config_entry.entry_id)
    await hass.async_block_till_done()

    assert mock_config_entry.state == ConfigEntryState.LOADED


async def test_setup_entry_auth_failed(
    hass: HomeAssistant,
    mock_config_entry: MockConfigEntry,
    mock_network_client,
    mock_protect_client,
    mock_local_auth,
    enable_custom_integrations,
) -> None:
    """Test setup fails with authentication error."""
    mock_network_client.sites.get_all.side_effect = UniFiAuthenticationError(
        "Invalid API key"
    )
    mock_protect_client.cameras.get_all.side_effect = UniFiAuthenticationError(
        "Invalid API key"
    )

    mock_config_entry.add_to_hass(hass)
    await hass.config_entries.async_setup(mock_config_entry.entry_id)
    await hass.async_block_till_done()

    assert mock_config_entry.state == ConfigEntryState.SETUP_ERROR


async def test_setup_entry_connection_error(
    hass: HomeAssistant,
    mock_config_entry: MockConfigEntry,
    mock_network_client,
    mock_protect_client,
    mock_local_auth,
    enable_custom_integrations,
) -> None:
    """Test setup fails with connection error."""
    mock_network_client.sites.get_all.side_effect = UniFiConnectionError(
        "Cannot connect"
    )
    mock_protect_client.cameras.get_all.side_effect = UniFiConnectionError(
        "Cannot connect"
    )

    mock_config_entry.add_to_hass(hass)
    await hass.config_entries.async_setup(mock_config_entry.entry_id)
    await hass.async_block_till_done()

    assert mock_config_entry.state == ConfigEntryState.SETUP_RETRY


async def test_setup_entry_timeout_error(
    hass: HomeAssistant,
    mock_config_entry: MockConfigEntry,
    mock_network_client,
    mock_protect_client,
    mock_local_auth,
    enable_custom_integrations,
) -> None:
    """Test setup fails with timeout error."""
    mock_network_client.sites.get_all.side_effect = UniFiTimeoutError(
        "Connection timeout"
    )
    mock_protect_client.cameras.get_all.side_effect = UniFiTimeoutError(
        "Connection timeout"
    )

    mock_config_entry.add_to_hass(hass)
    await hass.config_entries.async_setup(mock_config_entry.entry_id)
    await hass.async_block_till_done()

    assert mock_config_entry.state == ConfigEntryState.SETUP_RETRY


async def test_setup_entry_protect_unavailable(
    hass: HomeAssistant,
    mock_config_entry: MockConfigEntry,
    mock_network_client,
    mock_protect_client,
    mock_local_auth,
    enable_custom_integrations,
) -> None:
    """Test setup succeeds even if Protect is unavailable."""
    mock_protect_client.cameras.get_all.side_effect = Exception("Protect unavailable")

    mock_config_entry.add_to_hass(hass)
    await hass.config_entries.async_setup(mock_config_entry.entry_id)
    await hass.async_block_till_done()

    assert mock_config_entry.state == ConfigEntryState.LOADED


async def test_setup_entry_protect_only_console(
    hass: HomeAssistant,
    mock_config_entry: MockConfigEntry,
    mock_network_client,
    mock_protect_client,
    mock_local_auth,
    enable_custom_integrations,
) -> None:
    """Test setup succeeds on Protect-only console like UNVR (Issue 93)."""
    mock_network_client.sites.get_all.return_value = []

    mock_config_entry.add_to_hass(hass)
    await hass.config_entries.async_setup(mock_config_entry.entry_id)
    await hass.async_block_till_done()

    assert mock_config_entry.state == ConfigEntryState.LOADED


async def test_unload_entry(
    hass: HomeAssistant,
    init_integration: MockConfigEntry,
    enable_custom_integrations,
) -> None:
    """Test successful unload of a config entry."""
    assert await hass.config_entries.async_unload(init_integration.entry_id)
    await hass.async_block_till_done()

    assert init_integration.state == ConfigEntryState.NOT_LOADED


async def test_setup_entry_starts_protect_websocket(
    hass: HomeAssistant,
    init_integration: MockConfigEntry,
    enable_custom_integrations,
) -> None:
    """Test setup resolves host_id and starts the real-time WebSocket.

    Regression test for the dead `hasattr(..., "register_device_update_callback")`
    stub: the coordinator must actually invoke `get_host_id()` and hand a real
    background task to `ProtectWebSocket.subscribe_with_callback`, not just
    construct without error. Also confirms the second, independent "events"
    subscription (task 1 - without it, motion detection is permanently
    non-functional) starts alongside "devices".
    """
    runtime_data = init_integration.runtime_data
    protect_coordinator = runtime_data.protect_coordinator
    assert protect_coordinator is not None

    runtime_data.protect_client.get_host_id.assert_awaited_once()
    assert protect_coordinator.websocket_task is not None
    assert protect_coordinator.events_websocket_task is not None
    await protect_coordinator.websocket_task
    await protect_coordinator.events_websocket_task
    assert (
        protect_coordinator._protect_websocket.subscribe_with_callback.await_count == 2
    )


async def test_unload_entry_cancels_real_websocket_task(
    hass: HomeAssistant,
    init_integration: MockConfigEntry,
    enable_custom_integrations,
) -> None:
    """Test unload stops the ProtectWebSocket and cancels/awaits the real task.

    Regression test: `websocket_task.cancel()` alone does not stop
    `subscribe_with_callback`'s reconnect loop (it swallowed
    `CancelledError` and slept/reconnected instead), which would leave an
    orphaned WebSocket loop running after a config entry reload.
    """
    runtime_data = init_integration.runtime_data
    protect_coordinator = runtime_data.protect_coordinator
    assert protect_coordinator is not None
    websocket_task = protect_coordinator.websocket_task
    events_websocket_task = protect_coordinator.events_websocket_task
    assert websocket_task is not None
    assert events_websocket_task is not None

    assert await hass.config_entries.async_unload(init_integration.entry_id)
    await hass.async_block_till_done()

    assert init_integration.state == ConfigEntryState.NOT_LOADED
    # Called twice by design: once from async_unload_entry's explicit call
    # (correct ordering - stop before closing the Protect client) and once
    # more via the entry.async_on_unload safety net registered in
    # async_setup_entry (covers a setup failure that happens after the
    # WebSocket starts but before async_unload_entry ever runs).
    # async_stop_websocket() is idempotent, so this is expected, not a bug.
    assert protect_coordinator._protect_websocket.stop.call_count == 2
    assert websocket_task.done()
    assert events_websocket_task.done()


async def test_reload_entry(
    hass: HomeAssistant,
    init_integration: MockConfigEntry,
    enable_custom_integrations,
) -> None:
    """Test successful reload of a config entry."""
    await hass.config_entries.async_reload(init_integration.entry_id)
    await hass.async_block_till_done()

    assert init_integration.state == ConfigEntryState.LOADED


async def test_reload_entry_via_options_update(
    hass: HomeAssistant,
    init_integration: MockConfigEntry,
    enable_custom_integrations,
) -> None:
    """Test reload triggered by options update (update listener)."""
    # Update options to trigger the update listener (async_reload_entry)
    hass.config_entries.async_update_entry(
        init_integration,
        options={"track_wifi_clients": True},
    )
    await hass.async_block_till_done()

    # Entry should be reloaded and in loaded state
    assert init_integration.state == ConfigEntryState.LOADED


async def test_setup_entry_no_sites_found(
    hass: HomeAssistant,
    mock_config_entry: MockConfigEntry,
    mock_network_client,
    mock_protect_client,
    mock_local_auth,
    enable_custom_integrations,
) -> None:
    """Test setup fails when no sites and no protect NVR are found."""
    # Return empty list - no sites found
    mock_network_client.sites.get_all.return_value = []
    mock_protect_client.cameras.get_all.return_value = []
    mock_protect_client.nvr.get.return_value = None

    mock_config_entry.add_to_hass(hass)
    await hass.config_entries.async_setup(mock_config_entry.entry_id)
    await hass.async_block_till_done()

    # Should fail with auth failed (no sites and no protect means bad API key)
    assert mock_config_entry.state == ConfigEntryState.SETUP_ERROR


async def test_setup_entry_remote_connection(
    hass: HomeAssistant,
    mock_network_client,
    mock_protect_client,
    mock_local_auth,
    enable_custom_integrations,
) -> None:
    """Test setup with remote connection type includes Protect."""
    # Create remote config entry
    remote_entry = MockConfigEntry(
        domain="unifi_insights",
        data={
            "connection_type": "remote",
            "console_id": "test_console",
            "api_key": "test_api_key",
        },
        entry_id="remote_entry",
    )

    remote_entry.add_to_hass(hass)
    await hass.config_entries.async_setup(remote_entry.entry_id)
    await hass.async_block_till_done()

    assert remote_entry.state == ConfigEntryState.LOADED


async def test_unload_entry_with_websocket_task(
    hass: HomeAssistant,
    init_integration: MockConfigEntry,
    enable_custom_integrations,
) -> None:
    """Test unload entry cancels websocket task."""

    # Add a mock websocket task to the protect coordinator
    runtime_data = init_integration.runtime_data
    if runtime_data.protect_coordinator:
        mock_task = MagicMock()
        mock_task.cancel = MagicMock()
        runtime_data.protect_coordinator.websocket_task = mock_task

    assert await hass.config_entries.async_unload(init_integration.entry_id)
    await hass.async_block_till_done()

    assert init_integration.state == ConfigEntryState.NOT_LOADED


async def test_unload_entry_protect_close_error(
    hass: HomeAssistant,
    init_integration: MockConfigEntry,
    enable_custom_integrations,
) -> None:
    """Test unload entry handles protect client close error gracefully."""
    # Make protect client close raise an error
    runtime_data = init_integration.runtime_data
    if runtime_data.protect_client:
        runtime_data.protect_client.close = AsyncMock(
            side_effect=Exception("Close error")
        )

    # Should still unload successfully
    assert await hass.config_entries.async_unload(init_integration.entry_id)
    await hass.async_block_till_done()

    assert init_integration.state == ConfigEntryState.NOT_LOADED


async def test_unload_entry_network_close_error(
    hass: HomeAssistant,
    init_integration: MockConfigEntry,
    enable_custom_integrations,
) -> None:
    """Test unload entry handles network client close error gracefully."""
    # Make network client close raise an error
    runtime_data = init_integration.runtime_data
    runtime_data.network_client.close = AsyncMock(side_effect=Exception("Close error"))

    # Should still unload successfully
    assert await hass.config_entries.async_unload(init_integration.entry_id)
    await hass.async_block_till_done()

    assert init_integration.state == ConfigEntryState.NOT_LOADED


async def test_unifi_insights_data_coordinator_not_initialized(
    hass: HomeAssistant,
) -> None:
    """Test UnifiInsightsData raises error when facade coordinator not initialized."""
    # Create data object with None facade coordinator
    data = UnifiInsightsData(
        config_coordinator=MagicMock(),
        device_coordinator=MagicMock(),
        protect_coordinator=None,
        network_client=MagicMock(),
        protect_client=None,
        _facade_coordinator=None,
    )

    # Accessing coordinator property should raise RuntimeError
    with pytest.raises(RuntimeError, match="Facade coordinator not initialized"):
        _ = data.coordinator


def _device_entry(*identifiers: str) -> MagicMock:
    """Build a device registry entry stub with unifi_insights identifiers."""
    device = MagicMock()
    device.identifiers = {("unifi_insights", identifier) for identifier in identifiers}
    return device


def _entry_with_sites(available: dict[str, str], polled: list[str]) -> MagicMock:
    """Build a config entry whose config coordinator polls only some sites."""
    entry = MagicMock()
    entry.runtime_data.config_coordinator.available_sites = available
    entry.runtime_data.config_coordinator.get_site_ids.return_value = polled
    return entry


@pytest.mark.parametrize(
    ("identifiers", "expected"),
    [
        (("site2_device-1",), True),
        (("policy_based_routes_site2",), True),
        (("firewall_policies_site2",), True),
        (("vpn_clients_site2",), True),
        (("site_site2",), True),
        (("site_default",), False),
        # A Protect or WiFi id that happens to end in a site id is not site-scoped.
        (("protect_camera_site2",), False),
        (("wifi_site2",), False),
        (("default_device-1",), False),
        (("protect_camera_cam-1",), False),
        (("client_aa:bb:cc:dd:ee:ff",), False),
    ],
)
async def test_remove_config_entry_device_only_for_deselected_sites(
    hass: HomeAssistant,
    identifiers: tuple[str, ...],
    expected: bool,  # noqa: FBT001
) -> None:
    """Devices of a site dropped from the filter can be removed; nothing else (#128)."""
    entry = _entry_with_sites({"default": "Default", "site2": "Branch"}, ["default"])

    assert (
        await async_remove_config_entry_device(hass, entry, _device_entry(*identifiers))
        is expected
    )


async def test_remove_config_entry_device_refused_when_not_loaded(
    hass: HomeAssistant,
) -> None:
    """Without runtime data nothing is known about sites, so refuse."""
    entry = MagicMock(spec=["entry_id"])

    assert (
        await async_remove_config_entry_device(hass, entry, _device_entry("site2_dev"))
        is False
    )


async def test_revoked_key_after_setup_starts_reauth(
    hass: HomeAssistant,
    init_integration: MockConfigEntry,
    mock_network_client: MagicMock,
) -> None:
    """A key revoked while running starts reauth instead of failing silently."""
    assert init_integration.state == ConfigEntryState.LOADED
    config_coordinator = init_integration.runtime_data.config_coordinator
    device_coordinator = init_integration.runtime_data.device_coordinator
    mock_network_client.sites.get_all.return_value = [{"id": "default"}]
    await config_coordinator.async_refresh()
    await device_coordinator.async_refresh()
    assert device_coordinator.last_update_success is True

    mock_network_client.devices.get_all = AsyncMock(
        side_effect=UniFiAuthenticationError("Revoked", status_code=401)
    )
    await device_coordinator.async_refresh()
    await hass.async_block_till_done()

    assert device_coordinator.last_update_success is False
    assert init_integration.runtime_data.coordinator.device_available is False
    flows = hass.config_entries.flow.async_progress_by_handler("unifi_insights")
    assert [flow["context"]["source"] for flow in flows] == ["reauth"]


async def test_failed_wifi_refresh_marks_wifi_unavailable(
    hass: HomeAssistant,
    init_integration: MockConfigEntry,
    mock_network_client: MagicMock,
) -> None:
    """A failed WiFi refresh is reported, then recovery restores availability."""
    config_coordinator = init_integration.runtime_data.config_coordinator
    facade = init_integration.runtime_data.coordinator
    mock_network_client.sites.get_all.return_value = [{"id": "default"}]
    await config_coordinator.async_refresh()
    assert facade.config_available is True

    mock_network_client.wifi.get_all = AsyncMock(
        side_effect=UniFiConnectionError("Console rebooting")
    )
    await config_coordinator.async_refresh()
    await hass.async_block_till_done()
    assert facade.wifi_available("default") is False
    assert facade.firewall_available("default") is True
    assert facade.config_available is True
    assert facade.device_available is True

    mock_network_client.wifi.get_all = AsyncMock(return_value=[])
    await config_coordinator.async_refresh()
    await hass.async_block_till_done()
    assert facade.wifi_available("default") is True


@pytest.mark.parametrize(
    ("namespace", "method", "error", "flag"),
    [
        (
            "firewall",
            "list_rules",
            UniFiResponseError("Bad gateway", status_code=502),
            "firewall_available",
        ),
        (
            "wifi",
            "get_all",
            UniFiConnectionError("Connection reset"),
            "wifi_available",
        ),
    ],
    ids=["firewall-502", "wifi-connection"],
)
async def test_optional_section_failure_does_not_block_setup(
    hass: HomeAssistant,
    *,
    mock_config_entry: MockConfigEntry,
    mock_network_client: MagicMock,
    mock_protect_client: MagicMock,
    mock_local_auth: MagicMock,
    enable_custom_integrations: None,
    namespace: str,
    method: str,
    error: Exception,
    flag: str,
) -> None:
    """A WiFi/firewall outage at startup loads the entry, flagging only it."""
    mock_network_client.sites.get_all.return_value = [{"id": "default"}]
    setattr(
        getattr(mock_network_client, namespace), method, AsyncMock(side_effect=error)
    )
    mock_config_entry.add_to_hass(hass)

    await hass.config_entries.async_setup(mock_config_entry.entry_id)
    await hass.async_block_till_done()

    assert mock_config_entry.state == ConfigEntryState.LOADED
    facade = mock_config_entry.runtime_data.coordinator
    assert getattr(facade, flag)("default") is False
    assert facade.config_available is True


async def test_site_forbidden_at_setup_does_not_start_reauth(
    hass: HomeAssistant,
    *,
    mock_config_entry: MockConfigEntry,
    mock_network_client: MagicMock,
    mock_protect_client: MagicMock,
    mock_local_auth: MagicMock,
    enable_custom_integrations: None,
) -> None:
    """A 403 on the devices endpoint retries setup instead of looping reauth."""
    mock_network_client.sites.get_all.return_value = [{"id": "default"}]
    mock_network_client.devices.get_all = AsyncMock(
        side_effect=UniFiAuthenticationError("Forbidden", status_code=403)
    )
    mock_config_entry.add_to_hass(hass)

    await hass.config_entries.async_setup(mock_config_entry.entry_id)
    await hass.async_block_till_done()

    assert mock_config_entry.state == ConfigEntryState.SETUP_RETRY
    assert not hass.config_entries.flow.async_progress_by_handler("unifi_insights")
