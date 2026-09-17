---
applyTo: "custom_components/unifi_insights/diagnostics.py"
---

# Diagnostics Instructions

**Applies to:** Diagnostic data export

## CRITICAL: Data Redaction

**ALWAYS** use `async_redact_data()` from `homeassistant.helpers.redact` to remove sensitive data before returning diagnostics.

**Must redact:**

- API keys and tokens
- Passwords and secrets
- MAC addresses (if privacy-sensitive)
- Location data
- Personal information

```python
from homeassistant.helpers.redact import async_redact_data

TO_REDACT = {"api_key", "password", "token", "secret"}


async def async_get_config_entry_diagnostics(
    hass: HomeAssistant,
    entry: UnifiInsightsConfigEntry,
) -> dict[str, Any]:
    """Return diagnostics for a config entry."""
    return async_redact_data(
        {"entry": entry.as_dict(), "data": coordinator.data},
        TO_REDACT,
    )
```

## Three redaction layers

`diagnostics.py` redacts in three passes; a new collection has to be fitted into
the right one:

1. `TO_REDACT` - keys that are sensitive wherever they appear (credentials,
   hosts and IPs, SSIDs, serials, location).
2. `CLIENT_TO_REDACT` / `WIFI_TO_REDACT` - the same list plus the name fields,
   applied only to client and Wi-Fi records. A client is named after its owner,
   while a device, site or camera name is what makes a report readable, so
   `name` is **not** redacted globally.
3. `_anonymize_macs()` - a final pass over the assembled payload that replaces
   every MAC-shaped value, and every value under a known MAC key, with a
   placeholder that is stable within one report. Key lists cannot keep up with
   `bssid`/`apMac`/`swMac`/future fields, and API models accept unknown extra
   fields.

When you add a collection to the coordinator data, add a test to
`tests/test_diagnostics.py` that asserts none of its identifying values reach
the payload. Build the fixture from the real API model (`model_dump(by_alias=True)`),
not a hand-written dict, or the test will pass on keys the integration never
stores.

## Structure

Return a dictionary with:

- Config entry data (redacted)
- Coordinator data (redacted)
- Any relevant state information for debugging
