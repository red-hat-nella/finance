# Implementation Plan: Ejecución operativa en OpenShift

**Branch**: `main` | **Date**: 2026-08-09 | **Spec**: `specs/002-openshift-runtime-requirements/spec.md`

**Input**: Feature specification from
`specs/002-openshift-runtime-requirements/spec.md`

## Summary

Completar el delivery OpenShift de la aplicación de scoring conservando su topología
real: frontend, ingestion y scoring como servicios stateless; migraciones como proceso
finito; retención y reconciliación como procesos programados; PostgreSQL como único
propietario durable; e identidad OIDC externa. El estado deseado se versionará por
ambiente, las tres imágenes se construirán una vez y promoverán por digest, y GitOps
será la única vía de operación continua.

El cluster observado ejecuta OpenShift 4.21.21 y permite trabajar en
`rh-ee-mpolo-dev`; ofrece OpenShift Pipelines 1.23.1 y `gp3`, pero no expone APIs de
OpenShift GitOps ni External Secrets. Por ello el plan genera contratos, pipeline,
manifiestos GitOps y validación estática, usa referencias de Secret creadas por canal
seguro y deja reconciliación dinámica como pendiente hasta que la organización habilite
un controlador aprobado. No se instalarán operadores ni se tocarán workloads ajenos.

## Technical Context

**Language/Version**: Angular/TypeScript sobre Node.js 22 para frontend; TypeScript
sobre Node.js 22 para ingestion/jobs; Python 3.12 para scoring; SQL PostgreSQL 16; YAML
Kubernetes/OpenShift, Tekton y Kustomize; Rego para políticas locales.

**Primary Dependencies**: Angular 18, Nginx 1.24, Node/Express, FastAPI/Uvicorn,
PostgreSQL 16, OpenAPI 3, Kustomize, OpenShift Pipelines/Tekton; OpenShift GitOps o
equivalente aprobado como prerrequisito externo.

**Storage**: PostgreSQL obligatorio. Dev usa 5 Gi RWO `gp3` en una instancia
autogestionada no HA. Producción usa servicio corporativo/administrado u operador
soportado confirmado, con backup/restore; ningún otro componente recibe PVC.

**Testing**: lint/typecheck, Vitest, pytest, pruebas de contrato, integración PostgreSQL,
Playwright/E2E/accesibilidad, escaneo de secretos/logs/dependencias, Syft, Trivy,
Kustomize, JSON Schema, validación OpenShift server-side, políticas Rego, conectividad,
smoke, persistencia, backup/restore y rollback.

**Target Platform**: Red Hat OpenShift Container Platform 4.21.21 observado para dev;
APIs estables `apps/v1`, `batch/v1`, `v1`, `networking.k8s.io/v1` y
`route.openshift.io/v1`. Producción debe confirmar versión compatible antes de promover.

**Project Type**: aplicación web de microservicios con tres servicios de larga duración,
dos tareas programadas, migración de esquema y servicio de datos durable.

**Deployment Model**: Deployments para frontend/ingestion/scoring; Services internos;
una Route TLS para frontend; Job de migraciones; CronJobs de retention/reconciler;
StatefulSet/PVC solo en dev; DB externa en producción; PDB para stateless. Sin HPA hasta
obtener métricas de carga.

**Target OpenShift / Kubernetes APIs**: OpenShift 4.21.21 `OBSERVED`; Tekton
`tekton.dev/v1` `OBSERVED`; Argo CD `argoproj.io/v1alpha1` y External Secrets
`external-secrets.io` ausentes. Los CR de capacidades ausentes se validan con esquemas
vendorizados y no se aplican hasta discovery positivo.

**Cluster Discovery Status**: inspección MCP/CLI de solo lectura completada sin Secrets.
Contexto `rh-ee-mpolo-dev/api-rm1-0a51-p1-openshiftapps-com:6443/rh-ee-mpolo`, proyecto
activo `rh-ee-mpolo-dev`, `gp3` default, quotas/LimitRange y Pipelines confirmados.
Dominio de aplicaciones, registro integrado, GitOps, DB/backup productivos y APIs de
observabilidad permanecen `PENDING_VALIDATION` por RBAC/capacidad externa.

**Build, Registry & Image Identity**: tres builds secuenciales con máximo inicial
`750m CPU/2Gi` cada uno; bases fijadas por digest; SBOM CycloneDX y scan por digest;
publicación única; evidencia `frontend`, `ingestion`, `scoring` por `sha256`; overlays
promovidos sin tags mutables. Registro interno es default tipado para dev, pendiente de
preflight de push.

**GitOps & Promotion**: PR de aplicación valida; merge construye/publica y abre PR al
estado deseado. Dev puede autoaprobarse después de gates; producción requiere aprobación
organizacional. Argo CD/OpenShift GitOps o equivalente reconcilia. En el cluster actual
la ausencia de API bloquea solo reconciliación dinámica, no generación/render.

**Secret Delivery**: External Secrets solo si discovery confirma API aprobada. Default
actual: contratos de Secret separados por consumidor y aprovisionados por identidad de
bootstrap/canal seguro; no hay valores en Git ni pipeline. Keys en
`contracts/secret-references.md`.

