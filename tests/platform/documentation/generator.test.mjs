import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../..");
const text = fs.readFileSync(path.join(root, "docs/operations/openshift-deployment.md"), "utf8");
for (const expected of ["Deployment/frontend", "Deployment/ingestion", "Deployment/scoring", "StatefulSet/postgres", "Job/migrations", "CronJob/retention", "CronJob/reconciler", "ServiceAccount", "Route", "PVC/postgres-data", "Application alternative-credit-scoring-dev"]) assert.match(text, new RegExp(expected));
assert.match(text, /Réplicas o ciclo/);
