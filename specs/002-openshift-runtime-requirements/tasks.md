# Tasks: Ejecución integral en Red Hat OpenShift

**Input**: Design documents from `/specs/002-openshift-runtime-requirements/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Las pruebas son obligatorias. Cada historia comienza definiendo sus validaciones automatizadas antes de implementar los artefactos que satisfacen esas validaciones.

**Organization**: Las tareas se agrupan por historia para que cada incremento pueda implementarse y verificarse de manera independiente. El proyecto OpenShift de desarrollo confirmado es `rh-ee-mpolo-dev`; producción permanece parametrizada hasta recibir las entradas externas autorizadas.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo con otras tareas marcadas `[P]` de la misma fase porque modifica archivos distintos y no depende de su resultado.
- **[US1]**, **[US2]**, **[US3]**: Historia de usuario a la que pertenece la tarea.
- Cada tarea incluye rutas exactas; no se deben escribir valores reales de secretos en archivos, comandos, evidencias o logs.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Preparar el repositorio, los contratos de entrada y los puntos de ejecución comunes.

- [X] T001 Ajustar las reglas de versionado para incluir selectivamente `.specify/memory/constitution.md`, `.specify/templates/` y `specs/002-openshift-runtime-requirements/`, conservando excluidos artefactos locales o sensibles, en `.gitignore`.
- [X] T002 [P] Registrar el inventario lógico, sus fuentes de evidencia y la clasificación `INFERRED`/`DEFAULTED`/`DISCOVERED`/`EXTERNAL_REQUIRED`/`SECRET_REFERENCE` en `deploy/openshift/topology.yaml`.
- [X] T003 [P] Crear perfiles tipados iniciales para desarrollo y producción, usando `rh-ee-mpolo-dev` solo en desarrollo y marcando valores dinámicos no confirmados, en `deploy/openshift/overlays/dev/platform-profile.json` y `deploy/openshift/overlays/production/platform-profile.json`.
- [X] T004 [P] Añadir el validador JSON Schema sin acceso a Secrets en `scripts/platform/validate-contracts.mjs` y declarar su dependencia reproducible en `package.json` y `package-lock.json`.
- [X] T005 [P] Crear fixtures válidos e inválidos para perfiles y evidencias, sin credenciales, en `tests/platform/profiles/fixtures/platform-profile.valid.json`, `tests/platform/profiles/fixtures/platform-profile.invalid.json`, `tests/platform/profiles/fixtures/deployment-evidence.valid.json` y `tests/platform/profiles/fixtures/deployment-evidence.invalid.json`.
- [X] T006 Integrar objetivos reproducibles `platform-discover`, `platform-render`, `platform-validate`, `platform-smoke` y `platform-docs` en `Makefile` sin sustituir los controles existentes.
- [X] T007 [P] Crear la convención de salida trazable y no versionada para renderizados y evidencias en `build/platform/README.md` y actualizar sus exclusiones en `.gitignore`.
- [X] T008 Ampliar la validación de artefactos SDD para exigir constitución, especificación, plan, contratos y tareas de la feature en `scripts/test/spec-artifacts.sh`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establecer contratos, validaciones y bases compartidas por todas las historias.

**⚠️ CRITICAL**: Ninguna historia debe declararse completa hasta satisfacer esta fase.

### Tests and contracts

- [X] T009 [P] Crear pruebas de aceptación de `platform-profile.schema.json` y `deployment-evidence.schema.json`, incluyendo rechazo de valores de Secret y estados de procedencia inválidos, en `tests/platform/profiles/contracts.test.mjs`.
- [X] T010 [P] Crear pruebas que limiten el descubrimiento a versión, APIs, cuotas, límites, StorageClasses, ingress, registro y permisos, y que fallen si se intenta listar u obtener Secrets, en `tests/platform/profiles/discovery-allowlist.test.sh`.
- [X] T011 [P] Extender las pruebas de renderizado para todos los overlays, referencias, namespaces y ausencia de recursos vacíos en `tests/platform/render/kustomize.test.sh`.
- [X] T012 [P] Extender las pruebas de seguridad para UID arbitrario, ejecución no root, `RuntimeDefault`, capacidades eliminadas, filesystem de solo lectura cuando aplique, `automountServiceAccountToken: false`, RBAC mínimo y montaje de claves individuales en `tests/platform/policy/workload-security.test.sh`.
- [X] T013 [P] Crear pruebas de migraciones para reejecución, exclusión concurrente, checksum, fallo transaccional y compatibilidad N/N-1 en `tests/platform/migrations/release-job.test.sh` y `services/ingestion/src/jobs/migrate.test.ts`.
- [X] T014 [P] Crear pruebas que demuestren construcción única, publicación por digest, igualdad de digest entre ambientes y rechazo de `latest` o tags mutables en `tests/platform/images/immutable-promotion.test.sh`.

### Shared implementation

- [X] T015 Implementar la validación de perfiles y evidencias contra `contracts/platform-profile.schema.json` y `contracts/deployment-evidence.schema.json` en `scripts/platform/validate-contracts.mjs` hasta aprobar T009.
- [X] T016 Implementar descubrimiento de solo lectura con lista permitida, contexto limitado a `rh-ee-mpolo-dev`, salida sanitizada y clasificación `DISCOVERED` en `scripts/platform/discover`, hasta aprobar T010.
- [X] T017 [P] Reorganizar la base del frontend sin cambiar su comportamiento en `deploy/openshift/base/frontend/deployment.yaml`, `deploy/openshift/base/frontend/service.yaml`, `deploy/openshift/base/frontend/route.yaml`, `deploy/openshift/base/frontend/serviceaccount.yaml` y `deploy/openshift/base/frontend/kustomization.yaml`.
- [X] T018 [P] Reorganizar la base de ingestion como servicio interno sin Route ni PVC en `deploy/openshift/base/ingestion/deployment.yaml`, `deploy/openshift/base/ingestion/service.yaml`, `deploy/openshift/base/ingestion/serviceaccount.yaml` y `deploy/openshift/base/ingestion/kustomization.yaml`.
- [X] T019 [P] Reorganizar la base de scoring como servicio interno sin Route ni PVC en `deploy/openshift/base/scoring/deployment.yaml`, `deploy/openshift/base/scoring/service.yaml`, `deploy/openshift/base/scoring/serviceaccount.yaml` y `deploy/openshift/base/scoring/kustomization.yaml`.
- [X] T020 [P] Separar migraciones, retención y reconciliación en identidades y controladores propios en `deploy/openshift/base/jobs/migrations-job.yaml`, `deploy/openshift/base/jobs/retention-cronjob.yaml`, `deploy/openshift/base/jobs/reconciler-cronjob.yaml`, `deploy/openshift/base/jobs/serviceaccounts.yaml` y `deploy/openshift/base/jobs/kustomization.yaml`.
- [X] T021 Separar configuración no sensible y referencias de secretos de mínimo privilegio en `deploy/openshift/base/config/frontend-configmap.yaml`, `deploy/openshift/base/config/ingestion-configmap.yaml`, `deploy/openshift/base/config/scoring-configmap.yaml`, `deploy/openshift/base/config/secret-reference-contract.yaml` y `contracts/secret-references.md`.
- [X] T022 [P] Crear la base de aislamiento de red con denegación por defecto, DNS y flujos explícitos en `deploy/openshift/base/network/default-deny.yaml`, `deploy/openshift/base/network/dns.yaml`, `deploy/openshift/base/network/frontend.yaml`, `deploy/openshift/base/network/ingestion.yaml`, `deploy/openshift/base/network/scoring.yaml`, `deploy/openshift/base/network/jobs.yaml` y `deploy/openshift/base/network/kustomization.yaml`.
- [X] T023 [P] Separar PostgreSQL de desarrollo y el contrato de PostgreSQL externo en `deploy/openshift/components/postgres-dev/statefulset.yaml`, `deploy/openshift/components/postgres-dev/service.yaml`, `deploy/openshift/components/postgres-dev/pvc.yaml`, `deploy/openshift/components/postgres-dev/kustomization.yaml`, `deploy/openshift/components/external-postgres/service.yaml`, `deploy/openshift/components/external-postgres/network-policy-patch.yaml` y `deploy/openshift/components/external-postgres/kustomization.yaml`.
- [X] T024 Implementar lock global, checksums y separación entre aprovisionamiento DBA y migración ordinaria de esquema en `services/ingestion/src/jobs/migrate.ts`, `services/ingestion/src/config/database.ts` y `db/migrations/README.md`, hasta aprobar T013.
- [X] T025 Separar build, scan y publish para no reconstruir imágenes ya verificadas en `scripts/images/build.sh`, `scripts/images/scan.sh`, `scripts/images/publish.sh` y `deploy/images.lock`, hasta aprobar T014.
- [X] T026 Implementar renderizado y validación estática de todos los ambientes, incluso sin conexión al clúster, en `scripts/platform/render`, `scripts/platform/validate`, `deploy/policies/kubernetes.rego`, `deploy/policies/images.rego`, `deploy/policies/network.rego` y `deploy/policies/secrets.rego`, hasta aprobar T011 y T012.

**Checkpoint**: Los contratos, perfiles, bases Kustomize, controles de seguridad y validación offline están disponibles.

---

## Phase 3: User Story 1 - Liberar una versión completa (Priority: P1) 🎯 MVP

**Goal**: Convertir un cambio aceptado en imágenes inmutables, una propuesta GitOps y un despliegue verificable sin comandos manuales ordinarios.

**Independent Test**: Con fixtures y un registro de prueba, ejecutar el flujo desde un commit hasta tres imágenes por digest, renderizar `dev`, generar el cambio GitOps, reconciliar o simular la reconciliación cuando la API no exista y completar el smoke test; cualquier fallo de build, política, migración, rollout o smoke debe detener la promoción con diagnóstico sanitizado.

### Tests for User Story 1

- [X] T027 [P] [US1] Crear una prueba estructural del DAG `inspect -> test -> secure -> build -> render -> publish -> promote -> verify -> report`, sus workspaces, resultados y límites de concurrencia en `tests/platform/pipeline/pipeline-contract.test.sh`.
- [X] T028 [P] [US1] Crear una prueba de liberación completamente offline que renderice `dev` y `production`, valide esquemas/políticas y genere evidencia `PENDING_VALIDATION` sin API de clúster en `tests/platform/pipeline/offline-release.test.sh`.
- [X] T029 [P] [US1] Crear pruebas de inyección de fallos que confirmen que build, scanner, política, migración, rollout y smoke bloquean promoción y producen diagnóstico sin secretos en `tests/platform/pipeline/failure-gates.test.sh`.
- [X] T030 [P] [US1] Crear pruebas de orden para que la migración concluya antes de los Deployments y para que un esquema incompatible bloquee rollback ordinario en `tests/platform/gitops/migration-order.test.sh`.
- [X] T031 [P] [US1] Crear pruebas del smoke funcional sintético `crear solicitud -> evaluar -> consultar resultado`, incluyendo indisponibilidad explícita de scoring, en `tests/platform/smoke/critical-flow.test.sh`.
- [X] T032 [P] [US1] Conservar la experiencia visual durante la liberación con regresiones Playwright a 360x800, 768x1024, 1440x900 y prueba de overflow a 320 px en `frontend/tests/e2e/openshift-release.spec.ts`.

### Implementation for User Story 1

- [X] T033 [P] [US1] Implementar las tareas Tekton de inspección y pruebas reutilizando los comandos existentes del repositorio en `.tekton/tasks/inspect.yaml` y `.tekton/tasks/test.yaml`.
- [X] T034 [P] [US1] Implementar secret scan, análisis de dependencias, SBOM y escaneo por digest con salidas sanitizadas en `.tekton/tasks/secure.yaml`.
- [X] T035 [P] [US1] Implementar build secuencial de frontend, ingestion y scoring con máximo inicial de 750m CPU y 2Gi por tarea, publicación sin rebuild y resultados de digest en `.tekton/tasks/build-image.yaml` y `.tekton/tasks/publish.yaml`.
- [X] T036 [P] [US1] Implementar renderizado, validación de esquema OpenShift 4.21 y políticas para todos los overlays en `.tekton/tasks/render.yaml`.
- [X] T037 [P] [US1] Implementar la propuesta de cambio de digest/configuración mediante PR al repositorio GitOps, sin escribir directamente en ramas protegidas, en `.tekton/tasks/propose-gitops.yaml`.
- [X] T038 [P] [US1] Implementar verificación y reporte de commit, digests, ambiente, revisión GitOps, migración, rollout y smoke en `.tekton/tasks/verify.yaml` y `.tekton/tasks/report.yaml`.
- [X] T039 [US1] Componer las tareas con timeouts, resultados, workspaces, builds secuenciales y gates de promoción en `.tekton/pipeline.yaml`, hasta aprobar T027 y T029.
- [X] T040 [P] [US1] Definir los disparadores Pipelines as Code para pull request y merge, condicionados a que el controlador sea descubierto, en `.tekton/pull-request.yaml` y `.tekton/push.yaml`.
- [X] T041 [P] [US1] Definir bootstrap namespace-scoped, identidades separadas y comprobaciones `oc auth can-i`, sin instalar operadores, en `deploy/gitops/bootstrap/README.md`, `deploy/gitops/bootstrap/rbac.yaml` y `deploy/gitops/bootstrap/repository-contract.yaml`.
- [X] T042 [P] [US1] Generar Applications declarativas para desarrollo y producción, marcadas `PENDING_VALIDATION` mientras no exista `argoproj.io/Application`, en `deploy/gitops/applications/dev.yaml`, `deploy/gitops/applications/production.yaml` y `deploy/gitops/kustomization.yaml`.
- [X] T043 [P] [US1] Completar el overlay `dev` para `rh-ee-mpolo-dev`, PostgreSQL de desarrollo, `gp3`, una única Route frontend e imágenes sustituibles por digest en `deploy/openshift/overlays/dev/kustomization.yaml` y `deploy/openshift/overlays/dev/patches/`.
- [X] T044 [P] [US1] Completar el overlay `production` sin PostgreSQL local, PVC ni egress abierto, con DB/TLS/CIDR/dominio tipados y digests obligatorios en `deploy/openshift/overlays/production/kustomization.yaml` y `deploy/openshift/overlays/production/patches/`.
- [X] T045 [P] [US1] Implementar el preflight de bootstrap que selecciona `rh-ee-mpolo-dev`, verifica capacidades/permisos y registra solo referencias sensibles en `scripts/platform/bootstrap`.
- [X] T046 [P] [US1] Implementar la generación determinista y validada de evidencia de entrega en `scripts/platform/report.mjs`, usando `contracts/deployment-evidence.schema.json`.
- [X] T047 [US1] Implementar el smoke funcional sintético y seguro contra Route o Service, con limpieza idempotente y logs redactados, en `scripts/platform/smoke`, hasta aprobar T031.
- [X] T048 [US1] Documentar y enlazar el recorrido continuo de PR, merge, build único, promoción por digest, reconciliación y verificación en `README.md` y `specs/002-openshift-runtime-requirements/quickstart.md`, hasta aprobar T028 y T030.

**Checkpoint**: US1 entrega una versión trazable por digest; sin GitOps instalado entrega todos los artefactos y evidencia estática con la validación dinámica claramente pendiente.

---

## Phase 4: User Story 2 - Operar y recuperar los flujos críticos (Priority: P1)

**Goal**: Mantener señales de salud reales, aislamiento, persistencia, recuperación y rollback verificables ante reinicios y fallos.

**Independent Test**: Sobre una revisión ya desplegada o un fixture equivalente, recrear workloads, interrumpir dependencias, validar flujos permitidos y denegados, restaurar una copia de prueba aislada y volver a una revisión saludable sin perder datos durables ni exponer secretos.

### Tests for User Story 2

- [X] T049 [P] [US2] Crear pruebas de probes reales, recursos, estrategia de rollout, terminación y PDB para cada workload aplicable en `tests/platform/operations/workload-lifecycle.test.sh`.
- [X] T050 [P] [US2] Crear pruebas positivas y negativas de red para Route→frontend, frontend→ingestion, ingestion→scoring/DB/JWKS, jobs→DB y bloqueo de flujos no requeridos en `tests/platform/network/connectivity.test.sh`.
- [X] T051 [P] [US2] Crear pruebas de degradación por DB, scoring y JWKS no disponibles, distinguiendo proceso vivo, readiness y fallo funcional del flujo principal en `tests/platform/operations/dependency-failure.test.sh`.
- [X] T052 [P] [US2] Crear una prueba que escriba un fixture, recree pods y confirme persistencia e idempotencia en `tests/platform/recovery/persistence.test.sh`.
- [X] T053 [P] [US2] Crear una prueba de backup cifrado y restore en base aislada que valide esquema, integridad, conteos, smoke y disponibilidad de versiones de claves PII en `tests/platform/recovery/backup-restore.test.sh`.
- [X] T054 [P] [US2] Crear pruebas de rollback N/N-1 por digest, rechazo de down migration destructiva y escalamiento a recuperación de datos cuando el esquema no sea compatible en `tests/platform/recovery/rollback.test.sh`.
- [X] T055 [P] [US2] Crear pruebas de logs estructurados sin datos sensibles, métricas de flujo/dependencias/Jobs y reglas mínimas de alerta en `tests/platform/observability/telemetry.test.sh`.

### Implementation for User Story 2

- [X] T056 [P] [US2] Ajustar frontend para readiness/liveness reales, cierre ordenado, recursos y PDB `minAvailable: 1` en `frontend/nginx.conf`, `deploy/openshift/base/frontend/deployment.yaml` y `deploy/openshift/base/frontend/pdb.yaml`.
- [X] T057 [P] [US2] Ajustar ingestion para probes existentes, terminación ordenada, recursos, PDB y métricas de DB/scoring/JWKS sin convertir dependencias degradables en liveness en `services/ingestion/src/server.ts`, `services/ingestion/src/observability/metrics.ts`, `deploy/openshift/base/ingestion/deployment.yaml` y `deploy/openshift/base/ingestion/pdb.yaml`.
- [X] T058 [P] [US2] Ajustar scoring para probes basadas en criterios/token, recursos, PDB y métricas de latencia/error en `services/scoring/app/main.py`, `services/scoring/app/observability.py`, `deploy/openshift/base/scoring/deployment.yaml` y `deploy/openshift/base/scoring/pdb.yaml`.
- [X] T059 [P] [US2] Implementar keyring versionado, rotación verificable y conservación de claves PII antiguas mediante referencias seguras en `services/ingestion/src/config/pii-keyring.ts`, `services/ingestion/src/modules/pii/pii.service.ts` y `contracts/secret-references.md`.
- [X] T060 [P] [US2] Añadir deadlines, TTL, historial, política `Forbid`, recursos y señal de último éxito/fallo a los Jobs y CronJobs en `deploy/openshift/base/jobs/migrations-job.yaml`, `deploy/openshift/base/jobs/retention-cronjob.yaml` y `deploy/openshift/base/jobs/reconciler-cronjob.yaml`.
- [X] T061 [US2] Restringir egress productivo a CIDR/proxy/hostname autorizado, mantener scoring sin egress y añadir variantes comprobables de flujo en `deploy/openshift/base/network/ingestion.yaml`, `deploy/openshift/base/network/scoring.yaml`, `deploy/openshift/base/network/jobs.yaml` y `deploy/openshift/overlays/production/patches/network-policy.yaml`, hasta aprobar T050.
- [X] T062 [P] [US2] Implementar backup y restore-test de PostgreSQL de desarrollo con destino tipado, cifrado y retención separada de la retención funcional en `deploy/openshift/components/postgres-dev/backup.yaml`, `deploy/openshift/components/postgres-dev/restore-test.yaml` y `scripts/platform/verify-backup-restore`.
- [X] T063 [P] [US2] Implementar verificación automatizada de persistencia tras recreación de workloads sin borrar recursos durables en `scripts/platform/verify-persistence`, hasta aprobar T052.
- [X] T064 [P] [US2] Implementar rollback como revert declarativo a digest/configuración saludable, con guardas de compatibilidad de esquema y sin escritura directa al clúster en `scripts/platform/rollback`, hasta aprobar T054.
- [X] T065 [US2] Integrar verificaciones de rollout, probes, conectividad, dependencias, persistencia, Jobs y recuperación en `scripts/platform/verify` y `.tekton/tasks/verify.yaml`, hasta aprobar T049, T051, T053 y T055.

**Checkpoint**: US2 puede demostrar salud, aislamiento, persistencia y recuperación independientemente del mecanismo elegido para reconciliar US1; la restauración productiva queda condicionada al proveedor y destino aprobados.

---

## Phase 5: User Story 3 - Recibir una entrega operable (Priority: P2)

**Goal**: Generar documentación operacional trazable desde manifiestos renderizados y enriquecerla, cuando haya acceso, con estado real seguro.

**Independent Test**: Generar el documento sin clúster y confirmar inventario `DECLARED` más valores dinámicos `PENDING_VALIDATION`; repetir con acceso de solo lectura y confirmar enriquecimiento `OBSERVED`, fecha y procedencia sin consultar ni revelar Secrets.

### Tests for User Story 3

- [X] T066 [P] [US3] Crear pruebas unitarias del inventario generado para ambientes, controladores, réplicas, Services, Routes, almacenamiento, Jobs, identidades y GitOps en `tests/platform/documentation/generator.test.mjs`.
- [X] T067 [P] [US3] Crear pruebas de procedencia que exijan `DECLARED`, `OBSERVED` o `PENDING_VALIDATION` para todo dato y prohíban tratar nombres efímeros de pods como identidad estable en `tests/platform/documentation/provenance.test.mjs`.
- [X] T068 [P] [US3] Crear pruebas que fallen ante tokens, contraseñas, kubeconfigs, contenido de Secrets, URLs con credenciales o PII en documentación y evidencias en `tests/platform/documentation/sensitive-data.test.sh`.
- [X] T069 [P] [US3] Crear una prueba offline que genere documentación completa desde ambos renderizados sin acceso al clúster en `tests/platform/documentation/offline-generation.test.sh`.
- [X] T070 [P] [US3] Crear una prueba con respuestas MCP/CLI sanitizadas que enriquezca solo recursos permitidos y nunca solicite Secrets en `tests/platform/documentation/cluster-enrichment.test.mjs`.

### Implementation for User Story 3

- [X] T071 [US3] Implementar el generador de arquitectura, inventarios, endpoints, datos, red, GitOps, procedimientos y trazabilidad desde manifiestos/evidencias en `scripts/platform/generate-operations-doc`, hasta aprobar T066, T067, T069 y T070.
- [X] T072 [P] [US3] Implementar validación estructural, frescura, procedencia y ausencia de datos sensibles del documento en `scripts/platform/validate-operations-doc`, hasta aprobar T068.
- [X] T073 [US3] Generar la primera entrega operacional con el clúster OpenShift 4.21.21 y `rh-ee-mpolo-dev` marcados según su procedencia, y producción dinámica como pendiente, en `docs/operations/openshift-deployment.md`.
- [X] T074 [US3] Integrar generación, validación y publicación del documento/evidencia en el mismo cambio que altera topología o endpoints en `.tekton/tasks/report.yaml`, `.tekton/pipeline.yaml` y `Makefile`.

**Checkpoint**: US3 entrega documentación regenerable y segura, diferenciando estrictamente deseo, observación y validación pendiente.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Cerrar trazabilidad, entradas externas y evidencia integral sin convertirlas en bloqueos del trabajo estático.

- [X] T075 [P] Construir la matriz requisito→tarea→prueba→evidencia para FR-001..FR-038, historias y criterios operativos en `specs/002-openshift-runtime-requirements/traceability.md`.
- [X] T076 Completar `PLATFORM_INPUT_REQUIRED` únicamente con controlador/repositorio GitOps aprobado, referencias seguras de OIDC/DB/backup/registro y perfil productivo autorizado en `deploy/gitops/bootstrap/repository-contract.yaml`, `deploy/openshift/overlays/production/platform-profile.json` y `docs/operations/openshift-deployment.md`; no registrar valores secretos.
- [X] T077 [P] Ejecutar y documentar `spec-artifacts`, contratos, lint, unitarias, integración, auth, migraciones, retención, E2E, visual, accesibilidad, secret scan, logs, render, políticas, SBOM y scan en `build/platform/evidence/static-validation.json`.
- [X] T078 Ejecutar el preflight de solo lectura y dry-run de servidor sobre `rh-ee-mpolo-dev`, incluyendo cuotas, `restricted-v2`, APIs, StorageClass, Route y permisos, y guardar la salida sanitizada en `build/platform/evidence/dev-preflight.json`.
- [X] T079 Evaluar y ejecutar una liberación representativa de desarrollo `commit -> tests -> digests -> cambio GitOps -> reconciliación -> verificación` cuando exista reconciliador aprobado; la condición actual queda registrada honestamente como `PENDING_VALIDATION`, sin PipelineRun inventado, en `build/platform/evidence/dev-release.json`.
- [X] T080 Evaluar y ejecutar promoción de las mismas imágenes a producción, smoke y rollback solo tras completar T076 y obtener aprobación organizacional; la ausencia actual de destino/aprobación queda registrada como `PENDING_VALIDATION`, sin digests desplegados inventados, en `build/platform/evidence/production-release.json`.
- [X] T081 [P] Validar todos los comandos seguros y procedimientos de bootstrap, diagnóstico, smoke, backup/restore y rollback de `specs/002-openshift-runtime-requirements/quickstart.md`.
- [X] T082 Regenerar y validar `docs/operations/openshift-deployment.md`, confirmar consistencia con `deploy/openshift/`, `deploy/gitops/`, `.tekton/` y `build/platform/evidence/`, y registrar la definición de terminado en `specs/002-openshift-runtime-requirements/traceability.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias; puede comenzar inmediatamente.
- **Foundational (Phase 2)**: Depende de Setup y bloquea la declaración de completitud de todas las historias.
- **US1 (Phase 3)**: Depende de Foundational; entrega el MVP de liberación.
- **US2 (Phase 4)**: Depende de Foundational. Sus pruebas con fixture pueden avanzar en paralelo con US1; la verificación sobre una liberación real depende de T039–T048.
- **US3 (Phase 5)**: Depende de Foundational. La generación offline puede avanzar en paralelo; el enriquecimiento real depende de evidencias producidas por US1/US2.
- **Polish (Phase 6)**: T075, T077 y T081 pueden comenzar al cerrar las historias; T079 depende de GitOps aprobado, T080 depende de T076 y de aprobación productiva, y T082 depende de todas las evidencias disponibles.