**Configuration & Secrets**: ConfigMaps por componente y patches tipados por ambiente;
Secret volumes proyectados con keys mínimas y `0400`; CA/hostname para DB externa;
keyring PII versionado por referencia; ninguna variable sensible en argumentos.

**Authorization**: frontend/ingestion/scoring/jobs no usan API Kubernetes y deshabilitan
automount de token. Identidades separadas para discovery de solo lectura,
build/publicación, bot de PR GitOps y reconciliador namespaced. Aplicación conserva
roles OIDC de analista/supervisor definidos en feature 001.

**Observability & Traceability**: JSON estructurado con correlación y redacción; métricas
de HTTP, scoring, DB, migración, jobs, backup/restore y última ejecución; alertas por
flujo crítico. Commit, PipelineRun, digests, config/GitOps revision, ambiente y evidencia
se registran con el contrato deployment-evidence v1.

**Performance Goals**: mantener scoring p95 <500 ms y timeout máximo 750 ms del producto;
rollout/migración dentro de 5 minutos como default ajustable; RPO 24 h y RTO 4 h como
defaults operativos no contractuales.

**Constraints**: no Secrets consultados por MCP; no operadores instalados sin aprobación;
no creación de namespace permitida; proyecto dev compartido; no `latest`; no rebuild
por ambiente; no migración concurrente; no Route interna; no PVC para código/logs/cache
recreable; production no se acepta sin restore y GitOps demostrados.

**Scale/Scope**: 2 réplicas por servicio stateless; una DB dev no HA; requests base
aprox. 600m CPU/896Mi y limits 3.5 CPU/2.75Gi. El peor solape de jobs agrega
125m/192Mi requests. Cabe en quotas observadas; builds son secuenciales para conservar
margen bajo quota de build 3 CPU/14Gi.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Application-derived topology**: siete ejecutables y el IdP externo están
      evidenciados y mapeados; no se agregan caches, colas, workers ni Routes sin uso.
- [x] **Autonomous decisions**: ledger registra evidencia, defaults y discovery; los
      valores externos se parametrizan sin bloquear el diseño estático.
- [x] **Declarative delivery**: build único, digests, PR GitOps, promoción, reporte y
      rollback están definidos; el script imperativo actual queda solo para demo.
- [x] **OpenShift-native security**: UID arbitrario, non-root, root FS, capabilities,
      ServiceAccounts, Secret mounts mínimos, scans y red mínima están diseñados.
- [x] **Data lifecycle by need**: PostgreSQL, migraciones, roles, backups, restore,
      retención, compatibilidad y límites por ambiente están definidos.
- [x] **Verifiable operations**: recursos, probes reales, rollout, terminación, logs,
      métricas, alertas y matriz ejecutable cubren reconciliación y rollback.
- [x] **Real capability adaptation**: cluster, Pipelines, storage y quotas están
      descubiertos; GitOps/External Secrets/observabilidad son prerrequisitos tipados.
- [x] **Operational documentation**: generación distingue `DECLARED`, `OBSERVED` y
      `PENDING_VALIDATION` y excluye material sensible.

**Pre-Research Gate Result**: PASS. No existe contradicción constitucional ni
clarificación técnica crítica. Las entradas externas bloquean solo bootstrap/promoción
del ambiente correspondiente.

**Post-Design Re-check**: PASS. `research.md`, `data-model.md`, contratos, quickstart,
estructura, matrices y secuencia resuelven los ocho principios. La ausencia actual de
GitOps se registra como capacidad externa pendiente, no como estado confirmado.

## Required Design Artifacts

### Technical Research

**Artifact**: `specs/002-openshift-runtime-requirements/research.md`

Contiene doce decisiones con alternativas, consecuencias y evidencia, más el resultado
de discovery del cluster. No quedan `NEEDS CLARIFICATION`.

### Application Topology and Resource Mapping

```text
Browser
  │ HTTPS/OIDC
  ▼
Route TLS ──► frontend:8080
                │ HTTP /api (interno)
                ▼
             ingestion:8080 ──HTTP+token──► scoring:8080
                │                              (stateless)
                │ PostgreSQL/TLS
                ▼
         PostgreSQL durable ◄── migrations Job
                ▲              ◄── retention CronJob
                └──────────────◄── reconciler CronJob

ingestion ──HTTPS──► IdP/JWKS corporativo
CI ──push digest──► registry ──PR──► GitOps repo ──reconcile──► OpenShift
```

