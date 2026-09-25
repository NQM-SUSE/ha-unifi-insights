import { statSync } from "node:fs";

const BUDGET = 150 * 1024;
const bundle = new URL(
    "../../custom_components/unifi_insights/frontend/topology-card.js",
    import.meta.url,
);
const size = statSync(bundle).size;
console.log(
    `topology-card.js: ${(size / 1024).toFixed(1)} KB (budget ${BUDGET / 1024} KB)`,
);
if (size > BUDGET) {
    console.error("Bundle exceeds its size budget.");
    process.exit(1);
}