### User Story Dependency Graph

```text
Setup ──> Foundational ──┬──> US1: liberar versión ───────┐
                         ├──> US2: operar/recuperar ─────┼──> cierre y evidencia
                         └──> US3: documentar (offline) ─┘

US1 release real ──> US2 verificación dinámica
US1 + US2 evidence ──> US3 enriquecimiento OBSERVED
```

### Within Each User Story

1. Crear primero las pruebas de aceptación y comprobar que fallan por la capacidad ausente.
2. Implementar contratos/modelos antes de productores y consumidores.
3. Implementar recursos y scripts antes de componer pipelines.
4. Ejecutar validación estática antes de cualquier operación de clúster.
5. Ejecutar smoke/recuperación y generar evidencia antes de marcar la historia completa.

### Parallel Opportunities

- Setup: T002–T005 y T007 modifican archivos independientes.
- Foundational: T009–T014 pueden definirse en paralelo; T017–T020, T022 y T023 pueden implementarse en paralelo tras sus contratos.
- US1: T027–T032 pueden escribirse en paralelo; T033–T038 y T040–T046 se reparten por artefacto antes de componer T039/T047/T048.
- US2: T049–T055 pueden escribirse en paralelo; T056–T060 y T062–T064 se reparten por componente antes de integrar T061/T065.
- US3: T066–T070 pueden escribirse en paralelo; T072 puede avanzar junto a T071 y converger antes de T073/T074.