| Componente | Evidencia / comando | Puerto y protocolo | Dependencias y configuración | Secret refs | Estado / escalado / exposición | Probes / terminación | Recursos elegidos |
|------------|---------------------|---------------------|-------------------------------|-------------|-------------------------------|----------------------|-------------------|
| frontend | `frontend/Dockerfile`; `/opt/app-root/bin/container-entrypoint.sh` | 8080 HTTP; TLS en entrada | API base, auth mode, OIDC issuer/client/scope; ingestion e IdP | Ninguno | Stateless, 2 réplicas, única entrada externa | live `/health/live`; ready comprueba Nginx+runtime config; 30s graceful | Deployment, SA, Service, Route, PDB; no PVC |
| ingestion | `services/ingestion/Dockerfile`; `node dist/server.js` | 8080 HTTP interno | DB, scoring, OIDC/JWKS, criteria, timeout, log | `ingestion-runtime`, `database-tls`, `pii-keyring` | Stateless pod, durable vía DB, 2 réplicas, interno | live proceso; ready DB/config; SIGTERM cierra HTTP/pool, 30s | Deployment, SA, Service, PDB; no Route/PVC |
| scoring | `services/scoring/Dockerfile`; `uvicorn ... --port 8080` | 8080 HTTP interno | criteria version, app env, log | `scoring-runtime` | Stateless/determinista, 2 réplicas, interno | live proceso; ready carga criterios/token; 30s | Deployment, SA, Service, PDB; no Route/PVC |
| migrations | `node dist/jobs/migrate.js` | PostgreSQL 5432/TLS | DB host/name/user/SSL/CA; migraciones embebidas | `database-migrator`, `database-tls` | Finito por release, una ejecución, sin exposición | Sin probes; deadline 5m, backoff 3, TTL; advisory lock | Job versionado + SA; sync gate antes de rollout |
| retention | `node dist/cli.js retention --execute` | PostgreSQL 5432/TLS | DB, batch 500, schedule 02:15 UTC | `database-retention`, `database-tls` | Finito diario, `Forbid`, sin exposición | Sin probes; deadline/TTL; métrica último éxito/backlog | CronJob + SA |
| reconciler | `node dist/jobs/reconciler.js` | PostgreSQL 5432/TLS | DB, umbral de intento incompleto | `database-runtime`, `database-tls` | Finito cada minuto, `Forbid`, sin exposición | Sin probes; deadline/TTL; métrica recuperación | CronJob + SA |
| postgres-dev | imagen RHEL PostgreSQL 16 fijada por digest | 5432 PostgreSQL interno | 5Gi `gp3`, DB/usuarios | Secret refs DB separados | Stateful, 1 réplica no HA, solo dev | `pg_isready`; 60s; data/tmp escribibles | StatefulSet, SA, headless Service, PVC; no Route |
| DB producción | contrato de datos + overlay production | PostgreSQL/TLS externo | servicio administrado/corporativo, CA/hostname, backup/PITR | refs del proveedor/DB TLS | Externo, HA/escala según SLA confirmado | señal/procedimiento del proveedor + prueba app | Ningún workload/PVC local; Service alias solo si DNS lo exige |
| IdP/JWKS | config/frontend + JWT verifier | HTTPS 443 externo | issuer, JWKS, audience, client | Referencias corporativas si aplican | Externo; sin recurso local | login/JWT smoke y alerta de dependencia | Config/egress únicamente |

No aplican StatefulSet para servicios stateless, PVC fuera de PostgreSQL dev, Route para
ingestion/scoring/DB/jobs, ni Service para procesos finitos.

### Decision and Discovery Ledger

| Decisión / capacidad | Clasificación | Evidencia o fuente no sensible | Default / alternativa | Validación pendiente |
|----------------------|---------------|--------------------------------|-----------------------|----------------------|
| Fronteras de 3 servicios | INFERRED | Dockerfiles, contratos, Compose | Conservar microservicios | contract/smoke |
| Migración y jobs | INFERRED | código/jobs y migraciones | Job + 2 CronJobs | orden/idempotencia |
| Réplicas stateless=2 | DEFAULTED | manifiestos y quota observada | Ajustar tras métricas | rollout/carga |
| Proyecto dev | DISCOVERED | MCP + usuario | `rh-ee-mpolo-dev` | preflight labels/ownership |
| OpenShift 4.21.21 | DISCOVERED | MCP ClusterVersion | APIs estables | validar producción |
| Pipelines 1.23.1 | DISCOVERED | Project labels/API | Tekton CI | confirmar PaC webhook |
| GitOps | DISCOVERED | API `argoproj.io` ausente | OpenShift GitOps/equivalente | EXTERNAL_REQUIRED |
| External Secrets | DISCOVERED | API ausente | refs Secret + canal seguro | reevaluar bootstrap |
| Storage dev | DISCOVERED | MCP StorageClass | `gp3`, 5Gi | bind/restore |
| Registro dev | DEFAULTED | convención OpenShift | integrado namespaced | permiso push/hostname |
| Dominio de apps | EXTERNAL_REQUIRED | Ingress read denegado/no Routes | asignación de Route | bootstrap/DNS/TLS |
| OIDC | EXTERNAL_REQUIRED | placeholders existentes | servicio corporativo | issuer/JWKS/client |
| Secret runtime | SECRET_REFERENCE | `contracts/secret-references.md` | nombres lógicos | canal seguro |
| DB producción | EXTERNAL_REQUIRED | overlay placeholder | administrada/corporativa | SLA/TLS/backup/CIDR |
| RPO 24h/RTO 4h | DEFAULTED | criticidad MVP, sin SLO | política más estricta prevalece | aprobación producción |
| Staging | DEFAULTED | no destino autorizado ni requisito separado | omitir; dev→production controlado | agregar si política exige |

