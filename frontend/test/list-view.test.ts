import { afterEach, describe, expect, it, vi } from "vitest";
import { makeLocalize } from "../src/localize";
import { listRows, type UitListView } from "../src/views/list-view";
import { cleanup, fixtureModel, fixtureSnapshot, mount } from "./helpers";

const localize = makeLocalize("en");
afterEach(cleanup);

const rowsOf = (el: UitListView) => [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[role="treeitem"]'),
];
const key = (el: UitListView, k: string) =>
    el
        .shadowRoot!.querySelector('[role="tree"]')!
        .dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));

describe("listRows", () => {
    const model = fixtureModel();

    it("flattens the tree depth-first with ARIA positions", () => {
        const rows = listRows(model, new Set(), "");
        expect(rows.map((r) => `${r.level}:${r.id}`)).toEqual([
            "1:dev:uuid-gw",
            "2:dev:uuid-core",
            "3:dev:uuid-flex",
            "3:dev:uuid-lite",
            "3:dev:uuid-pdu",
            "3:dev:uuid-u1",
            "4:group:dev:uuid-u1",
            "3:dev:uuid-u2",
            "3:dev:uuid-ap",
            "4:group:dev:uuid-ap",
        ]);
        expect(rows[2]).toMatchObject({
            posinset: 1,
            setsize: 6,
            hasChildren: false,
            parentId: "dev:uuid-core",
        });
        expect(rows[6]).toMatchObject({ hasChildren: true, expanded: false });
    });

    it("hides the descendants of collapsed devices", () => {
        expect(
            listRows(model, new Set(["dev:uuid-core"]), "").map((r) => r.id),
        ).toEqual(["dev:uuid-gw", "dev:uuid-core"]);
    });

    it("filters to matches and their ancestors, searching inside collapsed groups", () => {
        expect(
            listRows(model, new Set(["dev:uuid-core"]), "tv").map((r) => r.id),
        ).toEqual([
            "dev:uuid-gw",
            "dev:uuid-core",
            "dev:uuid-u1",
            "group:dev:uuid-u1",
        ]);
    });
});

describe("<uit-list-view>", () => {
    const props = () => ({ model: fixtureModel(), localize, siteName: "Home" });

    it("renders an ARIA tree with one tab stop", async () => {
        const el = await mount<UitListView>("uit-list-view", props());
        const rows = rowsOf(el);
        expect(
            el
                .shadowRoot!.querySelector('[role="tree"]')!
                .getAttribute("aria-label"),
        ).toBe("Home devices and clients");
        expect(rows).toHaveLength(10);
        expect(rows.filter((r) => r.tabIndex === 0)).toHaveLength(1);
        expect(rows[1]!.getAttribute("aria-level")).toBe("2");
        expect(rows[1]!.getAttribute("aria-expanded")).toBe("true");
        expect(rows[2]!.hasAttribute("aria-expanded")).toBe(false);
    });

    it("moves focus with arrows, Home/End and type-ahead", async () => {
        const el = await mount<UitListView>("uit-list-view", props());
        rowsOf(el)[0]!.focus();
        key(el, "ArrowDown");
        await el.updateComplete;
        expect(el.shadowRoot!.activeElement?.getAttribute("data-id")).toBe(
            "dev:uuid-core",
        );
        key(el, "End");
        await el.updateComplete;
        expect(el.shadowRoot!.activeElement?.getAttribute("data-id")).toBe(
            "group:dev:uuid-ap",
        );
        key(el, "Home");
        key(el, "l");
        await el.updateComplete;
        expect(el.shadowRoot!.activeElement?.getAttribute("data-id")).toBe(
            "dev:uuid-lite",
        );
    });

    it("collapses and expands devices, and asks the card to toggle groups", async () => {
        const el = await mount<UitListView>("uit-list-view", props());
        const toggles = vi.fn();
        el.addEventListener("uit-toggle-group", (e) =>
            toggles((e as CustomEvent).detail),
        );
        rowsOf(el)[1]!.focus();
        key(el, "ArrowLeft");
        await el.updateComplete;
        expect(rowsOf(el)).toHaveLength(2);
        key(el, "ArrowRight");
        await el.updateComplete;
        expect(rowsOf(el)).toHaveLength(10);
        rowsOf(el)[6]!.focus();
        key(el, "ArrowRight");
        expect(toggles).toHaveBeenCalledWith({ id: "group:dev:uuid-u1" });
    });

    it("activates rows with Enter and click", async () => {
        const el = await mount<UitListView>("uit-list-view", props());
        const activate = vi.fn();
        el.addEventListener("uit-activate", (e) =>
            activate((e as CustomEvent).detail),
        );
        rowsOf(el)[0]!.focus();
        key(el, "Enter");
        rowsOf(el)[3]!.click();
        expect(activate.mock.calls).toEqual([
            [{ id: "dev:uuid-gw" }],
            [{ id: "dev:uuid-lite" }],
        ]);
    });

    it("keeps the search box focused while filtering", async () => {
        const el = await mount<UitListView>("uit-list-view", props());
        const input = el.shadowRoot!.querySelector("input")!;
        input.focus();
        input.value = "ultra";
        input.dispatchEvent(new Event("input"));
        await el.updateComplete;
        expect(el.shadowRoot!.activeElement).toBe(input);
        expect(rowsOf(el).map((r) => r.dataset.id)).toEqual([
            "dev:uuid-gw",
            "dev:uuid-core",
            "dev:uuid-u1",
            "dev:uuid-u2",
        ]);
        input.value = "zzz";
        input.dispatchEvent(new Event("input"));
        await el.updateComplete;
        expect(el.shadowRoot!.textContent).toContain("No matches");
    });

    it("renders hostile and long names as text", async () => {
        const hostile = "<img src=x onerror=alert(1)>";
        const long = "x".repeat(80);
        const snapshot = fixtureSnapshot();
        snapshot.nodes.find((n) => n.id === "dev:uuid-gw")!.name = hostile;
        snapshot.nodes.find((n) => n.id === "dev:uuid-core")!.name = long;
        const el = await mount<UitListView>("uit-list-view", {
            ...props(),
            model: fixtureModel({}, snapshot),
        });
        const names = [
            ...el.shadowRoot!.querySelectorAll<HTMLElement>(".name"),
        ];
        expect(el.shadowRoot!.querySelector("img")).toBeNull();
        expect(names[0]!.textContent).toBe(hostile);
        expect(names[1]!.title).toBe(long);
    });
});