---

## Parallel Example: User Story 1

```text
T027 pipeline contract       || T028 offline release       || T029 failure gates
T030 migration ordering      || T031 critical smoke        || T032 visual regression
T033 inspect/test tasks      || T034 secure task           || T035 build/publish tasks
T036 render task             || T037 GitOps proposal       || T038 verify/report tasks
T041 bootstrap contract      || T042 Applications          || T043 dev overlay || T044 production overlay
```

## Parallel Example: User Story 2

```text
T049 lifecycle tests         || T050 network tests         || T051 dependency tests
T052 persistence tests       || T053 restore tests         || T054 rollback tests || T055 telemetry tests
T056 frontend lifecycle      || T057 ingestion ops         || T058 scoring ops
T059 PII keyring             || T060 finite jobs           || T062 backup/restore || T063 persistence || T064 rollback
```

## Parallel Example: User Story 3

```text
T066 inventory tests         || T067 provenance tests      || T068 sensitive-data tests
T069 offline generation      || T070 cluster enrichment
T071 document generator      || T072 document validator
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Completar Setup y Foundational.
2. Completar US1 con validación offline y dry-run en `rh-ee-mpolo-dev`.
3. Demostrar build único, digest, propuesta GitOps y smoke; si la API GitOps sigue ausente, registrar reconciliación como `PENDING_VALIDATION` sin ocultar el bloqueo.
4. Entregar el MVP antes de ampliar recuperación y documentación dinámica.

### Incremental Delivery

1. **Foundation**: contratos, perfiles, topología, seguridad, render y políticas.
2. **US1**: entrega inmutable y GitOps; valor inmediato de liberación repetible.
3. **US2**: operación y recuperación; valor de resiliencia y continuidad.
4. **US3**: documentación verificable; valor de transferencia y diagnóstico.
5. **Polish**: trazabilidad integral y evidencia dinámica autorizada.

### Definition of Done per Story

- Todas sus pruebas automatizadas pasan y las pruebas negativas fallan por la razón esperada.
- Los artefactos renderizan sin secretos, tags mutables ni recursos incompatibles con OpenShift 4.21/restricted-v2.
- La evidencia identifica commit, digest, configuración, ambiente y resultado con procedencia explícita.
- Los datos dinámicos no observados permanecen `PENDING_VALIDATION`; no se afirma existencia por haber generado YAML.
- Ningún paso ordinario exige que el cliente ejecute comandos de despliegue.

---

## Notes

- No se debe consultar el contenido de Secrets; solo se permiten nombre, esquema y ubicación segura de la referencia.
- La ausencia actual de `argoproj.io/Application` y `external-secrets.io/ExternalSecret` no bloquea generación, renderizado ni validación estática.
- PostgreSQL autogestionado con PVC `gp3` es solo una opción de desarrollo; producción debe usar el servicio aprobado y demostrar backup/restore.
- Los archivos bajo `build/platform/` son evidencia generada y deben permanecer fuera de Git cuando puedan contener metadatos dinámicos.
- Una tarea marcada `[P]` deja de ser paralela si durante la implementación se introduce dependencia sobre el mismo archivo o artefacto generado.
