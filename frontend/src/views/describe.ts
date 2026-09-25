import type { ViewMode } from "../config";
import type {
    LinkMedium,
    NodeKind,
    NodeState,
    TopologyEdge,
} from "../contract";
import type { LocalizeFunc, LocalizeKey } from "../localize";
import {
    ROOT_CLIENT_GROUP,
    UNCONNECTED_GROUP,
    type GraphModel,
    type Visual,
} from "../model/graph-model";

export const KIND_KEYS: Record<NodeKind, LocalizeKey> = {
    gateway: "kind.gateway",
    switch: "kind.switch",
    access_point: "kind.access_point",
    client: "kind.client",
    other: "kind.other",
};
export const STATE_KEYS: Record<NodeState, LocalizeKey> = {
    online: "state.online",
    offline: "state.offline",
    unknown: "state.unknown",
};
export const VIEW_KEYS: Record<ViewMode, LocalizeKey> = {
    graph: "view.graph",
    list: "view.list",
};
export const MEDIUM_KEYS: Record<LinkMedium, LocalizeKey> = {
    wired: "medium.wired",
    wireless: "medium.wireless",
    unknown: "medium.unknown",
};

/** Shorten to `max` characters (not UTF-16 units) with an ellipsis. */
export function truncate(text: string, max: number): string {
    const chars = [...text];
    return chars.length > max ? `${chars.slice(0, max - 1).join("")}…` : text;
}

const trim = (n: number): string =>
    Number.isInteger(n) ? String(n) : n.toFixed(1);

export function formatSpeed(mbps: number): string {
    return mbps >= 1000 ? `${trim(mbps / 1000)}G` : `${mbps}M`;
}

export function formatSpeedLong(mbps: number): string {
    return mbps >= 1000 ? `${trim(mbps / 1000)} gigabit` : `${mbps} megabit`;
}

/** Short on-canvas link label, e.g. "p11 · 10G · PoE". */
export function linkLabel(edge: TopologyEdge | undefined): string {
    if (!edge) return "";
    const parts: string[] = [];
    if (edge.parent_port !== undefined) parts.push(`p${edge.parent_port}`);
    if (edge.speed_mbps) parts.push(formatSpeed(edge.speed_mbps));
    if (edge.poe_power_w !== undefined) parts.push("PoE");
    return parts.join(" · ");
}

export function visualTitle(visual: Visual, localize: LocalizeFunc): string {
    if (visual.type !== "group") return visual.node.name;
    if (visual.id === UNCONNECTED_GROUP) return localize("group.unconnected");
    if (visual.id === ROOT_CLIENT_GROUP) return localize("group.root");
    return visual.counts.total === 1
        ? localize("group.client_one")
        : localize("group.clients", { count: visual.counts.total });
}

/** A group reads as offline only when every member is offline. */
export function visualState(visual: Visual): NodeState {
    if (visual.type !== "group") return visual.node.state;
    return visual.counts.offline === visual.counts.total ? "offline" : "online";
}

/** Full spoken label: kind, name, state, client count, uplink. */
export function describeVisual(
    model: GraphModel,
    visual: Visual,
    localize: LocalizeFunc,
): string {
    if (visual.type === "group") {
        return `${visualTitle(visual, localize)}: ${localize("group.summary", { wireless: visual.counts.wireless, offline: visual.counts.offline })}`;
    }
    const n = visual.node;
    const parts = [
        localize("node.label", {
            kind: localize(KIND_KEYS[n.kind]),
            name: n.name,
            state: localize(STATE_KEYS[n.state]).toLocaleLowerCase(),
        }),
    ];
    const clients = model.clientCounts.get(n.id)?.total ?? 0;
    if (clients > 0)
        parts.push(
            clients === 1
                ? localize("node.client_one")
                : localize("node.clients", { count: clients }),
        );
    const edge = model.edges.get(n.id);
    if (edge?.parent_port !== undefined) {
        parts.push(
            edge.speed_mbps
                ? localize("node.uplink_speed", {
                      port: edge.parent_port,
                      speed: formatSpeedLong(edge.speed_mbps),
                  })
                : localize("node.uplink", { port: edge.parent_port }),
        );
    } else if (n.connection) {
        parts.push(localize(MEDIUM_KEYS[n.connection]).toLocaleLowerCase());
    }
    return parts.join(", ");
}
