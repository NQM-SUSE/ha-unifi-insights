import type { TopologyCardConfig } from "../src/config";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/index";
import { WS_SUBSCRIBE } from "../src/contract";
import { BACKOFF_BASE_MS } from "../src/data/subscription";
import type { UnifiInsightsTopologyCard } from "../src/topology-card";
import type { UitGraphView } from "../src/views/graph-view";
import {
    SOURCES_MULTI,
    SOURCES_ONE,
    cleanup,
    fakeHass,
    fixtureSnapshot,
    settle,
    unavailableSnapshot,
} from "./helpers";

const TYPE = "custom:unifi-insights-topology-card";
afterEach(cleanup);

async function card(config: Record<string, unknown> = {}, fake = fakeHass()) {
    const el = document.createElement(
        "unifi-insights-topology-card",
    ) as UnifiInsightsTopologyCard;
    el.setConfig({ type: TYPE, ...config });
    el.hass = fake.hass;
    document.body.append(el);
    await settle(el);
    return { el, fake };
}
const text = (el: Element) => el.shadowRoot!.textContent ?? "";
const q = <T extends Element>(el: Element, selector: string) =>
    el.shadowRoot!.querySelector<T>(selector);
const button = (el: Element, label: string) =>
    [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>("button")].find(
        (b) => b.textContent?.trim() === label,
    )!;
const graphOf = (el: Element) => q<UitGraphView>(el, "uit-graph-view")!;
const dispatch = (el: Element, type: string, id: string) =>
    q(el, ".card")!.dispatchEvent(
        new CustomEvent(type, {
            detail: { id },
            bubbles: true,
            composed: true,
        }),
    );

describe("registration", () => {
    it("appears once in the card picker with a preview", () => {
        const entries = (window.customCards ?? []).filter(
            (c) => c.type === "unifi-insights-topology-card",
        );
        expect(entries).toEqual([
            expect.objectContaining({
                name: "UniFi Insights Topology",
                preview: true,
            }),
        ]);
    });

    it("rejects an invalid config with a readable error", () => {
        const el = document.createElement(
            "unifi-insights-topology-card",
        ) as UnifiInsightsTopologyCard;
        expect(() =>
            el.setConfig({
                type: TYPE,
                view: "map",
            } as unknown as TopologyCardConfig),
        ).toThrow(/view must be one of/);
    });

    it("sizes itself for masonry and sections", () => {
        const el = document.createElement(
            "unifi-insights-topology-card",
        ) as UnifiInsightsTopologyCard;
        expect(el.getCardSize()).toBe(8);
        expect(el.getGridOptions()).toEqual({
            columns: 12,
            rows: 8,
            min_columns: 6,
            min_rows: 4,
        });
    });

    it("builds a stub config from the first source", async () => {
        const Card = customElements.get(
            "unifi-insights-topology-card",
        ) as unknown as typeof UnifiInsightsTopologyCard;
        expect(
            await Card.getStubConfig(fakeHass({ sources: SOURCES_MULTI }).hass),
        ).toEqual({ type: TYPE, entry_id: "entry-1", site_id: "site-1" });
        expect(
            await Card.getStubConfig(
                fakeHass({
                    sourcesError: { code: "unknown_command", message: "" },
                }).hass,
            ),
        ).toEqual({ type: TYPE });
    });
});