### Visual System

Esta feature no cambia UI. Se conserva
`specs/001-alternative-credit-scoring/design-system.md`: contenedor centrado, gutters
16/24/32 px, tipografía y line-height definidos, WCAG AA y estados completos. El smoke
no agrega controles operativos a la aplicación. Regresión visual: 360×800, 768×1024,
1440×900 y overflow a 320 px mediante Playwright.

### Data Model

**Artifact**: `specs/002-openshift-runtime-requirements/data-model.md`

No cambia el esquema de negocio. Define `PlatformProfile`, `PlatformInput`,
`Capability`, `ReleaseRecord`, `EnvironmentRevision`, `OperationalEvidence`,
`EvidenceSource` y `DataRecoveryPolicy`, además de contratos por identidad DB,
backup/restore, keyring PII y compatibilidad N/N-1.

### Contracts

**Artifact directory**: `specs/002-openshift-runtime-requirements/contracts/`

| Contrato | Productor | Consumidor | Política |
|----------|-----------|------------|----------|
| `platform-profile.schema.json` | discovery/bootstrap | render, CI, docs | v1 aditivo; secretos prohibidos |
| `deployment-evidence.schema.json` | CI/verify | GitOps, rollback, docs | digests/commit obligatorios |
| `secret-references.md` | plataforma | workloads/jobs/CI | nombres estables, mounts mínimos |
| OpenAPI público v1 existente | ingestion | frontend | sin cambio; contract tests |
| OpenAPI interno v1 existente | scoring | ingestion | sin cambio; 750ms, token ref |
| data model feature 001 | DB/migrator | ingestion/jobs | expand/contract y checksum |

### Quickstart

**Artifact**: `specs/002-openshift-runtime-requirements/quickstart.md`

Guía reproducible para validación local, discovery seguro, render/policy, bootstrap,
pipeline, GitOps, smoke, persistencia, backup/restore, rollback y documentación. Distingue
comandos existentes de los que debe crear la implementación y no contiene secretos.

### Declarative Delivery Design

#### Estructura exacta a generar

```text
deploy/
├── openshift/
│   ├── base/
│   │   ├── frontend/{deployment,service,route,pdb,serviceaccount}.yaml
│   │   ├── ingestion/{deployment,service,pdb,serviceaccount}.yaml
│   │   ├── scoring/{deployment,service,pdb,serviceaccount}.yaml
│   │   ├── jobs/{migrations-job,retention-cronjob,reconciler-cronjob,serviceaccounts}.yaml
│   │   ├── config/{frontend,ingestion,scoring}-configmap.yaml
│   │   ├── network/{default-deny,dns,frontend,ingestion,scoring,jobs}.yaml
│   │   └── kustomization.yaml
│   ├── components/
│   │   ├── postgres-dev/{statefulset,service,pvc,backup,restore-test}.yaml
│   │   └── external-postgres/{service,network-policy-patch}.yaml
│   └── overlays/
│       ├── dev/{kustomization,platform-profile,patches}/
│       └── production/{kustomization,platform-profile,patches}/
├── gitops/
│   ├── bootstrap/{README,rbac,repository-contract}.yaml
│   ├── applications/{dev,production}.yaml
│   └── kustomization.yaml
└── policies/
    ├── kubernetes.rego
    ├── images.rego
    ├── network.rego
    └── secrets.rego

.tekton/
├── tasks/{inspect,test,secure,build-image,render,publish,propose-gitops,verify,report}.yaml
├── pipeline.yaml
├── pull-request.yaml
└── push.yaml

scripts/platform/
├── discover
├── bootstrap
├── render
├── validate
├── verify
├── smoke
├── verify-persistence
├── verify-backup-restore
├── rollback
├── generate-operations-doc
└── validate-operations-doc

docs/operations/
└── openshift-deployment.md

tests/platform/
├── profiles/
├── render/
├── policy/
├── network/
├── gitops/
└── documentation/
```

No se crea overlay staging hasta que exista un ambiente/regla de validación independiente.
Agregarlo no puede reconstruir imágenes; solo promueve digests/configuración.

#### Bootstrap

1. Ejecutar discovery allowlisted: versión/APIs/quota/LimitRange/StorageClasses/ingress,
   registro y permisos; excluir Secrets y kubeconfig.
2. Seleccionar `rh-ee-mpolo-dev`, inventariar recursos existentes y limitar ownership a
   labels `app.kubernetes.io/part-of=alternative-credit-scoring`.
3. Validar permisos de identidades `platform-reader`, `pipeline-build`, bot GitOps y
   reconciliador con `oc auth can-i`; no usar token personal continuo.
4. Crear ServiceAccounts y RBAC namespaced mínimos; workloads sin token montado.
5. Registrar referencias de runtime, DB, OIDC, registry, GitOps y backup por canal
   seguro. No renderizar Secret values.
