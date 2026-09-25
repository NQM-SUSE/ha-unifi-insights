/**
 * Feeds the card's polite live region. Snapshots can arrive every ~30 s, so
 * at most one message is spoken per interval and only the latest pending one.
 */
export class Announcer {
    private last = Number.NEGATIVE_INFINITY;
    private pending: string | undefined;
    private timer: ReturnType<typeof setTimeout> | undefined;
    private readonly emit: (message: string) => void;
    private readonly intervalMs: number;

    constructor(emit: (message: string) => void, intervalMs = 5000) {
        this.emit = emit;
        this.intervalMs = intervalMs;
    }

    announce(message: string): void {
        const wait = this.last + this.intervalMs - Date.now();
        if (wait <= 0 && this.timer === undefined) {
            this.last = Date.now();
            this.emit(message);
            return;
        }
        this.pending = message;
        this.timer ??= setTimeout(
            () => {
                this.timer = undefined;
                const next = this.pending;
                this.pending = undefined;
                if (next !== undefined) {
                    this.last = Date.now();
                    this.emit(next);
                }
            },
            Math.max(wait, 0),
        );
    }

    dispose(): void {
        if (this.timer !== undefined) clearTimeout(this.timer);
        this.timer = undefined;
        this.pending = undefined;
    }
}
