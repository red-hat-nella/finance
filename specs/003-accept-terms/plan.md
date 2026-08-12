# Implementation Plan: Aceptación obligatoria de términos y condiciones

**Branch**: `main` | **Date**: 2026-08-12 | **Spec**: [spec.md](./spec.md)

**Input**: microservicio independiente con interfaz gráfica propia, integrado como gate
obligatorio y consistente con la UI/UX existente.

## Summary

Crear el bounded context autónomo `terms` con dos workloads: `terms-web`, SPA Angular
propia, y `terms-api`, servicio Node/TypeScript dueño del dominio y persistencia. Ambos
se publican bajo el mismo host mediante `/terms/**` y `/terms-api/**`, pero tienen código,
imágenes, configuración, salud y despliegue separados del frontend e ingestion. La UI
consume en build un foundation package versionado extraído de los tokens existentes.
`ingestion` aplica una verificación interna fail-closed antes de toda operación crediticia.

## Technical Context

**Language/Version**: TypeScript 5.9/Angular 20 para `terms-web`; Node.js 22 y TypeScript
5.5+ para `terms-api`; SQL PostgreSQL 16; YAML Kubernetes/OpenShift/Tekton/Kustomize.

**Primary Dependencies**: Angular 20, Angular Material 20, Roboto local, RxJS, OIDC
client; Express 5, `pg`, `jose`, `zod`/JSON Schema, Pino, OpenAPI 3.1.

**Storage**: PostgreSQL, esquema/base lógica y roles exclusivos de terms. Dev comparte
hosting PostgreSQL; producción requiere base lógica administrada aprobada.

**Testing**: ESLint/typecheck; Vitest; Node test/OpenAPI lint y contract tests; PostgreSQL
integration; Playwright visual/E2E; Axe WCAG 2.2 AA; Kustomize/schema/Rego; network,
smoke, migration, retention, backup/restore y rollback.

**Target Platform**: navegador moderno desde 320 px; contenedores Linux local; Red Hat
OpenShift 4.21.21 observado para dev.

**Project Type**: aplicación web de microservicios containerizados con SPA autónoma.

**Deployment Model**: local Compose incorpora `terms-web`, `terms-api`, `terms-migrations`
y perfil `terms-retention`. OpenShift usa dos Deployments/Services/PDB/SA, Job y CronJob;
PostgreSQL dev existente o DB externa en producción. Una única Route apunta al gateway.

**Target OpenShift / Kubernetes APIs**: apps/v1, batch/v1, networking.k8s.io/v1,
policy/v1 y route.openshift.io/v1; Tekton v1. Dev observado 4.21.21; producción configurable.

**Cluster Discovery Status**: perfil dev no sensible observado en
`build/platform/dev-profile.json`; no se leyeron Secrets. OpenShift/Pipelines/storage
confirmados; GitOps y destino productivo pendientes.

**Build, Registry & Image Identity**: CI construye una vez `terms-web` y `terms-api`,
genera SBOM, escanea dependencias/imágenes, publica y promueve solo digests.

**GitOps & Promotion**: Kustomize base+overlays, migración en wave -1, terms wave 0 y
consumidores wave 1. PR protegida actualiza digests; reconciliación, smoke y rollback
son gates. GitOps no está disponible en dev observado: validación dinámica queda pendiente.

**Secret Delivery**: referencias separadas `terms-runtime`, `terms-migrator`,
`terms-retention`, `terms-database-tls` y `terms-keyring` si se usa fingerprint. Valores
solo mediante mecanismo runtime aprobado.

**Configuration & Secrets**: ConfigMaps contienen puertos, DB host/name/user/SSL,
issuer/audience/algoritmos, API base/timeout, schedules y límites. Contraseñas, token
interno y material criptográfico son archivos de Secret, no variables textuales.

**Authorization**: JWT deriva actor, ámbito y roles. `terms_admin` administra versiones;
supervisor/auditor consultan su ámbito; cada persona acepta solo por sí misma. Ingestion
usa JWT original + credencial propia y NetworkPolicy. Control-plane admin queda accesible
sin versión vigente; funciones crediticias siempre requieren aceptación.

**Observability & Traceability**: live/ready por workload, estado de versión vigente como
métrica/alerta de negocio, logs JSON redactados, request ID, digest/version, latencias,
errores, migración, retención, backup/restore y rollout. Ready de API exige config+DB+
migraciones, no versión vigente, para evitar deadlock administrativo.

