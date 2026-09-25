import { expect, it } from "vitest";
import { makeLocalize } from "../src/localize";

it("interpolates variables", () => {
    expect(
        makeLocalize("en")("issue.clients_truncated", {
            included: 500,
            total: 612,
            max: 500,
        }),
    ).toBe("Showing 500 of 612 clients (limit 500).");
});

it("falls back to English for languages without a table", () => {
    expect(makeLocalize("de-DE")("view.graph")).toBe("Graph");
    expect(makeLocalize(undefined)("view.list")).toBe("List");
});