6. Confirmar Pipelines as Code; registrar GitHub App/robot revocable si existe. Si no,
   usar trigger CI aprobado con las mismas gates.
7. Un administrador habilita OpenShift GitOps/equivalente y autoriza repo/Application.
   La automatización no instala operadores ni privilegios cluster-wide.
8. Sincronizar estado inicial y generar reporte. Bootstrap termina; operación continua
   no repite estos pasos.

#### CI, publicación y promoción

```text
PR: inspect -> test -> secure -> render/policy
merge: build(frontend -> ingestion -> scoring, secuencial)
    -> publish una vez + digests + SBOM + scans
    -> PR GitOps (digests/config)
    -> aprobación según ambiente
    -> reconcile
    -> migrations gate
    -> rollout
    -> network + persistence + smoke
    -> report + operations doc
```

- `inspect`: compara inventario, contratos, Dockerfiles, config y recursos.
- `test`: ejecuta `make validate`; tests no usan datos reales.
- `secure`: secret/dependency scan, SBOM y scan de imágenes por digest; HIGH/CRITICAL
  bloquean según política aprobada.
- `build`: Buildah u otro builder compatible con SCC; builds secuenciales bajo quota;
  no reconstruir en publish.
- `render`: dev/production, schemas OpenShift 4.21, Rego, Secret refs y digests.
- `publish`: copia/promueve el mismo digest y guarda evidence contract.
- `promote`: bot abre PR; nunca empuja a rama protegida ni aplica directo.
- `reconcile`: controlador GitOps; migración es gate/sync wave antes de Deployments.
- `verify`: rollout, conectividad, TLS/Route, datos, smoke y estado GitOps.
- `report`: commit, digests, ambiente, revision GitOps, PipelineRun, checks y rollback ref.

#### Rollback

Rollback ordinario revierte mediante PR GitOps a `ReleaseRecord` saludable, conserva
digests y configuración, reconcilia y repite verify/smoke. El schema usa expand/contract
para admitir N-1. Un cambio destructivo no permite rollback automático; requiere backup
verificado y procedimiento de recuperación aprobado. Restaurar DB es recuperación de
datos, no rollback ordinario.

### Configuration and Secret Reference Matrix

| Componente | Config común | Dev | Producción | Referencias sensibles |
|------------|--------------|-----|------------|------------------------|
| frontend | API base, auth mode, OIDC issuer/client/scope | namespace `rh-ee-mpolo-dev`; host Route observado tras sync | host/dominio y OIDC corporativo | ninguna en pod; navegador no recibe secretos |
| ingestion | port, DB name/user/SSL, scoring URL/timeout/version, OIDC/JWKS/audience, log | DB `postgres`, SSL disable solo dev | DB externa, `verify-full`, CA/hostname, egress acotado | `ingestion-runtime`, `database-tls`, `pii-keyring` |
| scoring | app env, criteria version, log | production-like config | misma config/digest | `scoring-runtime` |
| migrations | DB host/name/user/SSL, migration release/checksum | postgres-dev, schema-owner dev | DB administrada y rol provisionado | `database-migrator`, `database-tls` |
| retention | DB config, batch 500, schedule | diario 02:15 UTC | igual salvo política aprobada | `database-retention`, `database-tls` |
| reconciler | DB config, stale threshold, schedule | cada minuto | igual, ajustable por métricas | `database-runtime`, `database-tls` |
| postgres-dev | DB name, capacity 5Gi, `gp3` | presente, no HA | ausente | credenciales dev por refs separadas |
| backup/restore | RPO 24h, RTO 4h, retention | target externo pendiente; no aceptar DR hasta validar | proveedor/target cifrado obligatorio | `backup-target`, `pii-keyring` refs |
| pipeline | repo, environments, policy thresholds | registry integrado default pendiente preflight | registry aprobado | `registry-push`, `gitops-repository` |

Los nombres reales de namespace/host/registry/DB se almacenan en perfiles; no se
hardcodean en base. Todo placeholder debe estar tipado y fallar antes de promoción si
sigue pendiente para el ambiente.

### Identities and Minimum Permissions

| Identidad | Alcance | Permisos mínimos | Prohibiciones |
|-----------|---------|------------------|---------------|
| `platform-reader` | namespaces autorizados + APIs cluster allowlisted | get/list version, APIs, quota, limits, SC, routes y workloads | Secrets, exec, logs con PII, write |
| `pipeline-build` | namespace CI/registry de app | crear/leer PipelineRuns/Pods de build, push repos de imágenes de app, evidencia | workloads prod, Secrets runtime, cluster-admin |
| `gitops-proposer` | repo estado deseado | crear branch/PR y leer checks | merge directo protegido, cluster API |
| `gitops-reconciler` | recursos etiquetados en namespaces autorizados | CRUD kinds declarados, estado/health | Secrets values, otros namespaces/apps, escritura fuera de GitOps |
| workload SAs | pod propio | ninguno sobre API Kubernetes | token automontado/RBAC |
| DB migrator | schema objetivo | DDL acotado/advisory lock/grants permitidos | superusuario runtime, otras DB |
| DB runtime | tablas/repositorios app | DML definido | DDL/roles/retención privilegiada |
| DB retention | funciones de disposición | lotes/locks/audit seguro | DDL y lectura no necesaria |