**Performance Goals**: estado visible <2 s para 99 % de inicios saludables; decisión
interna p95 <250 ms y timeout consumidor 500 ms; feedback de interacción <100 ms; UI
estable con CLS <0.1.

**Constraints**: fail-closed; sin cache positivo inicial; una sola entrada pública;
published append-only; cinco años; WCAG 2.2 AA; arbitrary UID/non-root/read-only FS;
sin contenido, tokens o PII innecesaria en logs.

**Scale/Scope**: cinco rutas UI, dos APIs v1, cuatro entidades nuevas, dos Deployments,
un Job y un CronJob. Recursos iniciales prudentes: web 50m/64Mi request y 250m/128Mi
limit; API 100m/128Mi request y 500m/512Mi limit, ajustables por evidencia.

## Constitution Check

*GATE: evaluado antes de investigación y nuevamente después del diseño.*

- [x] **Application-derived topology**: UI y API poseen ciclos independientes; migración,
      retención, DB, IdP y consumidores se mapearon. No se agregan cache, cola, PVC ni Route.
- [x] **Autonomous decisions**: ledger registra evidencia/default; solo entradas externas
      reales quedan como `PLATFORM_INPUT_REQUIRED`.
- [x] **Declarative delivery**: build once, SBOM/scan, digests, GitOps, waves, smoke y
      rollback se incorporan sin despliegue ordinario manual.
- [x] **OpenShift-native security**: UID arbitrario, non-root, read-only FS, capabilities
      drop ALL, SA/RBAC/Secrets/red mínimos y scan están definidos.
- [x] **Data lifecycle by need**: ownership, concurrencia, migración, retención, backup,
      restore, RPO/RTO y producción administrada están definidos.
- [x] **Verifiable operations**: probes veraces, logs/métricas/alertas, policy/render,
      rollout, smoke, restore y rollback tienen evidencia requerida.
- [x] **Real capability adaptation**: se usa el perfil observado más reciente; GitOps,
      producción, DB/backup y monitoreo se mantienen pendientes sin inventarlos.
- [x] **Operational documentation**: pipeline genera inventario desired/confirmed/pending
      sin valores sensibles y lo actualiza con la entrega.

**Pre-Research Gate Result**: PASS. No hay contradicción constitucional ni aclaración
crítica; independencia y UI propia se derivan del input y del código existente.

**Post-Design Re-check**: PASS. Research, modelo, contratos, quickstart, visual system,
delivery, seguridad, datos, observabilidad y validación satisfacen los ocho principios.

## Required Design Artifacts

### Technical Research

**Artifact**: [research.md](./research.md)

Resuelve bounded context/workloads, same-origin, enforcement, contratos/auth, datos,
idempotencia, retención, foundation visual, OpenShift/GitOps y entradas externas. No
quedan decisiones críticas abiertas.

### Application Topology and Resource Mapping

```text
Browser
  │ OIDC + HTTPS, único host
  ▼
Route → frontend gateway
          ├─ /terms/** ─────► terms-web Deployment/Service
          ├─ /terms-api/** ─► terms-api Deployment/Service ─► PostgreSQL terms
          └─ /api/** ───────► ingestion ──decision/JWT+service identity──► terms-api
                                                        └────────────────► scoring/DB existentes

terms-migrations Job ──► PostgreSQL terms ◄── terms-retention CronJob
terms-web / terms-api ──JWKS HTTPS──► IdP externo
```

| Componente | Evidencia/lifecycle | Protocolo/dependencias | Recurso |
|------------|--------------------|-------------------------|---------|
| `terms-web` | UI propia, release/scale stateless | HTTP 8080; API/OIDC runtime config | Deployment 2 réplicas, Service, PDB, SA; sin PVC/Route |
| `terms-api` | API autónoma stateless con datos externos | HTTP 8080; PostgreSQL, JWKS | Deployment 2 réplicas, Service, PDB, SA; sin PVC/Route |
| `terms-migrations` | Finito por release, antes del rollout | PostgreSQL/TLS; lock/checksum | Job, SA y credencial propia, wave -1 |
| `terms-retention` | Diario 02:30 UTC, Forbid | PostgreSQL/TLS; lotes idempotentes | CronJob, SA y credencial propia |
| PostgreSQL dev | Durable existente como hosting | 5432, esquema/roles terms | StatefulSet/PVC existente; backup ampliado |
| PostgreSQL prod | Durable/HA externo | TLS, PITR/backup | Servicio administrado; sin StatefulSet/PVC app |
| IdP/JWKS | Externo | HTTPS | Sin workload app; egress allowlist |

