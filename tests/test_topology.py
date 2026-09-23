"""Tests for the topology graph builder."""

from __future__ import annotations

import pytest

from custom_components.unifi_insights.topology import (
    device_kind,
    device_state,
    normalize_mac,
    opaque_node_id,
    site_display_name,
)

ENTRY = "entry-1"
SITE = "site-1"


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("28:70:4E:C1:A6:13", "28:70:4e:c1:a6:13"),
        ("28-70-4e-c1-a6-13", "28:70:4e:c1:a6:13"),
        ("28704ec1a613", "28:70:4e:c1:a6:13"),
        (" 28:70:4e:c1:a6:13 ", "28:70:4e:c1:a6:13"),
        ("dc4eaf35-9daf-352c-9e34-2e428120ff1a", None),
        ("69d19121c4862038869ff37f", None),
        ("device1", None),
        ("", None),
        (None, None),
        (42, None),
    ],
)
def test_normalize_mac(value, expected) -> None:
    """Only MAC-shaped strings normalise; UUIDs and legacy ids do not."""
    assert normalize_mac(value) == expected


def test_opaque_node_id_keeps_uuid_and_hashes_mac() -> None:
    """UUIDs pass through; MAC-shaped ids never appear in the node id."""
    assert opaque_node_id("dev", ENTRY, "uuid-1") == "dev:uuid-1"
    assert opaque_node_id("cli", ENTRY, "uuid-9") == "cli:uuid-9"
    hashed = opaque_node_id("dev", ENTRY, "AA:BB:CC:DD:EE:FF")
    assert hashed.startswith("dev:h")
    assert len(hashed) == len("dev:h") + 16
    assert "aa:bb" not in hashed.lower()
    # Stable across spellings of the same MAC, scoped per entry.
    assert hashed == opaque_node_id("dev", ENTRY, "aabbccddeeff")
    assert hashed != opaque_node_id("dev", "entry-2", "aabbccddeeff")


@pytest.mark.parametrize(
    ("device", "expected"),
    [
        ({"topology": {"legacy_type": "udm"}, "features": ["switching"]}, "gateway"),
        ({"topology": {"legacy_type": "uxg"}}, "gateway"),
        ({"topology": {"legacy_type": "ugw"}}, "gateway"),
        ({"topology": {"legacy_type": "udr"}}, "gateway"),
        ({"topology": {"legacy_type": "ucg"}}, "gateway"),
        ({"topology": {"legacy_type": "usw"}}, "switch"),
        ({"topology": {"legacy_type": "uap"}}, "access_point"),
        ({"type": "GATEWAY"}, "gateway"),
        ({"type": "switch"}, "switch"),
        ({"type": "accessPoint"}, "access_point"),
        ({"features": ["accessPoint"]}, "access_point"),
        ({"features": ["switching"]}, "switch"),
        ({"topology": {"legacy_type": "uph"}}, "other"),
        ({}, "other"),
    ],
)
def test_device_kind(device, expected) -> None:
    """Legacy type wins, then v1 type, then features, then other."""
    assert device_kind(device) == expected


@pytest.mark.parametrize(
    ("device", "expected"),
    [
        ({"state": "ONLINE"}, "online"),
        ({"state": "connected"}, "online"),
        ({"status": "UP"}, "online"),
        ({"state": "OFFLINE"}, "offline"),
        ({"state": "DISCONNECTED"}, "offline"),
        ({"state": "PENDING_ADOPTION"}, "unknown"),
        ({"state": 1}, "unknown"),
        ({}, "unknown"),
    ],
)
def test_device_state(device, expected) -> None:
    """Device state strings map onto the three contract states."""
    assert device_state(device) == expected


def test_site_display_name() -> None:
    """Site name falls back to description, then to the id."""
    data = {
        "sites": {
            "a": {"name": "Home"},
            "b": {"name": "", "desc": "Office"},
            "c": {},
        }
    }
    assert site_display_name(data, "a") == "Home"
    assert site_display_name(data, "b") == "Office"
    assert site_display_name(data, "c") == "c"
    assert site_display_name(data, "missing") == "missing"
