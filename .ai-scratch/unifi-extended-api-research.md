# UniFi extended API enhancement research

## Scope reviewed

Official UniFi Developer documentation reviewed for the services beyond the current Network and Protect coverage:

- Mobility API v1.0.0
- InnerSpace API v1.3.23
- Site Manager API v1.0.0
- Carrier Fabric API v1.0.0

## High-level capabilities

### Mobility

- Workspace, device, and client inventory for wireless/mobile infrastructure.
- Device-level LAN/DHCP and WiFi configuration updates.
- Best fit: workspace/device monitoring and control surfaces for managed mobility deployments.

### InnerSpace

- Floor-plan project, access-point, switch, and inventory data.
- Site mapping and asset metadata for physical layouts and device placement.
- Best fit: floor-plan entities, inventory/sensor state, and layout-aware monitoring.

### Site Manager

- Cross-host and cross-site visibility across managed environments.
- ISP metrics, SD-WAN config metadata, and host/site inventory.
- Best fit: site/host-level diagnostics and cloud-to-on-prem bridge integration.

### Carrier Fabric

- Subscriber lifecycle, service-plan assignment, and service suspend/resume workflows.
- Strong candidate for service state and subscriber monitoring in Home Assistant.
- Best fit: service-state sensors, subscriber entities, and limited actions.

## Research sources used

- Official root index: <https://developer.ui.com/llms.txt>
- Service-specific llms.txt files for each API
- Exa search and fetch, and Context7, as available in this environment
- GitHub issue label confirmation for enhancement tracking

## Why these matter for UniFi Insights

The current integration is strongly aligned with Network and Protect. The additional APIs are adjacent but complementary and fit the Home Assistant model through separate discovery, coordinators, entities, and service actions rather than forcing everything into the existing network/protect device model.

## Recommended issue grouping

1. Mobility workspace/device/client monitoring
2. InnerSpace floor-plan and inventory integration
3. Site Manager host/site/ISP/SD-WAN metadata
4. Carrier Fabric subscriber/service-plan state

These are intentionally scoped as enhancement issues with clear onboarding, API surface, and acceptance criteria so CodeRabbit/PR planning can turn each into a concrete implementation plan.
