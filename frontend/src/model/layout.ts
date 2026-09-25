import { hierarchy, tree } from "d3-hierarchy";
import type { Density, Orientation } from "../config";
import type { GraphModel } from "./graph-model";

export interface Point {
    x: number;
    y: number;
}

export interface Bounds {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

export interface Layout {
    positions: Map<string, Point>;
    bounds: Bounds;
}

export interface ViewTransform {
    x: number;
    y: number;
    k: number;
}

/** Distance between siblings (`breadth`) and between levels (`depth`), in SVG units. */
export const SPACING: Record<Density, { breadth: number; depth: number }> = {
    comfortable: { breadth: 132, depth: 150 },
    compact: { breadth: 92, depth: 112 },
};

/** Above this many visible nodes only those near the viewport are put in the DOM. */
export const CULL_THRESHOLD = 300;

const SUPER_ROOT = "\u0000root";

/** Tidy-tree layout of the model; a synthetic super-root turns the forest into one tree. */
export function layoutModel(
    model: GraphModel,
    density: Density,
    orientation: Orientation,
): Layout {
    const positions = new Map<string, Point>();
    if (model.roots.length === 0)
        return { positions, bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 } };
    const { breadth, depth } = SPACING[density];
    const root = hierarchy<string>(SUPER_ROOT, (id) =>
        id === SUPER_ROOT ? model.roots : model.children.get(id),
    );
    const laidOut = tree<string>()
        .nodeSize([breadth, depth])
        .separation((a, b) => (a.parent === b.parent ? 1 : 1.25))(root);
    const bounds: Bounds = {
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity,
    };
    for (const n of laidOut.descendants()) {
        if (n.data === SUPER_ROOT) continue;
        const along = n.x;
        const down = (n.depth - 1) * depth;
        const p =
            orientation === "vertical"
                ? { x: along, y: down }
                : { x: down, y: along };
        positions.set(n.data, p);
        bounds.minX = Math.min(bounds.minX, p.x);
        bounds.minY = Math.min(bounds.minY, p.y);
        bounds.maxX = Math.max(bounds.maxX, p.x);
        bounds.maxY = Math.max(bounds.maxY, p.y);
    }
    return { positions, bounds };
}

/** Transform that centres `bounds` in the viewport, scaled into [0.2, 1.5]. */
export function fitTransform(
    bounds: Bounds,
    width: number,
    height: number,
    padding = 48,
): ViewTransform {
    const w = Math.max(bounds.maxX - bounds.minX, 1);
    const h = Math.max(bounds.maxY - bounds.minY, 1);
    const k = Math.min(
        1.5,
        Math.max(
            0.2,
            Math.min((width - 2 * padding) / w, (height - 2 * padding) / h),
        ),
    );
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;
    return { k, x: width / 2 - cx * k, y: height / 2 - cy * k };
}

/** Ids whose screen position falls inside the viewport grown by `margin` px. */
export function visibleIds(
    layout: Layout,
    t: ViewTransform,
    width: number,
    height: number,
    margin = 120,
): Set<string> {
    const out = new Set<string>();
    for (const [id, p] of layout.positions) {
        const sx = p.x * t.k + t.x;
        const sy = p.y * t.k + t.y;
        if (
            sx >= -margin &&
            sx <= width + margin &&
            sy >= -margin &&
            sy <= height + margin
        )
            out.add(id);
    }
    return out;
}