No aplican StatefulSet/PVC para terms, Route adicional, cache, cola, broker, worker o
autoscaler inicial. Dos réplicas y PDB reflejan que el gate es crítico; HPA se agrega
solo con métricas y capacidad confirmada.

### Decision and Discovery Ledger

| Decision / Capability | Status | Evidence or Non-Sensitive Source | Default / Alternative | Validation Needed |
|-----------------------|--------|----------------------------------|-----------------------|-------------------|
| UI/API independientes | Inferred | input; `frontend/`, `services/ingestion/` | dos workloads; consolidación futura | contract + independent rollout |
| Sistema visual | Inferred | `frontend/src/styles/*`, layout | package build-time versionado | token parity + visual |
| Same-origin | Inferred | nginx/Route/policies | prefijos `/terms`, `/terms-api` | proxy/CSP/OIDC |
| PostgreSQL dev | Discovered/existing | compose y manifests | esquema/roles propios | migration/restore |
| OpenShift 4.21.21 | Discovered | `build/platform/dev-profile.json` | APIs estables | server-side dry-run |
| Pipelines | Discovered | perfil dev | extender Tekton v1 | PipelineRun |
| External Secrets | Discovered, opcional | perfil dev más reciente | Secret refs estándar | aprobación organizacional |
| GitOps | Pending | API ausente/bootstrap | reconciliador equivalente | `PLATFORM_INPUT_REQUIRED` |
| DB/backup prod | Pending | overlay placeholder | administrada, RPO 24h/RTO 4h | `PLATFORM_INPUT_REQUIRED` |

### Visual System

La UI es propia de `terms-web`, pero su foundation es idéntico al frontend principal:

- **Tokens**: fondo `#f4f7f6`, surface `#fff`, texto `#17211f`, muted `#46514e`, borde
  `#aebbb7`, primary `#006b5e`, hover `#005248`, soft `#ddefea`, foco `#0b6bcb` y
  tokens success/warning/danger/info existentes. Prohibidos hex ad hoc en componentes.
- **Tipografía**: Roboto local 400/500/700; h1 32/40 (28/36 móvil), h2 24/32, h3
  20/28, body 16/24; columna legal 720–800 px y 60–75 caracteres en desktop.
- **Layout**: shell 100dvh, skip link, header sticky 64 px y footer; contenedor máximo
  1200 px; gutters 32 (>959), 24 (600–959), 16 (<600); main 40/24 vertical.
- **Spacing/effects**: escala 4/8/12/16/24/32/40/48/64; radios 4/6; shadow-1; sin
  gradientes ni decoraciones ajenas. Movimiento funcional 150–250 ms y reduced-motion.
- **Gate**: marca/identidad iguales, sin navegación crediticia; solo `Salir`. Documento
  semántico sanitizado con título, chip versión, `<time>`, secciones/listas y action bar
  sticky con espacio reservado. CTA único “Aceptar y continuar”; “Salir” secundario.
  No se exige llegar al final del scroll: contenido cargado+acción explícita son suficientes.
- **Admin/audit**: shell propio; navegación `Versiones`/`Aceptaciones` según rol; tablas
  se convierten a cards en móvil; publicar requiere confirmación por inmutabilidad.
- **Estados completos**: verificando/skeleton, accepted redirect sin flash, documento,
  accepting disabled+spinner, success, version changed, session expired, unavailable,
  no effective version, forbidden, empty, conflict, retention/audit results.
- **Accessibility**: WCAG 2.2 AA, contraste 4.5:1, focus 3 px, targets >=44 px, headings
  secuenciales, keyboard, `aria-live`, `role=alert`, no color-only, zoom 200 %, texto
  ampliado, foco al h1/error y reset al cambiar versión.
- **Evidence viewports**: 320×568, 375×667, 768×1024, 1024×768, 1440×900 para
  pending/loading/long/version-changed/error; geometry sin overflow, recorte, overlap,
  layout shift ni occlusion. Snapshot tolerance máxima 0.01.

