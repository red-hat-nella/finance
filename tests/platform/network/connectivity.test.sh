#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
DEV="$(mktemp)"; PROD="$(mktemp)"; trap 'rm -f "$DEV" "$PROD"' EXIT
oc kustomize "$ROOT/deploy/openshift/overlays/dev" > "$DEV"
oc kustomize "$ROOT/deploy/openshift/overlays/production" > "$PROD"
DEV="$DEV" PROD="$PROD" node --input-type=module <<'NODE'
import fs from 'node:fs'; import {parseAllDocuments} from 'yaml';
const read=p=>parseAllDocuments(fs.readFileSync(p,'utf8')).map(d=>d.toJSON()).filter(Boolean);
const dev=read(process.env.DEV), prod=read(process.env.PROD), assert=(v,m)=>{if(!v)throw new Error(m)};
const policies=new Map(dev.filter(x=>x.kind==='NetworkPolicy').map(x=>[x.metadata.name,x]));
for(const name of ['default-deny','allow-cluster-dns','router-to-frontend','frontend-to-ingestion','ingestion-from-frontend','ingestion-to-scoring-and-database','scoring-from-ingestion','database-from-runtime-and-jobs','database-jobs-to-postgres','ingestion-to-jwks']) assert(policies.has(name),`missing ${name}`);
const scoring=policies.get('scoring-from-ingestion'); assert(scoring.spec.policyTypes.includes('Egress')&&!scoring.spec.egress,'scoring must have no business egress');
assert(!dev.some(x=>x.kind==='Route'&&x.metadata.name!=='frontend'),'internal Route forbidden');
for(const policy of prod.filter(x=>x.kind==='NetworkPolicy')) for(const rule of policy.spec.egress??[]) for(const target of rule.to??[]) assert(target.ipBlock?.cidr!=='0.0.0.0/0',`${policy.metadata.name} open egress`);
NODE
echo "Positive and negative network model: PASS"
