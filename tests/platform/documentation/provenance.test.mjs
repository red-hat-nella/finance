import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../..");
const text = fs.readFileSync(path.join(root, "docs/operations/openshift-deployment.md"), "utf8");
for (const line of text.split(/\r?\n/).filter((line) => line.startsWith("| ") && !line.includes("---") && !line.includes("Estado"))) assert.match(line, /\b(?:DECLARED|OBSERVED|PENDING_VALIDATION)\b/);
assert.match(text, /nombres efímeros nunca son identidad operativa estable/);
assert.doesNotMatch(text, /pod\/[a-z0-9-]+-[a-z0-9]{5,10}\b/);
