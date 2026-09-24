# Copyright 2026 UniFi Insights contributors
"""Tests for optional, account-wide Site Manager polling."""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING
from unittest.mock import AsyncMock, MagicMock, patch

from custom_components.unifi_insights.api import (
    UniFiRateLimitError,
    UniFiResponseError,
)
from custom_components.unifi_insights.coordinators.site_manager import (
    UnifiInsightsSiteManagerCoordinator,
    async_acquire_site_manager,
    async_release_site_manager,
)
from custom_components.unifi_insights.diagnostics import _site_manager_summary

if TYPE_CHECKING:
    import pytest
    from homeassistant.core import HomeAssistant


def _client() -> MagicMock:
    """Build a client whose five collections can be varied independently."""
    client = MagicMock()
    client.list_hosts = AsyncMock(return_value=[{"id": "host-secret"}])
    client.list_sites = AsyncMock(
        return_value=[{"siteId": "site-secret", "hostId": "host-secret"}]
    )
    client.list_devices = AsyncMock(
        return_value=[{"hostId": "host-secret", "devices": [{"id": "device"}]}]
    )
    client.get_isp_metrics = AsyncMock(
        return_value=[
            {
                "hostId": "host-secret",
                "siteId": "site-secret",
                "periods": [
                    {
                        "metricTime": "2026-01-02T03:05:00Z",
                        "data": {"wan": {"avgLatency": 5, "ispName": "private ISP"}},
                    },
                    {
                        "metricTime": "2026-01-02T03:10:00Z",
                        "data": {"wan": {"avgLatency": 2, "ispName": "private ISP"}},
                    },
                ],
            }
        ]
    )
    client.list_sd_wan_configs = AsyncMock(
        return_value=[
            {"id": "config-secret", "name": "Private VPN", "type": "sdwan-hbsp"}
        ]
    )
    client.close = AsyncMock()
    return client


async def test_partial_failure_keeps_last_good_collection(
    hass: HomeAssistant, caplog: pytest.LogCaptureFixture
) -> None:
    """A failed sites call must not erase inventory or newer ISP data."""
    client = _client()
    coordinator = UnifiInsightsSiteManagerCoordinator(hass, client)
    first = await coordinator._async_update_data()
    coordinator.data = first

    assert first["sites"]["site-secret"]["hostId"] == "host-secret"
    assert first["isp_metrics"]["host-secret"]["site-secret"]["wan"] == {
        "avgLatency": 2
    }
    assert first["collections"]["sites"]["available"]
    metric_query = client.get_isp_metrics.call_args.kwargs
    assert metric_query["end_timestamp"] - metric_query["begin_timestamp"] == (
        timedelta(hours=1)
    )

    client.list_sites.side_effect = UniFiResponseError("temporary", status_code=502)
    client.list_hosts.return_value = [{"id": "new-host"}]
    caplog.set_level(
        logging.INFO,
        logger="custom_components.unifi_insights.coordinators.site_manager",
    )
    second = await coordinator._async_update_data()

    assert second["sites"] == first["sites"]
    assert second["hosts"] == {"new-host": {"id": "new-host"}}
    assert second["collections"]["sites"]["available"] is False
    assert second["collections"]["sites"]["error"] == "UniFiResponseError"
    assert (
        caplog.messages.count("Site Manager sites unavailable (UniFiResponseError)")
        == 1
    )
    assert "temporary" not in caplog.text

    coordinator.data = second
    await coordinator._async_update_data()
    assert (
        caplog.messages.count("Site Manager sites unavailable (UniFiResponseError)")
        == 1
    )

    client.list_sites.side_effect = None
    recovered = await coordinator._async_update_data()
    assert recovered["collections"]["sites"]["available"] is True
    assert caplog.messages.count("Site Manager sites available again") == 1


async def test_rate_limit_skips_requests_until_retry_after(hass: HomeAssistant) -> None:
    """A cloud 429 applies a shared cooldown to the account."""
    client = _client()
    client.list_hosts.side_effect = UniFiRateLimitError(
        "limited", status_code=429, retry_after=3600
    )
    coordinator = UnifiInsightsSiteManagerCoordinator(hass, client)
    coordinator.data = await coordinator._async_update_data()
    before = client.list_sites.await_count

    await coordinator._async_update_data()

    assert client.list_sites.await_count == before
    assert coordinator.data["cooldown_until"] is not None
    assert coordinator.data["collections"]["hosts"]["available"] is False

    coordinator._cooldown_until = datetime.now(UTC) - timedelta(seconds=1)
    client.list_hosts.side_effect = None
    resumed = await coordinator._async_update_data()
    assert resumed["cooldown_until"] is None
    assert client.list_sites.await_count == before + 1


async def test_same_key_shares_coordinator_until_last_unload(
    hass: HomeAssistant,
) -> None:
    """Multiple console entries reuse one account poller and close it once."""
    client = _client()
    coordinator = MagicMock()
    coordinator.async_refresh = AsyncMock()
    coordinator.async_shutdown = AsyncMock()
    with (
        patch(
            "custom_components.unifi_insights.coordinators.site_manager."
            "UniFiSiteManagerClient",
            return_value=client,
        ) as client_class,
        patch(
            "custom_components.unifi_insights.coordinators.site_manager."
            "UnifiInsightsSiteManagerCoordinator",
            return_value=coordinator,
        ),
    ):
        key1, account1 = await async_acquire_site_manager(
            hass, "same-key", "entry-1", MagicMock()
        )
        key2, account2 = await async_acquire_site_manager(
            hass, "same-key", "entry-2", MagicMock()
        )
        assert key1 == key2
        assert account1 is account2
        client_class.assert_called_once()
        assert account1.initial_refresh is not None
        await account1.initial_refresh
        coordinator.async_refresh.assert_awaited_once()

        await async_release_site_manager(hass, key1, "entry-1")
        coordinator.async_shutdown.assert_not_awaited()
        await async_release_site_manager(hass, key2, "entry-2")
        coordinator.async_shutdown.assert_awaited_once()
        client.close.assert_awaited_once()


def test_diagnostics_omit_cloud_identity_and_raw_metadata() -> None:
    """The exported Site Manager section contains only bounded, safe fields."""
    sample = {
        "hosts": {"host-secret": {"id": "host-secret", "ipAddress": "203.0.113.9"}},
        "sites": {"site-secret": {"siteId": "site-secret", "hostId": "host-secret"}},
        "devices": {"host-secret": {"devices": [{"id": "device-secret"}]}},
        "isp_metrics": {
            "host-secret": {
                "site-secret": {
                    "metric_time": datetime(2026, 1, 2, tzinfo=UTC).isoformat(),
                    "wan": {"avgLatency": 2, "ispName": "private ISP"},
                }
            }
        },
        "sd_wan_configs": {
            "config-secret": {
                "id": "config-secret",
                "name": "Private VPN",
                "type": "sdwan-hbsp",
            }
        },
        "collections": {
            "hosts": {"available": True, "updated_at": None, "error": None}
        },
        "last_attempt": None,
        "cooldown_until": None,
    }

    summary = _site_manager_summary(sample, "host-secret")
    rendered = repr(summary)
    assert summary["selected_host"]["site_count"] == 1
    assert summary["selected_host"]["isp_samples"][0]["wan"] == {"avgLatency": 2}
    for secret in (
        "host-secret",
        "site-secret",
        "device-secret",
        "config-secret",
        "Private VPN",
        "private ISP",
        "203.0.113.9",
    ):
        assert secret not in rendered
