import type { SiteBinding } from "../config";
import {
    ERR_ENTRY_NOT_FOUND,
    ERR_ENTRY_NOT_LOADED,
    ERR_SITE_NOT_SELECTED,
    ISSUE_CLIENTS_TRUNCATED,
    ISSUE_DEVICES_UNAVAILABLE,
    ISSUE_ENTRY_UNLOADED,
    ISSUE_LEGACY_UPLINK_MISSING,
    ISSUE_PARENTS_UNRESOLVED,
    ISSUE_SITE_UNAVAILABLE,
    type IssueSeverity,
    type SiteTopology,
    type TopologyIssue,
    type TopologySource,
} from "../contract";
import type { WsError } from "../ha-types";
import type { LocalizeKey, LocalizeVars } from "../localize";

export type CardPhase =
    | "loading"
    | "no_sources"
    | "unconfigured"
    | "empty"
    | "ok"
    | "partial"
    | "unavailable"
    | "reloading"
    | "error"
    | "incompatible";

export type NoticeAction = "integration" | "edit";

export interface Notice {
    code: string;
    severity: IssueSeverity;
    key: LocalizeKey;
    vars?: LocalizeVars;
    action?: NoticeAction;
}

export interface StateInput {
    sources: TopologySource[] | undefined;
    binding: SiteBinding | undefined;
    snapshot?: SiteTopology | undefined;
    lastGood?: SiteTopology | undefined;
    error?: WsError | undefined;
    incompatible: boolean;
    /** The socket is down; `snapshot` is whatever arrived before it dropped. */
    disconnected?: boolean;
    maxClients: number;
}

export interface CardState {
    phase: CardPhase;
    /** The snapshot to draw (possibly the last good one), if any. */
    render?: SiteTopology | undefined;
    /** `render` is not current data: draw it greyed with a "stale" badge. */
    stale: boolean;
    notices: Notice[];
}

interface NoticeText {
    key: LocalizeKey;
    action?: NoticeAction;
}

const ISSUE_TEXT: Record<string, NoticeText> = {
    [ISSUE_SITE_UNAVAILABLE]: { key: "issue.site_unavailable" },
    [ISSUE_DEVICES_UNAVAILABLE]: {
        key: "issue.devices_unavailable",
        action: "integration",
    },
    [ISSUE_LEGACY_UPLINK_MISSING]: { key: "issue.legacy_uplink_missing" },
    [ISSUE_PARENTS_UNRESOLVED]: { key: "issue.parents_unresolved" },
    [ISSUE_CLIENTS_TRUNCATED]: { key: "issue.clients_truncated" },
    [ISSUE_ENTRY_UNLOADED]: { key: "issue.entry_unloaded" },
};

const ERROR_TEXT: Record<string, NoticeText> = {
    [ERR_ENTRY_NOT_FOUND]: { key: "error.entry_not_found", action: "edit" },
    [ERR_SITE_NOT_SELECTED]: { key: "error.site_not_selected", action: "edit" },
    [ERR_ENTRY_NOT_LOADED]: {
        key: "error.entry_not_loaded",
        action: "integration",
    },
};

export function issueNotice(
    issue: TopologyIssue,
    snapshot: SiteTopology,
    maxClients: number,
): Notice {
    const text = ISSUE_TEXT[issue.code];
    if (!text)
        return {
            code: issue.code,
            severity: issue.severity,
            key: "issue.unknown",
            vars: { code: issue.code },
        };
    const notice: Notice = {
        code: issue.code,
        severity: issue.severity,
        key: text.key,
    };
    if (issue.code === ISSUE_PARENTS_UNRESOLVED)
        notice.vars = { count: snapshot.unresolved.length };
    if (issue.code === ISSUE_CLIENTS_TRUNCATED && snapshot.truncation) {
        notice.vars = {
            included: snapshot.truncation.clients_included,
            total: snapshot.truncation.clients_total,
            max: maxClients,
        };
    }
    if (text.action) notice.action = text.action;
    return notice;
}

export function errorNotice(error: WsError): Notice {
    const text = ERROR_TEXT[error.code];
    if (!text)
        return {
            code: error.code,
            severity: "error",
            key: "error.unknown",
            vars: { code: error.code },
        };
    const notice: Notice = {
        code: error.code,
        severity: "error",
        key: text.key,
    };
    if (text.action) notice.action = text.action;
    return notice;
}

/** Pure mapping from what the card knows to what it shows (spec §5). */
export function deriveState(input: StateInput): CardState {
    if (input.incompatible)
        return { phase: "incompatible", stale: false, notices: [] };
    if (input.error) {
        return {
            phase: "error",
            render: input.lastGood,
            stale: input.lastGood !== undefined,
            notices: [errorNotice(input.error)],
        };
    }
    if (input.disconnected) {
        const current = input.snapshot;
        const render =
            current && current.nodes.length > 0 ? current : input.lastGood;
        if (render)
            return { phase: "reloading", render, stale: true, notices: [] };
    }
    // Sources lists loaded entries only, so it can be empty while an explicitly
    // bound entry is still setting up; a live snapshot outranks it.
    if (
        input.sources !== undefined &&
        input.sources.length === 0 &&
        input.snapshot === undefined
    )
        return { phase: "no_sources", stale: false, notices: [] };
    if (input.binding === undefined) {
        return {
            phase: input.sources === undefined ? "loading" : "unconfigured",
            stale: false,
            notices: [],
        };
    }
    const snapshot = input.snapshot;
    if (snapshot === undefined)
        return { phase: "loading", stale: false, notices: [] };
    const notices = snapshot.issues.map((issue) =>
        issueNotice(issue, snapshot, input.maxClients),
    );
    if (snapshot.status === "unavailable") {
        const unloaded = snapshot.issues.some(
            (issue) => issue.code === ISSUE_ENTRY_UNLOADED,
        );
        const render = snapshot.nodes.length > 0 ? snapshot : input.lastGood;
        return {
            phase: unloaded ? "reloading" : "unavailable",
            render,
            stale: render !== undefined,
            notices,
        };
    }
    if (snapshot.nodes.length === 0)
        return { phase: "empty", stale: false, notices };
    return {
        phase: snapshot.status === "partial" ? "partial" : "ok",
        render: snapshot,
        stale: false,
        notices,
    };
}
