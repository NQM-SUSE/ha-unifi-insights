import { describe, expect, it } from "vitest";
import { NODE_KINDS } from "../src/contract";
import { buildModel } from "../src/model/graph-model";
import {
    SPACING,
    fitTransform,
    layoutModel,
    visibleIds,
} from "../src/model/layout";
import { fixtureSnapshot } from "./helpers";

const model = buildModel(fixtureSnapshot(), {
    kinds: new Set(NODE_KINDS),
    clients: "collapsed",
    toggledGroups: new Set(),
});

describe("layoutModel", () => {
    it("places every visual, one depth step per level", () => {
        const layout = layoutModel(model, "comfortable", "vertical");
        expect([...layout.positions.keys()].sort()).toEqual(
            [...model.visuals.keys()].sort(),
        );
        const depth = SPACING.comfortable.depth;
        expect(layout.positions.get("dev:uuid-gw")!.y).toBe(0);
        expect(layout.positions.get("dev:uuid-core")!.y).toBe(depth);
        expect(layout.positions.get("dev:uuid-ap")!.y).toBe(2 * depth);
        expect(layout.positions.get("group:dev:uuid-ap")!.y).toBe(3 * depth);
        const xs = model.children
            .get("dev:uuid-core")!
            .map((id) => layout.positions.get(id)!.x);
        expect(new Set(xs).size).toBe(xs.length);
    });

    it("swaps axes when horizontal and tightens when compact", () => {
        const horizontal = layoutModel(model, "compact", "horizontal");
        expect(horizontal.positions.get("dev:uuid-core")).toMatchObject({
            x: SPACING.compact.depth,
        });
        expect(horizontal.bounds.maxX).toBe(3 * SPACING.compact.depth);
    });

    it("handles an empty model", () => {
        const empty = buildModel(fixtureSnapshot({ nodes: [], edges: [] }), {
            kinds: new Set(NODE_KINDS),
            clients: "collapsed",
            toggledGroups: new Set(),
        });
        expect(
            layoutModel(empty, "comfortable", "vertical").positions.size,
        ).toBe(0);
    });
});

describe("viewport maths", () => {
    it("fits and centres the bounds, clamped to 1.5×", () => {
        expect(
            fitTransform({ minX: 0, minY: 0, maxX: 100, maxY: 100 }, 400, 300),
        ).toEqual({ k: 1.5, x: 125, y: 75 });
        const wide = fitTransform(
            { minX: 0, minY: 0, maxX: 10000, maxY: 100 },
            400,
            300,
        );
        expect(wide.k).toBe(0.2);
    });

    it("culls positions outside the viewport plus margin", () => {
        const layout = {
            positions: new Map([
                ["in", { x: 10, y: 10 }],
                ["out", { x: 5000, y: 10 }],
            ]),
            bounds: { minX: 10, minY: 10, maxX: 5000, maxY: 10 },
        };
        expect([...visibleIds(layout, { x: 0, y: 0, k: 1 }, 800, 600)]).toEqual(
            ["in"],
        );
    });
});
