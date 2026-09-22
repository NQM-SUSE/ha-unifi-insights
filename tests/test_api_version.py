"""Tests for the vendored UniFi API version."""

from custom_components.unifi_insights.api import __version__
from custom_components.unifi_insights.api.const import USER_AGENT


def test_vendored_api_version_drives_user_agent() -> None:
    """Test the public vendored version remains the user-agent source."""
    assert __version__ == "1.2.0+vendored"
    assert f"unifi-official-api/{__version__}" == USER_AGENT
