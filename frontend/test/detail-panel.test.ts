import { afterEach, expect, it, vi } from "vitest";
import { makeLocalize } from "../src/localize";
import type { UitDetailPanel } from "../src/views/detail-panel";
import "../src/views/detail-panel";
import { cleanup, fixtureModel, mount } from "./helpers";

const localize = makeLocalize("en");
afterEach(cleanup);

const panel = (selectedId: string | undefined) =>
    mount<UitDetailPanel>("uit-detail-panel", {
        model: fixtureModel(),
        localize,
        selectedId,
    });
const rows = (el: UitDetailPanel) =>
    Object.fromEntries(
        [...el.shadowRoot!.querySelectorAll(".row")].map((r) => [
            r.querySelector("dt")!.textContent,
            r.querySelector("dd")!.textContent,
        ]),
    );

it("shows a device with its uplink and an Open device link", async () => {
    const el = await panel("dev:uuid-core");
    expect(el.shadowRoot!.querySelector("h3")!.textContent).toBe("Core 24");
    expect(rows(el)).toMatchObject({
        Type: "Switch",
        Model: "USW Pro Max 24",
        State: "Online",
        "Connected to": "Gateway",
        Port: "11 → 26",
        Speed: "10G",
        Link: "Wired",
    });
    el.shadowRoot!.querySelector<HTMLButtonElement>("button.action")!.click();
    expect(location.pathname).toBe("/config/devices/device/reg-core");
});

it("shows PoE draw on a powered link", async () => {
    expect(rows(await panel("dev:uuid-ap"))).toMatchObject({ PoE: "12.3 W" });
});

it("shows a client hidden inside a collapsed group", async () => {
    const el = await panel("cli:cli-tv");
    expect(rows(el)).toMatchObject({
        Connection: "Wired",
        VLAN: "3",
        Network: "Media",
        "Connected to": "Ultra A",
        Port: "4",
    });
    expect(el.shadowRoot!.querySelector("button.action")).toBeNull();
});

it("lists and searches group members, selecting one on click", async () => {
    const el = await panel("group:dev:uuid-u1");
    const selected = vi.fn();
    el.addEventListener("uit-select", (e) =>
        selected((e as CustomEvent).detail),
    );
    el.shadowRoot!.querySelector<HTMLButtonElement>("button.member")!.click();
    expect(selected).toHaveBeenCalledWith({ id: "cli:cli-tv" });
    const search = el.shadowRoot!.querySelector<HTMLInputElement>("input")!;
    search.value = "zzz";
    search.dispatchEvent(new Event("input"));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll("button.member")).toHaveLength(0);
});

it("closes on request and renders nothing without a selection", async () => {
    const el = await panel("dev:uuid-gw");
    const closed = vi.fn();
    el.addEventListener("uit-close", closed);
    el.shadowRoot!.querySelector<HTMLButtonElement>("button.close")!.click();
    expect(closed).toHaveBeenCalledOnce();
    const empty = await panel("dev:gone");
    expect(empty.shadowRoot!.querySelector("section")).toBeNull();
});