### Security and Network Design

- Pod-level: `runAsNonRoot`, UID no fijado, `RuntimeDefault`, drop ALL, no privilege
  escalation. Root FS read-only salvo PostgreSQL data/tmp explícitos.
- `automountServiceAccountToken: false` para todos los workloads sin API; projected
  Secrets por key con modo `0400`.
- Default-deny ingress/egress. DNS al namespace de DNS del cluster.
- Route router→frontend:8080; frontend→ingestion:8080;
  ingestion→scoring:8080, DB:5432 y JWKS:443; jobs→DB:5432.
- Scoring no tiene egress de negocio. Frontend no llega a scoring/DB. Ningún servicio
  interno tiene Route, LoadBalancer o NodePort.
- Egress IdP/DB se genera desde hostname/CIDR/proxy confirmado; `0.0.0.0/0` queda
  prohibido en producción. Si NetworkPolicy no expresa FQDN, usar egress gateway/proxy
  aprobado o CIDR versionado.
- Route usa TLS y redirect. DB production usa `verify-full`, CA ref y nombre verificable.
- Pipeline escanea repo, render, resultados y logs. No imprime env ni ejecuta shell trace
  en pasos con credenciales.

### Data Service, Migration, Backup and Restore

1. **Dev**: PostgreSQL 16 de una réplica, 5Gi `gp3`, Service interno. Es una capacidad
   de validación, no HA productiva.
2. **Production selection**: corporativo requerido → administrado aprobado → operador
   soportado observado → autogestionado excepcional. Registrar SLA, límites y fuente.
3. **Migration**: bootstrap provisiona roles; Job release-scoped usa schema-owner,
   advisory lock, checksum, deadline, logs seguros y expand/contract.
4. **Backup**: cifrado, fuera del PVC/namespace de datos, política coherente con
   retención y evidencia por ejecución. Servicio administrado puede proporcionar PITR.
5. **Restore**: periódico a destino aislado; verifica esquema, integridad allowlisted,
   autorización, keyring y smoke antes de marcar PASS.
6. **Upgrade**: versión de DB soportada, prueba desde snapshot previo y ventana
   controlada. No upgrade mayor automático por el pipeline de aplicación.
7. **Failure**: DB no disponible quita readiness de ingestion y bloquea jobs/escrituras;
   no confirma operaciones. Scoring caído degrada evaluación pero permite histórico.

### Observability and Operational Documentation

#### Señales y alertas

| Capacidad | Métricas/señales | Alertas mínimas |
|-----------|------------------|-----------------|
| frontend | disponibilidad, 4xx/5xx, latencia proxy, runtime config | Route/smoke no disponible, 5xx sostenido |
| ingestion | requests/latencia/errores, pool DB, fallos scoring, breaker | readiness DB, error rate, scoring timeout, pool saturado |
| scoring | requests/latencia por versión, manual/error | p95 >500ms, resultado inválido, ready false |
| migrations | versión/checksum/duración/resultado | Job failed/timeout/checksum mismatch |
| retention | último éxito, duración, filas/backlog | job failed o atrasado, backlog creciente |
| reconciler | último éxito, recuperadas/fallidas | job atrasado, intentos stale no disminuyen |
| PostgreSQL | disponibilidad, conexiones, storage, backup/restore | storage/connection pressure, backup/restore vencido |
| GitOps | sync/health/revision | OutOfSync/Degraded prolongado |

La aplicación debe exponer métricas en formato compatible. `ServiceMonitor` y
`PrometheusRule` solo se generan si discovery confirma APIs/stack aprobada; la
alternativa es scrape/alert contract del servicio corporativo.

#### Documento obligatorio

`docs/operations/openshift-deployment.md` se genera desde render/perfiles y se enriquece
con discovery. Debe incluir:

- resumen y diagrama; cluster/context/version/app domain y capacidades;
- ambiente, namespace, GitOps revision, sync y health;
- Deployment/StatefulSet/Job/CronJob, digest, réplicas/pods esperados, SA, Service/PVC;
- Routes/hosts/URLs públicas, internas o pendientes;
- DB/operadores/servicios externos; PVC/storage class y backup/restore;
- ConfigMaps y nombres/keys de Secret refs, nunca values;
- NetworkPolicies, puertos y flujos autorizados;
- pipelines, repo GitOps, Applications/equivalente y promoción;
- procedimientos seguros para pods, logs, eventos, rollout, sync, smoke y rollback;
- dashboards/métricas/alertas; fecha, commit, GitOps revision, digests y último verify.

Cada fila/campo marca `DECLARED`, `OBSERVED` o `PENDING_VALIDATION`, fuente y timestamp.
Pods efímeros observados son evidencia fechada, no identificadores permanentes. La
pipeline falla si el documento está desactualizado, contiene secretos o afirma estado
sin fuente.

