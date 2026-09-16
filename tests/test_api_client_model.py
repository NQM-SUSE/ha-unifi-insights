"""Tests for vendored UniFi API client model parsing."""

import pytest
from pydantic import ValidationError

from custom_components.unifi_insights.api.network.models.client import Client
from custom_components.unifi_insights.api.network.models.device import (
    Device,
    DeviceState,
)
from custom_components.unifi_insights.api.network.models.dns import DNSPolicy
from custom_components.unifi_insights.api.network.models.lag import LAG, LagType
from custom_components.unifi_insights.api.network.models.resources import (
    VPNTunnel,
    WANInterface,
)
from custom_components.unifi_insights.api.network.models.site import Site, SiteHealth
from custom_components.unifi_insights.api.network.models.wifi import WifiNetwork
from custom_components.unifi_insights.api.protect.models.arm_profile import ArmProfile
from custom_components.unifi_insights.api.protect.models.doorlock import DoorLock
from custom_components.unifi_insights.api.protect.models.link_station import (
    AlarmHub,
    LinkStation,
)
from custom_components.unifi_insights.api.protect.models.viewport import Viewport


def test_client_model_accepts_vpn_type() -> None:
    """Client model should parse VPN client types returned by UniFi."""
    client = Client.model_validate({"id": "client-vpn", "type": "VPN"})

    assert client.type == "VPN"


def test_client_model_accepts_teleport_type() -> None:
    """Client model should parse TELEPORT client types returned by UniFi."""
    client = Client.model_validate({"id": "client-teleport", "type": "TELEPORT"})

    assert client.type == "TELEPORT"


def test_client_model_accepts_lowercase_teleport_type() -> None:
    """Client model should parse lowercase TELEPORT values case-insensitively."""
    client = Client.model_validate({"id": "client-teleport-lower", "type": "teleport"})

    assert client.type == "TELEPORT"


def test_device_state_accepts_network_10_4_states() -> None:
    """Device model should parse new Network 10.4.57 device states."""
    device = Device.model_validate(
        {"id": "dev-1", "name": "Switch", "state": "CONNECTION_INTERRUPTED"}
    )

    assert device.state == DeviceState.CONNECTION_INTERRUPTED


def test_device_parses_interfaces_features_and_uplink() -> None:
    """Device model should parse the new interfaces/features/uplink structures."""
    device = Device.model_validate(
        {
            "id": "dev-1",
            "name": "Switch",
            "features": {"switching": {"lags": [{"id": "lag-1"}]}},
            "interfaces": {
                "ports": [{"idx": 1, "connector": "RJ45", "speedMbps": 1000}]
            },
            "uplink": {"deviceId": "gw-1"},
        }
    )

    assert device.features is not None
    assert device.features.switching is not None
    assert device.features.switching.lags == [{"id": "lag-1"}]
    assert device.interfaces is not None
    assert device.interfaces.ports[0].speed_mbps == 1000
    assert device.uplink is not None
    assert device.uplink.device_id == "gw-1"


def test_lag_model_parses_members_and_type() -> None:
    """LAG model should parse membership entries and known types."""
    lag = LAG.model_validate(
        {
            "id": "lag-1",
            "type": "LOCAL",
            "members": [{"deviceId": "dev-1", "portIdxs": [1, 2, 3]}],
        }
    )

    assert lag.type == LagType.LOCAL
    assert lag.members[0].device_id == "dev-1"
    assert lag.members[0].port_idxs == [1, 2, 3]


def test_lag_model_tolerates_unknown_type() -> None:
    """LAG model should keep unknown enum values as strings."""
    lag = LAG.model_validate({"id": "lag-1", "type": "FUTURE_TYPE"})

    assert lag.type == "FUTURE_TYPE"


def test_alarm_hub_is_link_station_alias() -> None:
    """Alarm hub should share the LinkStation model and parse aliases."""
    assert AlarmHub is LinkStation

    hub = AlarmHub.model_validate(
        {"id": "hub-1", "modelKey": "linkStation", "isAlarmHub": True}
    )

    assert hub.model_key == "linkStation"
    assert hub.is_alarm_hub is True


def test_arm_profile_parses_aliases() -> None:
    """Arm profile should parse camelCase aliases into snake_case fields."""
    profile = ArmProfile.model_validate(
        {"id": "p-1", "name": "Away", "recordEverything": True, "activationDelay": 30}
    )

    assert profile.record_everything is True
    assert profile.activation_delay == 30


def test_doorlock_and_viewport_parse_ws_payloads() -> None:
    """DoorLock and Viewport models should parse WebSocket update payloads."""
    lock = DoorLock.model_validate(
        {"id": "lock-1", "modelKey": "doorlock", "lockState": "LOCKED"}
    )
    viewport = Viewport.model_validate(
        {"id": "vp-1", "modelKey": "viewport", "liveview": "lv-1"}
    )

    assert lock.lock_state == "LOCKED"
    assert viewport.liveview == "lv-1"


