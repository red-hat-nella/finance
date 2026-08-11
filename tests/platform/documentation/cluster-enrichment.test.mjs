import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../..");
const profile = JSON.parse(fs.readFileSync(path.join(root, "build/platform/dev-profile.json"), "utf8"));
const text = fs.readFileSync(path.join(root, "docs/operations/openshift-deployment.md"), "utf8");
assert.equal(profile.cluster.status, "OBSERVED");
assert.match(text, new RegExp(profile.cluster.contextRef.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(text, new RegExp(profile.cluster.version.replaceAll(".", "\\.")));
const generator = fs.readFileSync(path.join(root, "scripts/platform/generate-operations-doc"), "utf8");
assert.doesNotMatch(generator, /oc\s+(?:get|describe)\s+secrets?/i);