### Validation Strategy

| Requisito / riesgo | Nivel | Comando o herramienta | Resultado esperado / evidencia |
|--------------------|-------|-----------------------|-------------------------------|
| FR-001..003 inventario/mapeo | inspect | `scripts/platform/validate --architecture` | cada ejecutable tiene evidencia/recurso; nada vacío |
| contratos funcionales | contract | `make contracts` | OpenAPI público/interno compatible |
| reglas/scoring regresión | unit/integration | `make validate` | low/medium/high/incomplete/invalid/failure deterministas |
| build reproducible | image | pipeline build secuencial + `skopeo inspect` | 3 digests, una construcción por commit |
| SBOM/vulnerabilidades | security | Syft + Trivy por digest | CycloneDX; gate de severidad aprobado |
| secretos | security | scanner repo/render/evidence/logs | cero valores/credenciales/kubeconfig |
| render dev/prod | manifest | `scripts/platform/render --all` | overlays completos y diferenciados |
| APIs/schemas | manifest | kubeconform/schema OCP + `oc apply --dry-run=server` | APIs soportadas; CR opcional solo si disponible |
| políticas pod/RBAC | policy/runtime | Conftest + UID arbitrario + `oc auth can-i` | restricted, RO viable, token off, mínimo privilegio |
| digests | policy | Rego images | no `latest`, no tags en promovidos, mismos digests |
| migración | DB/Job | DB vacía, N-1, concurrencia, checksum, Job | completa antes de rollout; falla bloquea |
| rollout/probes | runtime | GitOps health + `oc rollout status` | 2/2 stateless ready; probes reales |
| red positiva | network | pods efímeros allowlisted | frontend→ingestion→scoring/DB y jobs→DB PASS |
| red negativa | network | intentos controlados | frontend↛scoring/DB; scoring↛egress; externo↛internos |
| Route/TLS/DNS | runtime | HTTPS/redirect/cert checks | frontend público únicamente, cert válido |
| smoke principal | E2E | `scripts/platform/smoke` | create/evaluate 634/detail/history con fixture sintético |
| dependencia scoring | integration | fallo/recovery controlado | error recuperable, histórico disponible, sin parcial |
| persistencia | runtime | recreate pods + query | dato confirmado íntegro después de recreación |
| backup/restore | recovery | `verify-backup-restore` | restore aislado + integrity/auth/smoke PASS |
| promoción | supply chain | compare evidence manifests | mismo digest dev→production |
| GitOps | CD | sync/health/revision | `Synced/Healthy`; cambios manuales reconciliados |
| rollback | recovery | PR revert + sync + smoke | release saludable sin rebuild; schema compatible |
| documentación | docs/policy | generator + schema/secret scan | estado/fuentes completos, sin secretos |
| UI sin regresión | visual/a11y | Playwright 360/768/1440 + 320 overflow | estados, WCAG AA, layout íntegro |

La definición de terminado exige un cambio representativo que complete todo el recorrido.
Sin GitOps/cluster productivo, las verificaciones dinámicas afectadas quedan
`PENDING_VALIDATION`; no pueden marcarse PASS por haber renderizado YAML.

## Project Structure

### Documentation (this feature)

```text
specs/002-openshift-runtime-requirements/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── README.md
│   ├── platform-profile.schema.json
│   ├── deployment-evidence.schema.json
│   └── secret-references.md
├── checklists/requirements.md
└── tasks.md                         # generado por /speckit-tasks
```

### Source Code (repository root)

```text
frontend/                            # SPA/Nginx + tests
services/
├── ingestion/                       # API, migrator, retention, reconciler
└── scoring/                         # motor interno
db/migrations/                       # esquema versionado
deploy/
├── local/                           # paridad local
├── openshift/                       # base/components/overlays
├── gitops/                          # bootstrap y Applications/equivalente
└── policies/                        # Rego
.tekton/                             # Tasks, Pipeline y PaC
scripts/platform/                    # discover/render/validate/smoke/rollback/docs
tests/platform/                      # manifest/policy/network/GitOps/docs
docs/operations/                     # entrega generada
```

**Structure Decision**: extender las convenciones existentes `deploy/openshift/` y
`scripts/`; separar componentes opcionales de base y añadir delivery/docs sin mover el
código de aplicación. Los artefactos de feature deben dejar de estar ignorados o
publicarse en el origen canónico versionado antes de aceptar la implementación.

## Implementation Sequence for tasks.md

1. Versionar feature 002 y añadir validación de sus JSON Schemas.
2. Crear perfiles tipados dev/production y script discovery allowlisted; fixtures con
   hechos observados y pendientes.
3. Reestructurar Kustomize base/components sin cambiar conducta; añadir labels de
   ownership, SAs separadas, token off, PDB, grace/deadline/TTL y mounts mínimos.
4. Corregir imágenes/promoción por digest y separar build de publish; guardar evidence.
5. Endurecer NetworkPolicies/TLS con inputs tipados y pruebas positivas/negativas.
6. Separar provisión DB de migraciones; implementar advisory lock/checksum y pruebas
   vacía/N-1/concurrente/rollback.
