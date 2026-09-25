import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Announcer } from "../src/data/announcer";

beforeEach(() => {
    vi.useFakeTimers();
});
afterEach(() => {
    vi.useRealTimers();
});

it("announces at most once per interval, keeping the latest message", () => {
    const emit = vi.fn();
    const announcer = new Announcer(emit, 5000);
    announcer.announce("a");
    announcer.announce("b");
    announcer.announce("c");
    expect(emit.mock.calls).toEqual([["a"]]);
    vi.advanceTimersByTime(5000);
    expect(emit.mock.calls).toEqual([["a"], ["c"]]);
    vi.advanceTimersByTime(5000);
    announcer.announce("d");
    expect(emit.mock.calls).toEqual([["a"], ["c"], ["d"]]);
});

it("drops pending messages on dispose", () => {
    const emit = vi.fn();
    const announcer = new Announcer(emit, 5000);
    announcer.announce("a");
    announcer.announce("b");
    announcer.dispose();
    vi.advanceTimersByTime(10000);
    expect(emit.mock.calls).toEqual([["a"]]);
});
