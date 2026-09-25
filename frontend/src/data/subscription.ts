import {
    ERR_ENTRY_NOT_LOADED,
    ISSUE_ENTRY_UNLOADED,
    IncompatibleSchemaError,
    WS_SUBSCRIBE,
    parseSnapshot,
    type SiteTopology,
} from "../contract";
import {
    toWsError,
    type Connection,
    type UnsubscribeFunc,
    type WsError,
} from "../ha-types";

export interface SubscriptionKey {
    entry_id: string;
    site_id: string;
    max_clients: number;
}

export interface SubscriptionHandlers {
    onSnapshot(snapshot: SiteTopology): void;
    onError(error: WsError): void;
    onIncompatible(): void;
    /** The socket dropped: whatever is drawn is no longer live. */
    onDisconnected(): void;
    /** The socket is back; the stream (if any) has been reopened. */
    onReconnected(): void;
}

/**
 * Errors that mean "not yet": the entry is still setting up, or (right after
 * an HA restart) the integration has not registered its commands.
 */
const RETRYABLE = new Set([ERR_ENTRY_NOT_LOADED, "unknown_command"]);

export const BACKOFF_BASE_MS = 2000;
export const BACKOFF_MAX_MS = 60000;

/** 2 s, 4 s, 8 s ... capped at 60 s, with ±20 % jitter. */
export function backoffDelay(
    attempt: number,
    random: () => number = Math.random,
): number {
    const base = Math.min(BACKOFF_BASE_MS * 2 ** attempt, BACKOFF_MAX_MS);
    return Math.round(base * (0.8 + 0.4 * random()));
}

/**
 * One card's `topology/subscribe` stream.
 *
 * Socket reconnects are handled here, not by home-assistant-js-websocket's
 * resubscribe: the library drops a failed resubscribe silently, which is the
 * normal case after an HA restart (the entry is still loading). On `ready`
 * the stream is reopened like a first subscribe. For streams the server ends
 * (`entry_unloaded`) it releases the dead subscription and retries with
 * backoff, as it does for `entry_not_loaded` / `unknown_command`. A generation
 * counter makes every callback from a superseded subscription a no-op, so
 * racing `set hass`/connect/disconnect calls can never leave two streams open.
 */
export class TopologySubscription {
    private generation = 0;
    private connection: Connection | undefined;
    private key: SubscriptionKey | undefined;
    private keyId: string | undefined;
    private unsubscribe: UnsubscribeFunc | undefined;
    private retryTimer: ReturnType<typeof setTimeout> | undefined;
    private attempt = 0;
    private lastRevision: string | undefined;
    private isLive = false;
    private readonly handlers: SubscriptionHandlers;
    private readonly random: () => number;

    constructor(
        handlers: SubscriptionHandlers,
        random: () => number = Math.random,
    ) {
        this.handlers = handlers;
        this.random = random;
    }

    get live(): boolean {
        return this.isLive;
    }

    /** Point the stream at a connection and site; a no-op when neither changed. */
    update(
        connection: Connection | undefined,
        key: SubscriptionKey | undefined,
    ): void {
        const keyId = key
            ? JSON.stringify([key.entry_id, key.site_id, key.max_clients])
            : undefined;
        if (connection === this.connection && keyId === this.keyId) return;
        this.stop();
        this.connection = connection;
        this.key = key;
        this.keyId = keyId;
        if (connection) {
            connection.addEventListener("ready", this.onReady);
            connection.addEventListener("disconnected", this.onDisconnected);
        }
        if (connection && key) this.open();
    }

    stop(): void {
        this.generation++;
        this.clearRetry();
        this.attempt = 0;
        this.release();
        this.connection?.removeEventListener("ready", this.onReady);
        this.connection?.removeEventListener(
            "disconnected",
            this.onDisconnected,
        );
        this.connection = undefined;
        this.key = undefined;
        this.keyId = undefined;
    }

    private clearRetry(): void {
        if (this.retryTimer !== undefined) clearTimeout(this.retryTimer);
        this.retryTimer = undefined;
    }

    /** The socket is gone and took the subscription with it: nothing to unsubscribe. */
    private drop(): void {
        this.generation++;
        this.clearRetry();
        this.unsubscribe = undefined;
        this.isLive = false;
        this.lastRevision = undefined;
    }

    private readonly onDisconnected = (): void => {
        this.drop();
        this.handlers.onDisconnected();
    };

    private readonly onReady = (): void => {
        this.drop();
        this.attempt = 0;
        if (this.key) this.open();
        this.handlers.onReconnected();
    };

    private release(): void {
        const unsubscribe = this.unsubscribe;
        this.unsubscribe = undefined;
        this.isLive = false;
        this.lastRevision = undefined;
        // After entry_unloaded the server already dropped it; this call still
        // stops the websocket library from resubscribing it on reconnect.
        if (unsubscribe) unsubscribe().catch(() => undefined);
    }

    private open(): void {
        const generation = ++this.generation;
        const { connection, key } = this;
        if (!connection || !key) return;
        connection
            .subscribeMessage<unknown>(
                (raw) => {
                    if (generation === this.generation) this.receive(raw);
                },
                {
                    type: WS_SUBSCRIBE,
                    entry_id: key.entry_id,
                    site_id: key.site_id,
                    max_clients: key.max_clients,
                },
                { resubscribe: false },
            )
            .then(
                (unsubscribe) => {
                    if (generation === this.generation)
                        this.unsubscribe = unsubscribe;
                    else unsubscribe().catch(() => undefined);
                },
                (err: unknown) => {
                    if (generation !== this.generation) return;
                    const error = toWsError(err);
                    this.handlers.onError(error);
                    if (RETRYABLE.has(error.code)) this.scheduleRetry();
                },
            );
    }

    private receive(raw: unknown): void {
        let snapshot: SiteTopology;
        try {
            snapshot = parseSnapshot(raw);
        } catch (err) {
            if (err instanceof IncompatibleSchemaError)
                this.handlers.onIncompatible();
            else
                this.handlers.onError({
                    code: "invalid_payload",
                    message: String(err),
                });
            return;
        }
        const unloaded = snapshot.issues.some(
            (issue) => issue.code === ISSUE_ENTRY_UNLOADED,
        );
        if (!unloaded) {
            // Set here, not after `await subscribeMessage`: HA can deliver the
            // result and the first event in the same frame.
            this.isLive = true;
            this.attempt = 0;
        }
        // Every unavailable snapshot carries revision "", so only real revisions dedupe.
        if (snapshot.revision !== "" && snapshot.revision === this.lastRevision)
            return;
        this.lastRevision = snapshot.revision;
        this.handlers.onSnapshot(snapshot);
        if (unloaded) {
            this.generation++;
            this.release();
            this.scheduleRetry();
        }
    }

    private scheduleRetry(): void {
        const generation = this.generation;
        const delay = backoffDelay(this.attempt++, this.random);
        this.retryTimer = setTimeout(() => {
            this.retryTimer = undefined;
            if (generation === this.generation) this.open();
        }, delay);
    }
}
