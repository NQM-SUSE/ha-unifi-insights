"""Tests for UniFi Insights console identity separation (PR D).

Verifies:
1. Changing host or re-authenticating preserves entity IDs,
   device links, and integration options.
2. Duplicate configuration entries for the same physical console
   are prevented even if different hosts or credentials are provided.
3. Multi-console cloud setup with the same API key succeeds.
4. Backward compatibility with v1/v2 schema entries without user intervention.
5. Migration preserves existing Home Assistant entity unique IDs and options.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, ClassVar
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from homeassistant import config_entries
from homeassistant.const import CONF_API_KEY, CONF_HOST, CONF_VERIFY_SSL
from homeassistant.data_entry_flow import FlowResultType
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.unifi_insights import (
    _first_site_id,
    _is_console_device,
    async_migrate_entry,
)
from custom_components.unifi_insights.const import (
    CONF_CLIENT_CONTROL,
    CONF_CONNECTION_TYPE,
    CONF_CONSOLE_ID,
    CONF_CONSOLE_NAME,
    CONF_TRACK_CLIENTS,
    CONF_TRACK_WIFI_CLIENTS,
    CONF_TRACK_WIRED_CLIENTS,
    CONNECTION_TYPE_LOCAL,
    CONNECTION_TYPE_REMOTE,
    DOMAIN,
)

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant
    from homeassistant.helpers import (
        device_registry as dr,
    )
    from homeassistant.helpers import (
        entity_registry as er,
    )

pytestmark = pytest.mark.usefixtures("enable_custom_integrations")


def _remote_host(
    host_id: str = "console123", hostname: str = "Dream Machine Pro"
) -> dict[str, object]:
    """Create a discovered remote host payload."""
    return {
        "id": host_id,
        "type": "console",
        "reportedState": {"hostname": hostname},
    }


def _make_mock_client(get_hosts=None, sites=None, devices=None, cameras=None, nvr=None):
    """Create a configured mock client."""
    client = MagicMock()
    if get_hosts is not None:
        client.get_hosts = AsyncMock(return_value=get_hosts)
    else:
        client.get_hosts = AsyncMock(return_value=[])

    client.sites = MagicMock()
    client.sites.get_all = AsyncMock(return_value=sites if sites is not None else [])
    client.devices = MagicMock()
    client.devices.get_all = AsyncMock(
        return_value=devices if devices is not None else []
    )
    client.cameras = MagicMock()
    client.cameras.get_all = AsyncMock(
        return_value=cameras if cameras is not None else []
    )
    client.nvr = MagicMock()
    client.nvr.get = AsyncMock(return_value=nvr)
    client.close = AsyncMock()

    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=client)
    cm.__aexit__ = AsyncMock(return_value=None)
    return cm, client


async def test_duplicate_remote_console_prevented(
    hass: HomeAssistant,
) -> None:
    """Test duplicate remote configuration entries for the same console are prevented.

    Even if different credentials/API keys are provided, duplicate console entries
    must abort with already_configured.
    """
    existing_entry = MockConfigEntry(
        domain=DOMAIN,
        unique_id="console123",
        title="UniFi - Dream Machine Pro",
        data={
            CONF_CONNECTION_TYPE: CONNECTION_TYPE_REMOTE,
            CONF_CONSOLE_ID: "console123",
            CONF_API_KEY: "api_key_1",
        },
    )
    existing_entry.add_to_hass(hass)

    discovery_cm, _ = _make_mock_client(
        get_hosts=[_remote_host("console123", "Dream Machine Pro")]
    )
    validation_net_cm, _ = _make_mock_client(
        sites=[MagicMock(id="site1", name="Default")]
    )

    with (
        patch(
            "custom_components.unifi_insights.config_flow.UniFiNetworkClient",
            side_effect=[discovery_cm, validation_net_cm],
        ),
        patch("custom_components.unifi_insights.config_flow.ApiKeyAuth"),
    ):
        result = await hass.config_entries.flow.async_init(
            DOMAIN, context={"source": config_entries.SOURCE_USER}
        )
        result = await hass.config_entries.flow.async_configure(
            result["flow_id"],
            user_input={CONF_CONNECTION_TYPE: CONNECTION_TYPE_REMOTE},
        )
        result = await hass.config_entries.flow.async_configure(
            result["flow_id"],
            user_input={CONF_API_KEY: "different_api_key_2"},
        )
        result = await hass.config_entries.flow.async_configure(
            result["flow_id"],
            user_input={CONF_CONSOLE_ID: "console123"},
        )

        assert result["type"] == FlowResultType.ABORT
        assert result["reason"] == "already_configured"


async def test_multi_console_cloud_setup_same_api_key(
    hass: HomeAssistant,
) -> None:
    """Test that two different consoles under the same cloud API key succeed.

    Under the legacy schema, the unique_id was the API key, which blocked
    adding multiple consoles on the same UI account. With PR D, console_id
    is the unique_id, allowing multi-console cloud setups.
    """
    hosts = [
        _remote_host("console_home", "Home UDM"),
        _remote_host("console_office", "Office UDM"),
    ]

    discovery_cm1, _ = _make_mock_client(get_hosts=hosts)
    validation_cm1, _ = _make_mock_client(
        sites=[MagicMock(id="default", name="Default")]
    )
    discovery_cm2, _ = _make_mock_client(get_hosts=hosts)
    validation_cm2, _ = _make_mock_client(
        sites=[MagicMock(id="default", name="Default")]
    )

    with (
        patch(
            "custom_components.unifi_insights.config_flow.UniFiNetworkClient",
            side_effect=[discovery_cm1, validation_cm1, discovery_cm2, validation_cm2],
        ),
        patch("custom_components.unifi_insights.config_flow.ApiKeyAuth"),
        patch(
            "custom_components.unifi_insights.async_setup_entry",
            return_value=True,
        ),
    ):
        # Configure first console
        r1 = await hass.config_entries.flow.async_init(
            DOMAIN, context={"source": config_entries.SOURCE_USER}
        )
        r1 = await hass.config_entries.flow.async_configure(
            r1["flow_id"],
            user_input={CONF_CONNECTION_TYPE: CONNECTION_TYPE_REMOTE},
        )
        r1 = await hass.config_entries.flow.async_configure(
            r1["flow_id"],
            user_input={CONF_API_KEY: "shared_account_key"},
        )
        assert r1["type"] == FlowResultType.FORM
        assert r1["step_id"] == "select_console"

        r1 = await hass.config_entries.flow.async_configure(
            r1["flow_id"],
            user_input={CONF_CONSOLE_ID: "console_home"},
        )
        assert r1["type"] == FlowResultType.CREATE_ENTRY
        assert r1["title"] == "UniFi - Home UDM"
        assert r1["result"].unique_id == "console_home"

        # Configure second console with the exact same API key
        r2 = await hass.config_entries.flow.async_init(
            DOMAIN, context={"source": config_entries.SOURCE_USER}
        )
        r2 = await hass.config_entries.flow.async_configure(
            r2["flow_id"],
            user_input={CONF_CONNECTION_TYPE: CONNECTION_TYPE_REMOTE},
        )
        r2 = await hass.config_entries.flow.async_configure(
            r2["flow_id"],
            user_input={CONF_API_KEY: "shared_account_key"},
        )
        assert r2["type"] == FlowResultType.FORM
        assert r2["step_id"] == "select_console"

        r2 = await hass.config_entries.flow.async_configure(
            r2["flow_id"],
            user_input={CONF_CONSOLE_ID: "console_office"},
        )
        assert r2["type"] == FlowResultType.CREATE_ENTRY
        assert r2["title"] == "UniFi - Office UDM"
        assert r2["result"].unique_id == "console_office"


async def test_reconfiguring_host_preserves_unique_id_and_options(
    hass: HomeAssistant,
) -> None:
    """Test reconfiguring host preserves entry unique ID, title, and options."""
    entry = MockConfigEntry(
        domain=DOMAIN,
        unique_id="11:22:33:44:55:66",
        title="UniFi - UDM Pro",
        data={
            CONF_CONNECTION_TYPE: CONNECTION_TYPE_LOCAL,
            CONF_HOST: "https://192.168.1.1",
            CONF_API_KEY: "test_key",
            CONF_VERIFY_SSL: False,
        },
        options={
            CONF_TRACK_WIFI_CLIENTS: True,
            CONF_TRACK_WIRED_CLIENTS: False,
            CONF_CLIENT_CONTROL: True,
        },
    )
    entry.add_to_hass(hass)

    gateway_dev = MagicMock(type="udm-pro", mac="11:22:33:44:55:66", name="UDM Pro")
    net_cm, _ = _make_mock_client(
        sites=[MagicMock(id="site1", name="Default")],
        devices=[gateway_dev],
    )

    with (
        patch(
            "custom_components.unifi_insights.config_flow.UniFiNetworkClient",
            return_value=net_cm,
        ),
        patch("custom_components.unifi_insights.config_flow.LocalAuth"),
        patch(
            "custom_components.unifi_insights.async_setup_entry",
            return_value=True,
        ),
    ):
        result = await hass.config_entries.flow.async_init(
            DOMAIN,
            context={
                "source": config_entries.SOURCE_RECONFIGURE,
                "entry_id": entry.entry_id,
            },
        )
        assert result["type"] == FlowResultType.FORM
        assert result["step_id"] == "reconfigure"

        result = await hass.config_entries.flow.async_configure(
            result["flow_id"],
            user_input={
                CONF_HOST: "https://192.168.1.200",
                CONF_API_KEY: "test_key",
                CONF_VERIFY_SSL: True,
            },
        )

        assert result["type"] == FlowResultType.ABORT
        assert result["reason"] == "reconfigure_successful"

        assert entry.unique_id == "11:22:33:44:55:66"
        assert entry.title == "UniFi - UDM Pro"
        assert entry.data[CONF_HOST] == "https://192.168.1.200"
        assert entry.data[CONF_VERIFY_SSL] is True
        assert entry.options[CONF_TRACK_WIFI_CLIENTS] is True
        assert entry.options[CONF_TRACK_WIRED_CLIENTS] is False
        assert entry.options[CONF_CLIENT_CONTROL] is True


async def test_reauth_preserves_unique_id_and_options(
    hass: HomeAssistant,
) -> None:
    """Test re-authenticating preserves entry unique ID and options."""
    entry = MockConfigEntry(
        domain=DOMAIN,
        unique_id="console123",
        title="UniFi - Dream Router",
        data={
            CONF_CONNECTION_TYPE: CONNECTION_TYPE_REMOTE,
            CONF_CONSOLE_ID: "console123",
            CONF_API_KEY: "old_expired_key",
        },
        options={
            CONF_TRACK_WIFI_CLIENTS: False,
            CONF_TRACK_WIRED_CLIENTS: True,
            CONF_CLIENT_CONTROL: False,
        },
    )
    entry.add_to_hass(hass)

    discovery_cm, _ = _make_mock_client(
        get_hosts=[_remote_host("console123", "Dream Router")]
    )
    validation_cm, _ = _make_mock_client(
        sites=[MagicMock(id="default", name="Default")]
    )

    with (
        patch(
            "custom_components.unifi_insights.config_flow.UniFiNetworkClient",
            side_effect=[discovery_cm, validation_cm],
        ),
        patch("custom_components.unifi_insights.config_flow.ApiKeyAuth"),
        patch(
            "custom_components.unifi_insights.async_setup_entry",
            return_value=True,
        ),
    ):
        result = await entry.start_reauth_flow(hass)
        assert result["type"] == FlowResultType.FORM
        assert result["step_id"] == "reauth_confirm"

        result = await hass.config_entries.flow.async_configure(
            result["flow_id"],
            user_input={CONF_API_KEY: "brand_new_api_key_456"},
        )

        assert result["type"] == FlowResultType.ABORT
        assert result["reason"] == "reauth_successful"

        assert entry.unique_id == "console123"
        assert entry.data[CONF_API_KEY] == "brand_new_api_key_456"
        assert entry.options[CONF_TRACK_WIFI_CLIENTS] is False
        assert entry.options[CONF_TRACK_WIRED_CLIENTS] is True
        assert entry.options[CONF_CLIENT_CONTROL] is False


async def test_migration_v1_to_v1_2(
    hass: HomeAssistant,
) -> None:
    """Test migration from v1 schema where unique_id was the API key."""
    legacy_entry = MockConfigEntry(
        version=1,
        minor_version=0,
        domain=DOMAIN,
        title="UniFi Insights (Cloud)",
        unique_id="legacy_api_key_123",
        data={
            CONF_CONNECTION_TYPE: CONNECTION_TYPE_REMOTE,
            CONF_CONSOLE_ID: "cloud_console_456",
            CONF_API_KEY: "legacy_api_key_123",
        },
        options={
            CONF_TRACK_CLIENTS: True,
        },
    )
    legacy_entry.add_to_hass(hass)

    migrated = await async_migrate_entry(hass, legacy_entry)
    assert migrated is True
    assert legacy_entry.version == 1
    assert legacy_entry.minor_version == 2
    assert legacy_entry.unique_id == "cloud_console_456"
    assert legacy_entry.options[CONF_TRACK_CLIENTS] is True


async def test_migration_leaves_stable_unique_id_intact(
    hass: HomeAssistant,
) -> None:
    """Test migration does not alter unique_id if it was already stable."""
    stable_entry = MockConfigEntry(
        version=1,
        minor_version=1,
        domain=DOMAIN,
        title="UniFi - UDM",
        unique_id="aa:bb:cc:dd:ee:ff",
        data={
            CONF_CONNECTION_TYPE: CONNECTION_TYPE_LOCAL,
            CONF_HOST: "https://192.168.1.1",
            CONF_API_KEY: "my_api_key",
        },
        options={},
    )
    stable_entry.add_to_hass(hass)

    migrated = await async_migrate_entry(hass, stable_entry)
    assert migrated is True
    assert stable_entry.version == 1
    assert stable_entry.minor_version == 2
    assert stable_entry.unique_id == "aa:bb:cc:dd:ee:ff"


async def test_transport_change_preserves_device_and_entity_registry(
    hass: HomeAssistant,
    device_registry: dr.DeviceRegistry,
    entity_registry: er.EntityRegistry,
) -> None:
    """Test that entities and device links survive a host reconfiguration."""
    entry = MockConfigEntry(
        domain=DOMAIN,
        unique_id="console_abc_123",
        title="UniFi - Console",
        data={
            CONF_CONNECTION_TYPE: CONNECTION_TYPE_LOCAL,
            CONF_HOST: "https://192.168.1.1",
            CONF_API_KEY: "initial_key",
            CONF_VERIFY_SSL: False,
        },
    )
    entry.add_to_hass(hass)

    device = device_registry.async_get_or_create(
        config_entry_id=entry.entry_id,
        identifiers={(DOMAIN, "gateway_mac_123")},
        name="Gateway Router",
        manufacturer="Ubiquiti Inc.",
        model="UDM-Pro",
    )
    assert device is not None

    entity = entity_registry.async_get_or_create(
        domain="sensor",
        platform=DOMAIN,
        unique_id="gateway_mac_123_cpu_utilization",
        config_entry=entry,
        device_id=device.id,
        suggested_object_id="gateway_router_cpu_utilization",
    )
    assert entity is not None
    original_entity_id = entity.entity_id

    gateway_dev = MagicMock(type="udm-pro", mac="123", name="Gateway Router")
    net_cm, _ = _make_mock_client(
        sites=[MagicMock(id="site1", name="Default")],
        devices=[gateway_dev],
    )

    with (
        patch(
            "custom_components.unifi_insights.config_flow.UniFiNetworkClient",
            return_value=net_cm,
        ),
        patch("custom_components.unifi_insights.config_flow.LocalAuth"),
        patch(
            "custom_components.unifi_insights.async_setup_entry",
            return_value=True,
        ),
    ):
        result = await hass.config_entries.flow.async_init(
            DOMAIN,
            context={
                "source": config_entries.SOURCE_RECONFIGURE,
                "entry_id": entry.entry_id,
            },
        )
        result = await hass.config_entries.flow.async_configure(
            result["flow_id"],
            user_input={
                CONF_HOST: "https://10.0.0.1",
                CONF_API_KEY: "replaced_api_key",
                CONF_VERIFY_SSL: True,
            },
        )
        assert result["type"] == FlowResultType.ABORT
        assert result["reason"] == "reconfigure_successful"

    registered_device = device_registry.async_get_device_by_identifier(
        (DOMAIN, "gateway_mac_123"), entry.entry_id
    )
    assert registered_device is not None
    assert registered_device.id == device.id
    assert entry.entry_id in registered_device.config_entries

    registered_entity = entity_registry.async_get(original_entity_id)
    assert registered_entity is not None
    assert registered_entity.unique_id == "gateway_mac_123_cpu_utilization"
    assert registered_entity.device_id == device.id
    assert registered_entity.config_entry_id == entry.entry_id


async def test_duplicate_local_console_prevented(
    hass: HomeAssistant,
) -> None:
    """Test duplicate local configuration entries for the same console are prevented."""
    existing_entry = MockConfigEntry(
        domain=DOMAIN,
        unique_id="11:22:33:44:55:66",
        title="UniFi - UDM Pro",
        data={
            CONF_CONNECTION_TYPE: CONNECTION_TYPE_LOCAL,
            CONF_HOST: "https://192.168.1.1",
            CONF_API_KEY: "key_1",
            CONF_CONSOLE_ID: "11:22:33:44:55:66",
        },
    )
    existing_entry.add_to_hass(hass)

    gateway_dev = MagicMock(type="udm-pro", mac="11:22:33:44:55:66", name="UDM Pro")
    net_cm, _ = _make_mock_client(
        sites=[MagicMock(id="site1", name="Default")],
        devices=[gateway_dev],
    )

    with (
        patch(
            "custom_components.unifi_insights.config_flow.UniFiNetworkClient",
            return_value=net_cm,
        ),
        patch("custom_components.unifi_insights.config_flow.LocalAuth"),
    ):
        result = await hass.config_entries.flow.async_init(
            DOMAIN, context={"source": config_entries.SOURCE_USER}
        )
        result = await hass.config_entries.flow.async_configure(
            result["flow_id"],
            user_input={CONF_CONNECTION_TYPE: CONNECTION_TYPE_LOCAL},
        )
        result = await hass.config_entries.flow.async_configure(
            result["flow_id"],
            user_input={
                CONF_HOST: "https://192.168.1.50",
                CONF_API_KEY: "different_key_2",
            },
        )

        assert result["type"] == FlowResultType.ABORT
        assert result["reason"] == "already_configured"


async def test_reconfigure_local_account_mismatch(
    hass: HomeAssistant,
) -> None:
    """Test reconfiguring local console to an IP on a different console aborts."""
    entry = MockConfigEntry(
        domain=DOMAIN,
        unique_id="11:22:33:44:55:66",
        title="UniFi - UDM Pro",
        data={
            CONF_CONNECTION_TYPE: CONNECTION_TYPE_LOCAL,
            CONF_HOST: "https://192.168.1.1",
            CONF_API_KEY: "initial_key",
            CONF_CONSOLE_ID: "11:22:33:44:55:66",
        },
    )
    entry.add_to_hass(hass)

    different_gateway = MagicMock(
        type="udm-se", mac="99:88:77:66:55:44", name="Different Console"
    )
    net_cm, _ = _make_mock_client(
        sites=[MagicMock(id="site1", name="Default")],
        devices=[different_gateway],
    )

    with (
        patch(
            "custom_components.unifi_insights.config_flow.UniFiNetworkClient",
            return_value=net_cm,
        ),
        patch("custom_components.unifi_insights.config_flow.LocalAuth"),
    ):
        result = await hass.config_entries.flow.async_init(
            DOMAIN,
            context={
                "source": config_entries.SOURCE_RECONFIGURE,
                "entry_id": entry.entry_id,
            },
        )
        result = await hass.config_entries.flow.async_configure(
            result["flow_id"],
            user_input={
                CONF_HOST: "https://10.0.0.1",
                CONF_API_KEY: "initial_key",
            },
        )
        assert result["type"] == FlowResultType.ABORT
        assert result["reason"] == "account_mismatch"


class TestConsoleDeviceDetection:
    """Identify the console among the Network devices.

    Pinned to the shape the API actually returns: every device carries a
    `model` and leaves `type` unset, so matching on `type` alone never fires
    and the console identity silently degrades to the host address - the
    exact coupling this separation exists to remove.
    """

    # Verbatim from a live console's device list.
    LIVE_DEVICES: ClassVar[list[dict[str, Any]]] = [
        {"name": "USP PDU Pro", "model": "USP PDU Pro", "type": None},
        {"name": "Switch Pro Max 24", "model": "USW Pro Max 24", "type": None},
        {"name": "USW Flex 2.5G 5", "model": "USW Flex 2.5G 5", "type": None},
        {"name": "USW-Lite-8-PoE", "model": "USW-Lite-8-PoE", "type": None},
        {"name": "U7 Pro XGS", "model": "U7 Pro XGS", "type": None},
        {
            "name": "Crestwood",
            "model": "UniFi Dream Machine PRO SE",
            "type": None,
            "macAddress": "AA:BB:CC:DD:EE:FF",
        },
    ]

    def test_console_found_by_model_when_type_is_unset(self):
        """The Dream Machine is the console; the switches and AP are not."""
        consoles = [d for d in self.LIVE_DEVICES if _is_console_device(d)]

        assert [d["name"] for d in consoles] == ["Crestwood"]

    def test_is_gateway_flag_still_wins(self):
        """A device that declares itself a gateway needs no model match."""
        assert _is_console_device({"model": "Mystery Box", "is_gateway": True})

    def test_plain_switch_is_not_a_console(self):
        assert not _is_console_device({"model": "USW Pro Max 24", "type": None})

    def test_first_site_id_skips_the_default_placeholder(self):
        """A real site id is a stable identity; "default" is not."""
        coordinator = MagicMock()
        coordinator.data = {"sites": {"default": {}, "88f7af54-98f8": {}}}

        assert _first_site_id(coordinator) == "88f7af54-98f8"

    def test_first_site_id_handles_unloaded_coordinator(self):
        coordinator = MagicMock()
        coordinator.data = None

        assert _first_site_id(coordinator) is None


async def test_migration_version_guard_and_unique_id_collision(hass: HomeAssistant) -> None:
    """Migration aborts on higher major version and avoids duplicate unique_id collision."""
    # Higher major version returns False
    entry_future = MockConfigEntry(
        domain=DOMAIN,
        version=2,
        minor_version=0,
        data={},
    )
    entry_future.add_to_hass(hass)
    assert await async_migrate_entry(hass, entry_future) is False

    # Unique id collision during migration keeps original unique_id
    existing_entry = MockConfigEntry(
        domain=DOMAIN,
        unique_id="target_console_123",
        version=1,
        minor_version=2,
        data={CONF_CONSOLE_ID: "target_console_123"},
    )
    existing_entry.add_to_hass(hass)

    v1_entry = MockConfigEntry(
        domain=DOMAIN,
        unique_id="old_unique_id",
        version=1,
        minor_version=1,
        data={
            CONF_CONNECTION_TYPE: CONNECTION_TYPE_REMOTE,
            CONF_CONSOLE_ID: "target_console_123",
        },
    )
    v1_entry.add_to_hass(hass)
    assert await async_migrate_entry(hass, v1_entry) is True
    # Should not overwrite existing entry's unique_id
    assert v1_entry.unique_id == "old_unique_id"


async def test_async_setup_entry_discovers_console_identity_from_nvr(
    hass: HomeAssistant,
    enable_custom_integrations,
) -> None:
    """async_setup_entry updates local entry with console MAC, name and title from NVR."""
    from custom_components.unifi_insights import async_setup_entry
    from custom_components.unifi_insights.probe import ProbeResult, ProbeStatus

    entry = MockConfigEntry(
        domain=DOMAIN,
        title="UniFi Insights (Local)",
        unique_id="local_api_key_123",
        data={
            CONF_CONNECTION_TYPE: CONNECTION_TYPE_LOCAL,
            CONF_HOST: "192.168.1.1",
            CONF_API_KEY: "local_api_key_123",
            CONF_VERIFY_SSL: False,
        },
    )
    entry.add_to_hass(hass)

    async def fake_protect_refresh(coord_self):
        coord_self.data = {
            "nvrs": {
                "nvr_1": {
                    "mac": "aa:bb:cc:dd:ee:11",
                    "name": "Home UDM",
                }
            }
        }

    with (
        patch("custom_components.unifi_insights.async_probe_network", new_callable=AsyncMock) as mock_probe_net,
        patch("custom_components.unifi_insights.async_probe_protect", new_callable=AsyncMock) as mock_probe_prot,
        patch("custom_components.unifi_insights.UnifiConfigCoordinator.async_config_entry_first_refresh", new_callable=AsyncMock),
        patch("custom_components.unifi_insights.UnifiDeviceCoordinator.async_config_entry_first_refresh", new_callable=AsyncMock),
        patch("custom_components.unifi_insights.UnifiProtectCoordinator.async_config_entry_first_refresh", autospec=True, side_effect=fake_protect_refresh),
        patch("custom_components.unifi_insights.UnifiProtectCoordinator.async_start_websocket", new_callable=AsyncMock),
        patch("homeassistant.config_entries.ConfigEntries.async_forward_entry_setups", new_callable=AsyncMock),
    ):
        mock_probe_net.return_value = ProbeResult(ProbeStatus.AVAILABLE, [MagicMock(id="default")])
        mock_probe_prot.return_value = ProbeResult(ProbeStatus.AVAILABLE)

        entry.mock_state(hass, config_entries.ConfigEntryState.LOADED)
        res = await async_setup_entry(hass, entry)
        assert res is True
        assert entry.data.get(CONF_CONSOLE_ID) == "aa:bb:cc:dd:ee:11"
        assert entry.data.get(CONF_CONSOLE_NAME) == "Home UDM"
        assert entry.unique_id == "aa:bb:cc:dd:ee:11"
        assert entry.title == "UniFi - Home UDM"
        await hass.config_entries.async_unload(entry.entry_id)


async def test_async_setup_entry_discovers_console_identity_from_device_gateway(
    hass: HomeAssistant,
    enable_custom_integrations,
) -> None:
    """async_setup_entry updates local entry with console MAC and name from Gateway device."""
    from custom_components.unifi_insights import async_setup_entry
    from custom_components.unifi_insights.probe import ProbeResult, ProbeStatus

    entry = MockConfigEntry(
        domain=DOMAIN,
        title="UniFi Insights (Local)",
        unique_id="local_api_key_456",
        data={
            CONF_CONNECTION_TYPE: CONNECTION_TYPE_LOCAL,
            CONF_HOST: "192.168.1.1",
            CONF_API_KEY: "local_api_key_456",
            CONF_VERIFY_SSL: False,
        },
    )
    entry.add_to_hass(hass)

    async def fake_device_refresh(coord_self):
        coord_self.data = {
            "devices": {
                "site_alpha": {
                    "gw_1": {
                        "is_gateway": True,
                        "macAddress": "22-33-44-55-66-77",
                        "name": "Dream Router",
                    }
                }
            }
        }

    with (
        patch("custom_components.unifi_insights.async_probe_network", new_callable=AsyncMock) as mock_probe_net,
        patch("custom_components.unifi_insights.async_probe_protect", new_callable=AsyncMock) as mock_probe_prot,
        patch("custom_components.unifi_insights.UnifiConfigCoordinator.async_config_entry_first_refresh", new_callable=AsyncMock),
        patch("custom_components.unifi_insights.UnifiDeviceCoordinator.async_config_entry_first_refresh", autospec=True, side_effect=fake_device_refresh),
        patch("homeassistant.config_entries.ConfigEntries.async_forward_entry_setups", new_callable=AsyncMock),
    ):
        mock_probe_net.return_value = ProbeResult(ProbeStatus.AVAILABLE, [MagicMock(id="site_alpha")])
        mock_probe_prot.return_value = ProbeResult(ProbeStatus.UNSUPPORTED)

        entry.mock_state(hass, config_entries.ConfigEntryState.LOADED)
        res = await async_setup_entry(hass, entry)
        assert res is True
        assert entry.data.get(CONF_CONSOLE_ID) == "22:33:44:55:66:77"
        assert entry.data.get(CONF_CONSOLE_NAME) == "Dream Router"
        assert entry.unique_id == "22:33:44:55:66:77"
        assert entry.title == "UniFi - Dream Router"
        await hass.config_entries.async_unload(entry.entry_id)
