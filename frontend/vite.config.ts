import { defineConfig } from "vitest/config";

// One self-contained ES module, written straight into the integration so
// HACS ships it. CI rebuilds and fails if the committed file differs.
export default defineConfig({
    build: {
        lib: {
            entry: "src/index.ts",
            formats: ["es"],
            fileName: () => "topology-card.js",
        },
        outDir: "../custom_components/unifi_insights/frontend",
        emptyOutDir: false,
        target: "es2022",
        minify: true,
        sourcemap: false,
        reportCompressedSize: false,
        rollupOptions: {
            output: {
                minify: {
                    compress: true,
                    mangle: { toplevel: true },
                },
            },
        },
    },
    test: {
        environment: "jsdom",
        setupFiles: ["test/setup.ts"],
        include: ["test/**/*.test.ts"],
        coverage: {
            provider: "v8",
            include: ["src/**/*.ts"],
            exclude: ["src/index.ts"],
            thresholds: { lines: 90 },
            reporter: ["text-summary"],
        },
    },
});