describe("states", () => {
    it("auto-binds the only site, subscribes and shows loading", async () => {
        const { el, fake } = await card();
        expect(fake.subs).toHaveLength(1);
        expect(fake.subs[0]!.message).toEqual({
            type: WS_SUBSCRIBE,
            entry_id: "entry-1",
            site_id: "site-1",
            max_clients: 500,
        });
        expect(text(el)).toContain("Loading network topology…");
    });

    it("renders the graph and the site name once a snapshot arrives", async () => {
        const { el, fake } = await card();
        fake.push(fixtureSnapshot());
        await settle(el);
        expect(graphOf(el).model?.visuals.has("dev:uuid-core")).toBe(true);
        expect(q(el, "h2")!.textContent).toBe("Home");
        expect(q(el, '[role="status"]')!.textContent?.trim()).toBe(
            "Topology updated.",
        );
    });

    it("points to the integration when none is loaded", async () => {
        const { el } = await card({}, fakeHass({ sources: [] }));
        expect(text(el)).toContain("No UniFi Insights integration is loaded.");
        button(el, "Integration").click();
        expect(location.pathname).toBe(
            "/config/integrations/integration/unifi_insights",
        );
    });

    it("asks for a site when several exist and none is configured", async () => {
        const { el, fake } = await card(
            {},
            fakeHass({ sources: SOURCES_MULTI }),
        );
        expect(fake.subs).toHaveLength(0);
        expect(text(el)).toContain("Choose a site to show.");
        button(el, "Edit card").click();
        expect(location.search).toBe("?edit=1");
    });

    it("shows site_not_selected with an edit action", async () => {
        const fake = fakeHass({
            subscribeError: { code: "site_not_selected", message: "Site gone" },
        });
        const { el } = await card(
            { entry_id: "entry-1", site_id: "gone" },
            fake,
        );
        expect(text(el)).toContain(
            "The configured site no longer exists or is disabled.",
        );
        expect(button(el, "Edit card")).toBeDefined();
    });

    it("lists each issue of a partial snapshot in a banner", async () => {
        const { el, fake } = await card();
        fake.push(
            fixtureSnapshot({
                revision: "b".repeat(16),
                status: "partial",
                issues: [{ code: "parents_unresolved", severity: "warning" }],
                unresolved: [{ node_id: "dev:x", reason: "parent_not_found" }],
            }),
        );
        await settle(el);
        expect(q(el, ".notices li.warning")!.textContent).toContain(
            "1 nodes couldn't be placed under a parent.",
        );
        expect(graphOf(el)).not.toBeNull();
    });

    it("keeps the last graph, greyed and marked stale, while the site is unavailable", async () => {
        const { el, fake } = await card();
        fake.push(fixtureSnapshot());
        fake.push(unavailableSnapshot("site_unavailable"));
        await settle(el);
        expect(q(el, ".content.stale")).not.toBeNull();
        expect(q(el, ".badge.stale")!.textContent).toBe("Stale");
        expect(graphOf(el).model?.visuals.size).toBeGreaterThan(0);
    });

    it("shows reconnecting after the entry unloads", async () => {
        const { el, fake } = await card();
        fake.push(fixtureSnapshot());
        fake.push(unavailableSnapshot("entry_unloaded"));
        await settle(el);
        expect(q(el, ".badge.stale")!.textContent).toBe(
            "Stale · Reconnecting…",
        );
    });

    it("reports a schema mismatch", async () => {
        const { el, fake } = await card();
        fake.push({ ...fixtureSnapshot(), schema_version: 2 });
        await settle(el);
        expect(text(el)).toContain(
            "Card and integration versions don't match.",
        );
    });
});

