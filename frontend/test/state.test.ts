import { describe, expect, it } from "vitest";
import {
    deriveState,
    errorNotice,
    issueNotice,
    type StateInput,
} from "../src/data/state";
import { SOURCES_ONE, fixtureSnapshot, unavailableSnapshot } from "./helpers";

const BINDING = { entry_id: "entry-1", site_id: "site-1" };
const base: StateInput = {
    sources: SOURCES_ONE,
    binding: BINDING,
    incompatible: false,
    maxClients: 500,
};

describe("deriveState", () => {
    it("reports incompatible above everything else", () => {
        expect(
            deriveState({
                ...base,
                incompatible: true,
                error: { code: "x", message: "" },
            }).phase,
        ).toBe("incompatible");
    });

    it("greys the current graph while the socket is down", () => {
        const snapshot = fixtureSnapshot();
        expect(
            deriveState({ ...base, snapshot, disconnected: true }),
        ).toMatchObject({ phase: "reloading", render: snapshot, stale: true });
        expect(deriveState({ ...base, disconnected: true }).phase).toBe(
            "loading",
        );
    });

    it("shows an error over the last good graph", () => {
        const lastGood = fixtureSnapshot();
        const state = deriveState({
            ...base,
            error: { code: "site_not_selected", message: "" },
            lastGood,
        });
        expect(state).toMatchObject({
            phase: "error",
            render: lastGood,
            stale: true,
        });
        expect(state.notices[0]).toMatchObject({
            key: "error.site_not_selected",
            action: "edit",
        });
        expect(
            deriveState({ ...base, error: { code: "boom", message: "" } }),
        ).toMatchObject({ render: undefined, stale: false });
    });

    it("walks loading → no_sources → unconfigured → loading", () => {
        expect(
            deriveState({ ...base, sources: undefined, binding: undefined })
                .phase,
        ).toBe("loading");
        expect(deriveState({ ...base, sources: [] }).phase).toBe("no_sources");
        expect(deriveState({ ...base, binding: undefined }).phase).toBe(
            "unconfigured",
        );
        expect(deriveState({ ...base }).phase).toBe("loading");
    });

    it("lets a live snapshot outrank sources fetched before its entry loaded", () => {
        expect(
            deriveState({ ...base, sources: [], snapshot: fixtureSnapshot() })
                .phase,
        ).toBe("ok");
    });

    it("renders ok, empty and partial snapshots", () => {
        expect(
            deriveState({ ...base, snapshot: fixtureSnapshot() }),
        ).toMatchObject({ phase: "ok", stale: false, notices: [] });
        expect(
            deriveState({
                ...base,
                snapshot: fixtureSnapshot({ nodes: [], edges: [] }),
            }).phase,
        ).toBe("empty");
        const partial = fixtureSnapshot({
            status: "partial",
            issues: [
                { code: "parents_unresolved", severity: "warning" },
                { code: "clients_truncated", severity: "info" },
            ],
            unresolved: [
                { node_id: "dev:x", reason: "parent_not_found" },
                { node_id: "cli:y", reason: "no_uplink_data" },
            ],
            truncation: { clients_total: 612, clients_included: 500 },
        });
        const state = deriveState({ ...base, snapshot: partial });
        expect(state.phase).toBe("partial");
        expect(state.notices).toEqual([
            {
                code: "parents_unresolved",
                severity: "warning",
                key: "issue.parents_unresolved",
                vars: { count: 2 },
            },
            {
                code: "clients_truncated",
                severity: "info",
                key: "issue.clients_truncated",
                vars: { included: 500, total: 612, max: 500 },
            },
        ]);
    });

    it("keeps the last good graph, greyed, while a site is unavailable", () => {
        const lastGood = fixtureSnapshot();
        const state = deriveState({
            ...base,
            snapshot: unavailableSnapshot("site_unavailable"),
            lastGood,
        });
        expect(state).toMatchObject({
            phase: "unavailable",
            render: lastGood,
            stale: true,
        });
    });

    it("renders last-known devices when devices are unavailable", () => {
        const snapshot = fixtureSnapshot({
            status: "unavailable",
            issues: [{ code: "devices_unavailable", severity: "error" }],
        });
        const state = deriveState({ ...base, snapshot });
        expect(state).toMatchObject({
            phase: "unavailable",
            render: snapshot,
            stale: true,
        });
        expect(state.notices[0]).toMatchObject({ action: "integration" });
    });

    it("shows reloading after entry_unloaded", () => {
        expect(
            deriveState({
                ...base,
                snapshot: unavailableSnapshot("entry_unloaded"),
            }),
        ).toMatchObject({
            phase: "reloading",
            render: undefined,
            stale: false,
        });
    });
});

describe("notices", () => {
    it("falls back to a generic message for unknown codes", () => {
        expect(
            issueNotice(
                { code: "new_thing", severity: "warning" },
                fixtureSnapshot(),
                500,
            ),
        ).toEqual({
            code: "new_thing",
            severity: "warning",
            key: "issue.unknown",
            vars: { code: "new_thing" },
        });
        expect(errorNotice({ code: "weird", message: "" })).toEqual({
            code: "weird",
            severity: "error",
            key: "error.unknown",
            vars: { code: "weird" },
        });
    });

    it("attaches the right action to each error", () => {
        expect(
            errorNotice({ code: "entry_not_found", message: "" }).action,
        ).toBe("edit");
        expect(
            errorNotice({ code: "entry_not_loaded", message: "" }).action,
        ).toBe("integration");
    });
});
