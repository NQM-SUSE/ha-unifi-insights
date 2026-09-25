import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";
import "../src/index";
import type { UnifiInsightsTopologyCard } from "../src/topology-card";
import { cleanup, fakeHass, fixtureSnapshot, settle } from "./helpers";

afterEach(cleanup);

async function audit(root: Element): Promise<string[]> {
    const result = await axe.run(root, {
        runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
        },
        // jsdom cannot compute colours; contrast comes from HA theme variables (see styles.ts).
        rules: { "color-contrast": { enabled: false } },
    });
    return result.violations.map(
        (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
    );
}

async function loadedCard(
    config: Record<string, unknown> = {},
    snapshot = fixtureSnapshot(),
) {
    const fake = fakeHass();
    const el = document.createElement(
        "unifi-insights-topology-card",
    ) as UnifiInsightsTopologyCard;
    el.setConfig({ type: "custom:unifi-insights-topology-card", ...config });
    el.hass = fake.hass;
    document.body.append(el);
    await settle(el);
    fake.push(snapshot);
    await settle(el);
    return el;
}

describe("WCAG 2.2 AA (axe-core)", () => {
    it("graph view", async () => {
        expect(await audit(await loadedCard())).toEqual([]);
    });

    it("list view", async () => {
        expect(await audit(await loadedCard({ view: "list" }))).toEqual([]);
    });

    it("partial snapshot banner with the detail panel open", async () => {
        const el = await loadedCard(
            {},
            fixtureSnapshot({
                status: "partial",
                issues: [{ code: "devices_unavailable", severity: "warning" }],
            }),
        );
        el.selectedId = "dev:uuid-core";
        await settle(el);
        expect(await audit(el)).toEqual([]);
    });

    it("error state", async () => {
        const fake = fakeHass({
            subscribeError: { code: "entry_not_found", message: "" },
        });
        const el = document.createElement(
            "unifi-insights-topology-card",
        ) as UnifiInsightsTopologyCard;
        el.setConfig({
            type: "custom:unifi-insights-topology-card",
            entry_id: "x",
            site_id: "y",
        });
        el.hass = fake.hass;
        document.body.append(el);
        await settle(el);
        expect(await audit(el)).toEqual([]);
    });

    it("narrow layout with the collapsed toolbar", async () => {
        const el = await loadedCard();
        el.narrow = true;
        await settle(el);
        expect(await audit(el)).toEqual([]);
    });
});