describe("interaction", () => {
    async function loaded(config: Record<string, unknown> = {}) {
        const result = await card(config);
        result.fake.push(fixtureSnapshot());
        await settle(result.el);
        return result;
    }

    it("toggles between graph and list views", async () => {
        const { el } = await loaded();
        button(el, "List").click();
        await settle(el);
        expect(q(el, "uit-list-view")).not.toBeNull();
        expect(button(el, "List").getAttribute("aria-pressed")).toBe("true");
        expect(button(el, "Graph").getAttribute("aria-pressed")).toBe("false");
    });

    it("filters kinds with chips but never hides every kind", async () => {
        const { el } = await loaded();
        button(el, "Switch").click();
        await settle(el);
        expect(graphOf(el).model?.visuals.has("dev:uuid-core")).toBe(false);
        const single = await loaded({ kinds: ["gateway"] });
        button(single.el, "Gateway").click();
        await settle(single.el);
        expect(button(single.el, "Gateway").getAttribute("aria-pressed")).toBe(
            "true",
        );
    });

    it("opens details on activate and closes them with Escape", async () => {
        const { el } = await loaded();
        dispatch(el, "uit-activate", "dev:uuid-core");
        await settle(el);
        expect(el.selectedId).toBe("dev:uuid-core");
        expect(
            q<HTMLElement & { selectedId?: string }>(el, "uit-detail-panel")!
                .selectedId,
        ).toBe("dev:uuid-core");
        q(el, ".card")!.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
        await settle(el);
        expect(el.selectedId).toBeUndefined();
    });

    it("expands a group when it is activated or when one of its clients is selected", async () => {
        const { el } = await loaded();
        dispatch(el, "uit-activate", "group:dev:uuid-ap");
        await settle(el);
        expect(graphOf(el).model?.visuals.has("cli:cli-phone")).toBe(true);
        dispatch(el, "uit-select", "cli:cli-tv");
        await settle(el);
        expect(graphOf(el).model?.visuals.has("cli:cli-tv")).toBe(true);
        expect(el.selectedId).toBe("cli:cli-tv");
    });

    it("switches sites with the selector without flashing the old graph", async () => {
        const fake = fakeHass({ sources: SOURCES_MULTI });
        const { el } = await card(
            {
                entry_id: "entry-1",
                site_id: "site-1",
                show_site_selector: true,
            },
            fake,
        );
        fake.push(fixtureSnapshot());
        await settle(el);
        const select = q<HTMLSelectElement>(el, "select")!;
        expect(select.options).toHaveLength(3);
        select.value = "1";
        select.dispatchEvent(new Event("change"));
        await settle(el);
        expect(fake.subs[0]!.unsubscribe).toHaveBeenCalledOnce();
        expect(fake.subs[1]!.message).toMatchObject({
            entry_id: "entry-1",
            site_id: "site-2",
        });
        expect(q(el, "uit-graph-view")).toBeNull();
        expect(text(el)).toContain("Loading network topology…");
    });

    it("collapses the toolbar and compacts the graph when narrow", async () => {
        const { el } = await loaded();
        el.narrow = true;
        await settle(el);
        expect(q(el, "details.toolbar")).not.toBeNull();
        expect(graphOf(el).density).toBe("compact");
        expect(
            q<HTMLElement & { narrow: boolean }>(el, "uit-detail-panel")!
                .narrow,
        ).toBe(true);
    });

    it("lets the wheel zoom directly only in panel view", async () => {
        const { el } = await loaded();
        expect(graphOf(el).ctrlZoom).toBe(true);
        el.layout = "panel";
        await settle(el);
        expect(graphOf(el).ctrlZoom).toBe(false);
    });
});