7. Implementar backup/restore dev y contrato productivo; keyring PII/rotación; pruebas
   aisladas y coherencia con retención.
8. Crear scripts `discover`, `render`, `validate`, `verify`, `smoke`, persistence,
   backup/restore y rollback; eliminar apply imperativo de operación ordinaria.
9. Crear políticas Rego y ampliar tests para APIs, UID, RBAC, Secret mounts, digests,
   aislamiento y docs.
10. Crear Tekton Tasks/Pipeline/PaC con builds secuenciales, artifacts y gates; validar
    con quota observada.
11. Crear repo-layout GitOps, Applications/equivalente y flujo PR/promotion; no aplicar
    CR hasta discovery positivo.
12. Añadir métricas/alert contracts y recursos opcionales según APIs confirmadas.
13. Generar/validar `docs/operations/openshift-deployment.md` desde render+observation.
14. Ejecutar bootstrap autorizado en `rh-ee-mpolo-dev` sin tocar recursos ajenos.
15. Demostrar pipeline completo dev; cuando GitOps esté habilitado, reconciliation,
    migration, rollout, network, smoke, persistence, restore y rollback.
16. Completar entradas de producción, promover los mismos digests y publicar evidencia.

Cada tarea debe nombrar archivo, requisito/contract gate, dependencia y evidencia. El
trabajo estático no espera entradas externas; solo las tareas dinámicas afectadas quedan
bloqueadas.

## Risks and Capability-Dependent Alternatives

| Riesgo | Impacto | Mitigación/default | Alternativa |
|--------|---------|--------------------|-------------|
| GitOps API ausente | no reconcile/rollback dinámico | generar/validar artefactos; requerir bootstrap admin | equivalente GitOps aprobado |
| PaC no confirmado | triggers PR no automáticos | confirmar controller/webhook | CI aprobado con mismas gates |
| External Secrets ausente | rotación externa al repo | contratos y canal seguro, mounts mínimos | mecanismo aprobado descubierto |
| Registro no confirmado por RBAC | push puede fallar | preflight interno namespaced | registry corporativo externo |
| Namespace compartido | colisión/impacto ajeno | labels/prefix, inventory y RBAC scoped | namespace dedicado autorizado |
| DB dev no HA | pérdida ante fallo | solo dev; backup externo/restore | DB administrada/operator |
| Backup target pendiente | no DR demostrable | artifacts y contrato; producción bloqueada | servicio corporativo/PITR |
| Egress FQDN no expresable | red abierta o bloqueada | CIDR/proxy/gateway tipado | política CNI aprobada |
| Métricas CRD desconocida | alertas no reconciliables | instrumentation/contract primero | monitoreo corporativo |
| Schema destructivo | rollback imposible | expand/contract en dos releases | restore aprobado con downtime |
| `.specify/` y `specs/` ignorados | artefactos no versionados | cambiar política/origen canónico | publicar en repo GitOps/docs rastreado |

## Complexity Tracking

| Deviation | Why Needed | Risk & Mitigation | Owner | Resolution Date |
|-----------|------------|-------------------|-------|-----------------|
| PostgreSQL autogestionado single-instance en dev | no se confirmó operador/servicio y se requiere integración durable | No HA; limitar a dev, `gp3` 5Gi, backup/restore externo antes de aceptar durabilidad | Equipo de plataforma | Antes de promover a producción |
| Contratos GitOps generados sin API en cluster | la constitución exige estado declarativo pero no autoriza instalar operador | Validar estáticamente y marcar dinámico pendiente; administrador habilita GitOps/equivalente | Responsable de plataforma | Antes del primer deployment ordinario |

## PLATFORM_INPUT_REQUIRED

El plan y los artefactos estáticos pueden completarse. Para bootstrap y promoción
dinámica faltan únicamente entradas controladas por la organización:

| Dato indispensable | Por qué no puede inferirse/descubrirse | Responsable | Referencia/canal seguro esperado |
|--------------------|--------------------------------------|-------------|----------------------------------|
| Controlador GitOps aprobado y repositorio/branch protegido de estado deseado | API GitOps ausente; instalar/autorizar excede permisos | Administrador de plataforma | URL no credencial + identidad robot/GitHub App por gestor seguro |
| Referencias OIDC autorizadas: issuer, JWKS, client ID/audience y dominio | placeholders del repo; la organización controla identidad/DNS | Identidad/plataforma | valores no secretos en perfil; cualquier credencial por canal seguro |
| Perfil producción: namespace, dominio/TLS, registry, DB administrada, CA/hostname/CIDR, backup target, RPO/RTO/aprobación | no existe destino productivo autorizado ni permisos para descubrirlo | Plataforma/datos/riesgo | perfil no sensible + nombres de Secret refs; nunca valores |

No se solicitan tokens, contraseñas, kubeconfigs, llaves ni contenido de Secrets. Hasta
recibir estas referencias, dev estático continúa y las verificaciones dinámicas
correspondientes permanecen `PENDING_VALIDATION`.
