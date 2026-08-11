#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
RENDER="$(mktemp)"; trap 'rm -f "$RENDER"' EXIT
oc kustomize "$ROOT/deploy/openshift/overlays/dev" > "$RENDER"
RENDER="$RENDER" node --input-type=module <<'NODE'
import fs from 'node:fs'; import {parseAllDocuments} from 'yaml';
const docs=parseAllDocuments(fs.readFileSync(process.env.RENDER,'utf8')).map(d=>d.toJSON()).filter(Boolean);
const assert=(v,m)=>{if(!v)throw new Error(m)};
for(const name of ['frontend','ingestion','scoring']){
 const d=docs.find(x=>x.kind==='Deployment'&&x.metadata.name===name); const c=d?.spec?.template?.spec?.containers?.[0];
 assert(d?.spec?.replicas===2,`${name} replicas`); assert(d?.spec?.strategy?.rollingUpdate?.maxUnavailable===0,`${name} zero unavailable rollout`);
 assert(c?.livenessProbe&&c?.readinessProbe,`${name} probes`); assert(c?.resources?.requests&&c?.resources?.limits,`${name} resources`);
 assert(d.spec.template.spec.terminationGracePeriodSeconds>=30,`${name} termination grace`);
 const pdb=docs.find(x=>x.kind==='PodDisruptionBudget'&&x.metadata.name===name); assert(pdb?.spec?.minAvailable===1,`${name} PDB`);
}
for(const name of ['migrations','retention','reconciler']){
 const item=docs.find(x=>['Job','CronJob'].includes(x.kind)&&x.metadata.name===name); assert(item,`${name} controller`);
 const job=item.kind==='CronJob'?item.spec.jobTemplate.spec:item.spec; assert(job.activeDeadlineSeconds>0,`${name} deadline`); assert(job.ttlSecondsAfterFinished>0,`${name} TTL`);
}
NODE
echo "Workload lifecycle: PASS"