describe("reconnects", () => {
    it.each([
        {
            label: "multiple sites",
            sources: SOURCES_MULTI,
            expected: "Choose a site to show.",
            subscriptions: 0,
        },
        {
            label: "one site",
            sources: SOURCES_ONE,
            expected: "Loading network topology…",
            subscriptions: 1,
        },
    ])(
        "retries a failed sources load and recovers for $label",
        async ({ sources, expected, subscriptions }) => {
            vi.useFakeTimers();
            try {
                const fake = fakeHass({ sources });
                vi.mocked(fake.hass.callWS).mockRejectedValueOnce({
                    code: "unknown_command",
                    message: "Not ready",
                });
                const el = document.createElement(
                    "unifi-insights-topology-card",
                ) as UnifiInsightsTopologyCard;
                el.setConfig({ type: TYPE });
                el.hass = fake.hass;
                document.body.append(el);
                await vi.advanceTimersByTimeAsync(0);
                await el.updateComplete;
                expect(el.error?.code).toBe("unknown_command");

                await vi.advanceTimersByTimeAsync(BACKOFF_BASE_MS * 1.2 + 1);
                await el.updateComplete;
                expect(fake.hass.callWS).toHaveBeenCalledTimes(2);
                expect(el.error).toBeUndefined();
                expect(fake.subs).toHaveLength(subscriptions);
                expect(text(el)).toContain(expected);
            } finally {
                vi.useRealTimers();
            }
        },
    );

    it("keeps a subscription error when sources refresh succeeds", async () => {
        const fake = fakeHass({
            subscribeError: { code: "site_not_selected", message: "Site gone" },
        });
        const { el } = await card(
            { entry_id: "entry-1", site_id: "site-1" },
            fake,
        );
        expect(el.error?.code).toBe("site_not_selected");

        fake.emit("ready");
        await settle(el);
        expect(fake.hass.callWS).toHaveBeenCalledTimes(2);
        expect(el.error?.code).toBe("site_not_selected");
    });

    it("loads sources for a new connection after an old request settles", async () => {
        const old = fakeHass();
        let finishOld!: (sources: typeof SOURCES_ONE) => void;
        const oldRequest = new Promise<typeof SOURCES_ONE>((resolve) => {
            finishOld = resolve;
        });
        vi.mocked(old.hass.callWS).mockReturnValueOnce(oldRequest);
        const { el } = await card({}, old);

        const current = fakeHass({ sources: SOURCES_MULTI });
        el.hass = current.hass;
        await settle(el);
        expect(current.hass.callWS).not.toHaveBeenCalled();

        finishOld(SOURCES_ONE);
        await settle(el);
        expect(current.hass.callWS).toHaveBeenCalledOnce();
        expect(el.sources).toEqual(SOURCES_MULTI);
        expect(text(el)).toContain("Choose a site to show.");
    });

    it("greys the graph while the socket is down and reopens the stream on ready", async () => {
        const { el, fake } = await card();
        fake.push(fixtureSnapshot());
        await settle(el);
        fake.emit("disconnected");
        await settle(el);
        expect(q(el, ".badge.stale")!.textContent).toBe(
            "Stale · Reconnecting…",
        );
        expect(graphOf(el).model?.visuals.size).toBeGreaterThan(0);

        fake.emit("ready");
        await settle(el);
        expect(fake.subs).toHaveLength(2);
        expect(fake.hass.callWS).toHaveBeenCalledTimes(2);
        fake.push(fixtureSnapshot());
        await settle(el);
        expect(q(el, ".content.stale")).toBeNull();
    });

    it("keeps asking for sources while none are loaded yet", async () => {
        vi.useFakeTimers();
        try {
            const fake = fakeHass({ sources: [] });
            const el = document.createElement(
                "unifi-insights-topology-card",
            ) as UnifiInsightsTopologyCard;
            el.setConfig({ type: TYPE });
            el.hass = fake.hass;
            document.body.append(el);
            await vi.advanceTimersByTimeAsync(0);
            await el.updateComplete;
            expect(text(el)).toContain(
                "No UniFi Insights integration is loaded.",
            );

            vi.mocked(fake.hass.callWS).mockResolvedValue(SOURCES_ONE);
            await vi.advanceTimersByTimeAsync(BACKOFF_BASE_MS * 1.2 + 1);
            await el.updateComplete;
            expect(fake.subs).toHaveLength(1);
            expect(text(el)).toContain("Loading network topology…");
        } finally {
            vi.useRealTimers();
        }
    });
});

describe("lifecycle", () => {
    it("does not resubscribe on ordinary hass updates", async () => {
        const { el, fake } = await card();
        el.hass = { ...fake.hass } as typeof fake.hass;
        await settle(el);
        expect(fake.subs).toHaveLength(1);
    });

    it("resubscribes after being re-attached", async () => {
        const { el, fake } = await card();
        el.remove();
        expect(fake.subs[0]!.unsubscribe).toHaveBeenCalledOnce();
        document.body.append(el);
        await settle(el);
        expect(fake.subs).toHaveLength(2);
        expect(fake.subs[1]!.unsubscribe).not.toHaveBeenCalled();
    });
});