def test_site_model_parses_payload_without_id() -> None:
    """Site model should fall back to internalReference when id is missing."""
    site = Site.model_validate({"internalReference": "default", "name": "Default"})

    assert site.id == "default"
    assert site.name == "Default"
    assert site.internal_reference == "default"
    assert site.display_name == "Default"


def test_site_model_parses_payload_with_id_and_internal_reference() -> None:
    """Site model should preserve explicit id when provided."""
    site = Site.model_validate(
        {
            "id": "site-uuid-123",
            "name": "Branch Office",
            "internalReference": "branch",
            "health": "healthy",
        }
    )

    assert site.id == "site-uuid-123"
    assert site.name == "Branch Office"
    assert site.internal_reference == "branch"
    assert site.health == SiteHealth.HEALTHY


def test_site_model_fallback_to_name_when_internal_reference_missing() -> None:
    """Site model should fall back to name when reference is missing."""
    site = Site.model_validate({"name": "Warehouse"})

    assert site.id == "Warehouse"
    assert site.name == "Warehouse"


def test_device_parses_list_features_and_interfaces_issue_94() -> None:
    """Device model should parse list-format features and interfaces (Issue #94)."""
    device = Device.model_validate(
        {
            "id": "udr-1",
            "name": "UniFi Dream Router",
            "model": "UDR",
            "features": ["accessPoint"],
            "interfaces": ["ports", "radios"],
            "uplink": "gw-1",
        }
    )

    assert device.id == "udr-1"
    assert device.name == "UniFi Dream Router"
    assert device.features == ["accessPoint"]
    assert device.interfaces == ["ports", "radios"]
    assert device.uplink == "gw-1"


def test_device_parses_mixed_types_and_tolerates_unknowns() -> None:
    """Device model should tolerate flexible port, metric, and feature structures."""
    device = Device.model_validate(
        {
            "id": "dev-custom",
            "name": "Custom Device",
            "features": ["switching", "accessPoint"],
            "interfaces": ["ports"],
            "ports": [{"portIdx": 1, "name": "Port 1"}, {"customField": "value"}],
            "cpuUtilization": "12.5",
            "memoryUtilization": 45,
            "uptime": 12345.67,
            "lastSeen": "2026-08-25T07:00:00Z",
        }
    )

    assert device.id == "dev-custom"
    assert device.features == ["switching", "accessPoint"]
    assert device.interfaces == ["ports"]
    assert len(device.ports) == 2


def test_device_without_id_falls_back_to_mac_issue_128() -> None:
    """A device payload with no id should key off its MAC address (Issue #128)."""
    device = Device.model_validate(
        {
            "macAddress": "e0:63:da:00:00:01",
            "name": "AC Mesh",
            "model": "UAP-AC-M",
            "interfaces": ["radios"],
        }
    )

    assert device.id == "e0:63:da:00:00:01"
    assert device.mac == "e0:63:da:00:00:01"
    assert device.name == "AC Mesh"


def test_device_without_id_or_mac_is_rejected() -> None:
    """A name is not a stable key, so a payload with no id or MAC is rejected."""
    with pytest.raises(ValidationError):
        Device.model_validate({"name": "AC Mesh", "model": "UAP-AC-M"})


def test_client_model_accepts_unknown_client_type() -> None:
    """Client model should keep unknown client type strings."""
    client = Client.model_validate({"id": "c-1", "type": "CUSTOM_VPN"})

    assert client.type == "CUSTOM_VPN"


def test_wifi_model_accepts_unknown_security() -> None:
    """WiFi model should accept new/unknown security types."""
    wifi = WifiNetwork.model_validate(
        {"id": "w-1", "name": "Guest", "security": "WPA3_ENTERPRISE_192"}
    )

    assert wifi.security == "WPA3_ENTERPRISE_192"


def test_dns_model_accepts_unknown_type() -> None:
    """DNS model should accept new/unknown DNS record types."""
    dns = DNSPolicy.model_validate({"id": "d-1", "type": "HTTPS_RECORD"})

    assert dns.type == "HTTPS_RECORD"


def test_resources_model_accepts_unknown_statuses() -> None:
    """WAN and VPN tunnel models should accept unknown status strings."""
    wan = WANInterface.model_validate(
        {"id": "wan-1", "name": "WAN", "status": "DEGRADED"}
    )
    vpn = VPNTunnel.model_validate(
        {"id": "vpn-1", "name": "Site-to-Site", "status": "PAUSED"}
    )

    assert wan.status == "DEGRADED"
    assert vpn.status == "PAUSED"
