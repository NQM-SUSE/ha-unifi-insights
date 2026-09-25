import { expect, it } from "vitest";

it("runs in a DOM environment with the browser stubs", () => {
    expect(typeof document.createElement).toBe("function");
    expect(typeof ResizeObserver).toBe("function");
    expect(window.matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(
        false,
    );
});
