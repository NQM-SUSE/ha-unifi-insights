import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "../src/index";
import { allSites } from "../src/config";
import { NODE_KINDS } from "../src/contract";
import { makeLocalize } from "../src/localize";
import {
    STALE_SITE,
    buildSchema,
    ensureHaForm,
    fromFormData,
    toFormData,
    type EditorFormData,
    type FormField,
} from "../src/topology-card-editor";
import { SOURCES_MULTI, cleanup, fakeHass, settle } from "./helpers";

const TYPE = "custom:unifi-insights-topology-card";
const sites = allSites(SOURCES_MULTI);
const localize = makeLocalize("en");

class FakeHaForm extends HTMLElement {
    hass?: unknown;
    data?: EditorFormData;
    schema?: FormField[];
    computeLabel?: (field: FormField) => string;
}

beforeAll(() => {
    if (!customElements.get("ha-form"))
        customElements.define("ha-form", FakeHaForm);
});
afterEach(cleanup);

describe("form mapping", () => {
    it("maps a config to form data with defaults", () => {
        expect(
            toFormData(
                { type: TYPE, entry_id: "entry-1", site_id: "site-2" },
                sites,
            ),
        ).toEqual({
            site: "1",
            title: "",
            view: "graph",
            clients: "collapsed",
            density: "auto",
            orientation: "vertical",
            kinds: [...NODE_KINDS],
            show_site_selector: false,
            show_labels: true,
            max_clients: 500,
        });
        expect(toFormData({ type: TYPE }, sites).site).toBe("");
    });

    it("writes a chosen site and keeps keys the form does not own", () => {
        const previous = { type: TYPE, grid_options: { columns: 12 } };
        const next = fromFormData(
            {
                ...toFormData(previous, sites),
                site: "2",
                title: "Office",
                view: "list",
            },
            previous,
            sites,
        );
        expect(next).toMatchObject({
            type: TYPE,
            entry_id: "entry-2",
            site_id: "default",
            title: "Office",
            view: "list",
            grid_options: { columns: 12 },
        });
    });

    it("drops defaults that have their own meaning when absent", () => {
        const previous = {
            type: TYPE,
            title: "Old",
            density: "compact" as const,
            kinds: ["gateway" as const],
        };
        const next = fromFormData(
            {
                ...toFormData(previous, sites),
                title: "",
                density: "auto",
                kinds: [...NODE_KINDS],
            },
            previous,
            sites,
        );
        expect(next).not.toHaveProperty("title");
        expect(next).not.toHaveProperty("density");
        expect(next).not.toHaveProperty("kinds");
    });

    it("never saves an empty kind list or an out-of-range client cap", () => {
        const previous = {
            type: TYPE,
            kinds: ["gateway" as const],
            max_clients: 100,
        };
        const next = fromFormData(
            { ...toFormData(previous, sites), kinds: [], max_clients: 9000 },
            previous,
            sites,
        );
        expect(next.kinds).toEqual(["gateway"]);
        expect(next.max_clients).toBe(100);
    });

    it("keeps a stale site binding selectable", () => {
        const previous = {
            type: TYPE,
            entry_id: "entry-9",
            site_id: "gone",
            show_labels: true,
        };
        expect(toFormData(previous, sites).site).toBe(STALE_SITE);
        const siteField = buildSchema(previous, sites, localize)[0]!;
        expect(siteField.selector).toMatchObject({
            select: {
                options: expect.arrayContaining([
                    { value: STALE_SITE, label: "gone (unavailable)" },
                ]),
            },
        });
        const next = fromFormData(
            { ...toFormData(previous, sites), show_labels: false },
            previous,
            sites,
        );
        expect(next).toMatchObject({
            entry_id: "entry-9",
            site_id: "gone",
            show_labels: false,
        });
    });

    it("labels every select option", () => {
        const schema = buildSchema({ type: TYPE }, sites, localize);
        const kinds = schema.find((f) => f.name === "kinds")!;
        expect(kinds.selector).toMatchObject({
            select: {
                multiple: true,
                options: expect.arrayContaining([
                    { value: "access_point", label: "Access point" },
                ]),
            },
        });
        expect(
            schema.find((f) => f.type === "grid")!.schema!.map((f) => f.name),
        ).toEqual(["view", "clients", "density", "orientation"]);
    });
});

describe("<unifi-insights-topology-card-editor>", () => {
    async function editor(config: Record<string, unknown>) {
        const el = document.createElement(
            "unifi-insights-topology-card-editor",
        ) as HTMLElement & {
            hass?: unknown;
            setConfig(c: unknown): void;
            updateComplete: Promise<boolean>;
        };
        el.hass = fakeHass({ sources: SOURCES_MULTI }).hass;
        el.setConfig({ type: TYPE, ...config });
        document.body.append(el);
        await settle(el);
        return el;
    }

    it("is what the card returns as its config element", () => {
        const Card = customElements.get(
            "unifi-insights-topology-card",
        ) as unknown as { getConfigElement(): HTMLElement };
        expect(Card.getConfigElement().tagName.toLowerCase()).toBe(
            "unifi-insights-topology-card-editor",
        );
    });

    it("renders ha-form with site options from the integration", async () => {
        const el = await editor({ entry_id: "entry-1", site_id: "site-1" });
        const form = el.shadowRoot!.querySelector("ha-form") as FakeHaForm;
        expect(form.data?.site).toBe("0");
        expect(form.schema![0]!.selector).toMatchObject({
            select: {
                options: [
                    { value: "0", label: "Crestwood — Home" },
                    { value: "1", label: "Crestwood — Cabin" },
                    { value: "2", label: "Office — Default" },
                ],
            },
        });
        expect(form.computeLabel!({ name: "max_clients" })).toBe(
            "Maximum clients",
        );
    });

    it("fires config-changed with the merged config", async () => {
        const el = await editor({ entry_id: "entry-1", site_id: "site-1" });
        const changed = vi.fn();
        el.addEventListener("config-changed", (e) =>
            changed((e as CustomEvent).detail.config),
        );
        const form = el.shadowRoot!.querySelector("ha-form") as FakeHaForm;
        form.dispatchEvent(
            new CustomEvent("value-changed", {
                detail: { value: { ...form.data, site: "2" } },
            }),
        );
        expect(changed).toHaveBeenCalledWith(
            expect.objectContaining({
                type: TYPE,
                entry_id: "entry-2",
                site_id: "default",
            }),
        );
    });
});

describe("ensureHaForm", () => {
    it("forces HA to load ha-form through a built-in card editor", async () => {
        const getConfigElement = vi.fn(async () => undefined);
        class EntitiesCard extends HTMLElement {
            static getConfigElement = getConfigElement;
        }
        const createCardElement = vi.fn(() => new EntitiesCard());
        if (!customElements.get("fake-entities-card"))
            customElements.define("fake-entities-card", EntitiesCard);
        await ensureHaForm(
            { get: () => undefined } as unknown as CustomElementRegistry,
            async () => ({ createCardElement }),
        );
        expect(createCardElement).toHaveBeenCalledWith({
            type: "entities",
            entities: [],
        });
        expect(getConfigElement).toHaveBeenCalledOnce();
    });

    it("does nothing when ha-form already exists", async () => {
        const load = vi.fn();
        await ensureHaForm(customElements, load);
        expect(load).not.toHaveBeenCalled();
    });
});