### Data Model

**Artifact**: [data-model.md](./data-model.md)

Define versiones, aceptaciones, auditoría e idempotencia; clasificación, estados,
concurrencia, roles, migraciones, retención, backup/restore y no impacto en scoring.

### Contracts

**Artifact directory**: [contracts](./contracts/README.md)

- `terms-public-v1.openapi.yaml`: UI/administración/auditoría, JWT same-origin, ETag,
  digest, idempotencia, RFC 9457; producer terms-api, consumer terms-web.
- `terms-access-internal-v1.openapi.yaml`: decision producer terms-api/consumer ingestion;
  JWT original+service token+red, timeout 500 ms, no contenido, fail-closed.
- `terms-persistence-v1.md`: ownership, roles, transacciones, migración, retención y DR.
- `ingestion-public-v1` debe añadir 428 `TERMS_ACCEPTANCE_REQUIRED` y 503
  `TERMS_SERVICE_UNAVAILABLE` a toda operación protegida, manteniendo compatibilidad.

### Quickstart

**Artifact**: [quickstart.md](./quickstart.md)

Incluye configuración/secretos falsos o referencias, migración, Compose, salud, contrato,
auth, flows, fallos, UI responsive, retención, backup/restore, OpenShift y cleanup.

### Declarative Delivery Design

1. Extender base Kustomize con `terms-web`, `terms-api`, jobs, config y network.
2. Dev usa namespace observado y PostgreSQL existente; production usa placeholders
   tipados para registry, DB/TLS/backup/JWKS sin valores sensibles.
3. CI ejecuta inspect → contracts/lint/typecheck/tests → security/SBOM → build ambas
   imágenes una vez → render/policy → publish digests → PR GitOps → reconcile → smoke.
4. Resultados Tekton agregan `terms-web-digest` y `terms-api-digest`; scripts de
   build/scan/publish y overlays dejan de asumir solo tres imágenes.
5. Wave -1 aplica migración; wave 0 despliega terms; wave 1 frontend/ingestion. La
   ausencia de versión vigente genera alerta y bloquea negocio, no readiness administrativa.
6. Rollback restaura digests/config saludables y conserva DB. Expand/contract garantiza
   N/N-1; cambio no reversible bloquea promoción hasta recovery aprobado.
7. Documentación se genera desde render y observación autorizada, marcando `DESIRED`,
   `CONFIRMED` o `PENDING_VALIDATION`.

### Security and Network Design

- Pods arbitrary UID/non-root, seccomp RuntimeDefault, `allowPrivilegeEscalation:false`,
  drop ALL, root FS read-only y `emptyDir` acotado solo para `/tmp`/cache.
- SA por workload/job, `automountServiceAccountToken:false`, sin RBAC cluster ni lectura
  de Secrets. Credenciales DB y token interno separados por consumidor.
- Default deny. Flujos: ingress router/gateway→web/API; egress web→API/JWKS; ingestion→API;
  API/jobs→PostgreSQL; API→JWKS; DNS. Todo otro flujo, incluidos browser→Service,
  terms→scoring e ingestion→DB terms, se prueba denegado.
- JWT valida issuer/audience/algoritmo; body/query no aceptan actor/ámbito. `returnUrl`
  solo permite paths same-origin allowlisted para impedir open redirect.
- CSP, Helmet, límites de body 512 KiB para contenido autorizado, rate limit por
  actor/ámbito y sanitización Markdown estricta sin scripts/HTML peligroso.
- Logs no contienen JWT, credenciales, contenido legal, actor crudo, documento, contacto
  ni payload; auditoría separada y por ámbito.

### Observability and Operational Documentation

- `terms-web /health/live` confirma servidor; `/health/ready` confirma assets/config.
- `terms-api /health/live` confirma proceso; `/health/ready` confirma config, migraciones,
  DB y capacidad determinista. Versión vigente es métrica/alerta, no readiness.
- Métricas: request/error/latency por operación/código, decisions por reason, acceptance
  success/conflict, applicable-version count, DB pool, circuit state, migration,
  retention backlog/last success y backup/restore age.
- Alertas: TermsUnavailable, TermsDatabaseUnavailable, NoSingleActiveTermsVersion,
  TermsAcceptanceErrorRate/Latency, TermsMigrationFailed, TermsRetentionLate,
  TermsBackupRestoreStale y gate smoke failed.
- Requests/limits iniciales se afinan con datos; rolling maxUnavailable=0/maxSurge=1,
  grace 30 s, preStop 5 s y PDB minAvailable 1.
- Documentación operativa lista URLs/prefijos, workloads/pods, Services, configs/Secret
  refs, DB/jobs, flows, GitOps, probes, alertas, backup/restore y rollback sin secretos.

### Validation Strategy

| Requirement / Risk | Validation Level | Evidence or Command | Owner |
|--------------------|------------------|---------------------|-------|
| FR-001/010/012 version lifecycle | unit + PostgreSQL integration | concurrent schedule/effective/supersede suite | terms-api |
| FR-002/003/014 fail-closed | contract + integration + E2E | direct API, timeout, circuit and recovery cases | ingestion/terms |
| FR-004/005/009 UI gate | E2E + accessibility | read/accept/exit/session-expiry Playwright | terms-web |
| FR-006/013 authorization | integration | forged actor, role and cross-org negatives | security |
| FR-007/008 acceptance | DB integration + contract | digest/idempotency/concurrency suite | terms-api |
| FR-011 admin immutability | unit + E2E | role matrix and published edit rejection | terms |
| FR-015 privacy/audit | security + log scan | fixtures asserting absent JWT/content/PII | security |
| FR-016/017 durability/retention | migration + restore + job | N-1, backup/restore, 5-year clock suite | data/platform |
| FR-018 health | smoke/failure injection | live/ready vs missing version/DB | platform |
| FR-019 operations | manifest + docs | render/schema/policy/docs diff | platform |
| FR-020 independence | build + rollout | standalone image/build/health and independent rollback | delivery |
| FR-021 visual parity | token + visual + Axe | parity check and five viewport matrix | UX |
| Public/internal contracts | lint/bundle/consumer | contract scripts + breaking baseline | API |
| Network minimum | policy + connectivity | allowed/denied flow matrix | platform/security |
| Release/rollback | pipeline + smoke | digests, reconciliation, persistence and rollback evidence | delivery |
| Scoring non-regression | existing deterministic suite | low/medium/high/incomplete/invalid/dependency failure unchanged | scoring |

No feature se acepta con assertions dinámicas pendientes en el ambiente objetivo; la
ausencia de GitOps productivo permite generar/verificar estáticamente, pero no afirmar
despliegue completo.

## Project Structure

### Documentation (this feature)

```text
specs/003-accept-terms/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── README.md
│   ├── terms-public-v1.openapi.yaml
│   ├── terms-access-internal-v1.openapi.yaml
│   └── terms-persistence-v1.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
packages/ui-foundation/
├── styles/                 # tokens, typography, a11y, states
└── tests/                  # parity contract

apps/terms-web/
├── src/app/{core,layout,features,shared}/
├── tests/{e2e,visual,accessibility}/
├── nginx.conf
└── Dockerfile

services/terms-api/
├── src/{config,http,modules,infrastructure,observability}/
├── tests/{unit,integration,authorization,contract}/
└── Dockerfile

db/terms-migrations/
tests/{contract,integration}/
deploy/{local,openshift,gitops}/
.tekton/
docs/operations/
```

**Structure Decision**: `apps/terms-web` evita confundir la nueva SPA con el frontend
principal; `services/terms-api` representa el bounded context backend. Foundation solo
comparte contratos visuales en build. Despliegue, contratos HTTP, datos y secretos siguen
independientes.

## Complexity Tracking

No hay desviaciones constitucionales. Dos workloads son complejidad justificada por el
requisito explícito de interfaz y ciclo independientes. Dev comparte hosting PostgreSQL
como default reversible; ownership lógico, roles, backup y migraciones permanecen aislados.

## PLATFORM_INPUT_REQUIRED

Antes de promoción productiva: reconciliador/repo GitOps y rama protegida; namespace y
registry; dominio/TLS si cambia el proxy; DB terms administrada con hostname/CA/CIDR,
HA, backup/PITR y restore; destino JWKS; integración de monitoreo. Usar ticket para IDs
no sensibles y vault/gestor aprobado para referencias y credenciales.
