# Tasks: Aceptación obligatoria de términos y condiciones

**Input**: Design documents from `/specs/003-accept-terms/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/` and
`quickstart.md` are complete. Both Constitution Checks in `plan.md` are `PASS` and no
critical clarification remains.

**Tests and Automated Validation**: Tests are defined before their corresponding
implementation and must detect missing or incorrect behavior. Manual review may add
evidence but cannot replace contract, unit, integration, E2E, visual, accessibility,
security, manifest, rollout, persistence, recovery and regression automation.

**Organization**: Tasks are grouped by user story so each story can be implemented and
validated as an independent increment after the shared foundation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it targets different files and has no dependency
  on another incomplete task in the same group.
- **[Story]**: User story label, present only in story phases.
- Every task names the exact implementation or evidence path.

## Generation Gate

Implementation may start because the constitutional gates pass. Missing production
platform values do not block local code, contracts, manifests or static validation;
they are collected once in T084 without credentials or sensitive values.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the independent projects, build boundaries and shared validation
entry points without implementing user-story behavior.

- [X] T001 Create the versioned UI foundation package workspace and exports in `packages/ui-foundation/package.json`, `packages/ui-foundation/src/index.scss`, and `packages/ui-foundation/src/index.ts`
- [X] T002 [P] Scaffold the standalone Angular 20 terms application with lint, unit, E2E, visual and accessibility scripts in `apps/terms-web/package.json`, `apps/terms-web/angular.json`, `apps/terms-web/tsconfig.json`, and `apps/terms-web/playwright.config.ts`
- [X] T003 [P] Scaffold the Node.js 22 TypeScript terms API with build, lint, typecheck, unit and integration scripts in `services/terms-api/package.json`, `services/terms-api/tsconfig.json`, `services/terms-api/tsconfig.build.json`, and `services/terms-api/vitest.config.ts`
- [X] T004 Register `packages/ui-foundation`, `apps/terms-web`, and `services/terms-api` in the root install and validation workflow in `package.json`, `package-lock.json`, and `Makefile`
- [X] T005 [P] Add arbitrary-UID, non-root, read-only-filesystem container builds for the two workloads in `apps/terms-web/Dockerfile`, `apps/terms-web/nginx.conf`, and `services/terms-api/Dockerfile`
- [X] T006 [P] Add unequivocally fake local configuration examples and separated secret filenames in `deploy/local/.env.example` and `deploy/local/terms-secrets.example`
- [X] T007 Extend contract lint, bundle, breaking-check and type-generation entry points for both terms OpenAPI files in `scripts/contracts/validate.sh`, `scripts/contracts/check-breaking.sh`, `scripts/contracts/generate-terms-public.sh`, and `scripts/contracts/generate-terms-internal.sh`
- [X] T008 [P] Create synthetic version, acceptance, actor and failure fixtures with no real PII in `tests/fixtures/terms/versions.json`, `tests/fixtures/terms/acceptances.json`, and `tests/fixtures/terms/actors.json`
- [X] T009 Record the executable inventory, communication graph and reversible defaults for implementation traceability in `docs/operations/terms-design-ledger.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement shared visual, security, persistence, contract, health and local
runtime foundations required by every story.

**CRITICAL**: No user-story implementation begins until this phase passes.

- [X] T010 Port the canonical color, spacing, radius, elevation, typography, focus, reduced-motion and state tokens without changing their values in `packages/ui-foundation/src/_tokens.scss`, `packages/ui-foundation/src/_typography.scss`, `packages/ui-foundation/src/_a11y.scss`, and `packages/ui-foundation/src/_states.scss`
- [X] T011 [P] Add an automated token and geometry parity contract against the existing frontend in `packages/ui-foundation/tests/foundation-parity.test.mjs`
- [X] T012 Build the own terms shell, header, responsive container, footer, skip link and route-focus behavior on the foundation package in `apps/terms-web/src/app/layout/terms-shell.component.ts`, `apps/terms-web/src/app/layout/terms-header.component.ts`, `apps/terms-web/src/app/layout/responsive-container.component.ts`, and `apps/terms-web/src/app/layout/focus-on-navigation.service.ts`
- [X] T013 [P] Implement terms-web runtime configuration and OIDC Code+PKCE adapter with same-origin secure routes in `apps/terms-web/src/app/core/config/runtime-config.ts`, `apps/terms-web/src/app/core/auth/auth.port.ts`, and `apps/terms-web/src/app/core/auth/oidc-auth.adapter.ts`
- [X] T014 [P] Implement strict API configuration loading for DB, OIDC/JWKS, service identity, limits and safe defaults in `services/terms-api/src/config/schema.ts` and `services/terms-api/src/config/load-config.ts`
- [X] T015 Implement request correlation, JWT verification, role/organization authorization and internal service-token validation in `services/terms-api/src/http/middleware/request-context.ts`, `services/terms-api/src/infrastructure/auth/jwt-verifier.ts`, `services/terms-api/src/http/middleware/authorize.ts`, and `services/terms-api/src/http/middleware/service-auth.ts`
- [X] T016 [P] Implement RFC 9457 problems, structured redacted logging and metrics primitives that exclude JWT, legal content and raw actor identifiers in `services/terms-api/src/http/problem.ts`, `services/terms-api/src/http/problem-handler.ts`, `services/terms-api/src/infrastructure/logging/logger.ts`, and `services/terms-api/src/observability/metrics.ts`
- [X] T017 [P] Implement the isolated PostgreSQL pool, transaction wrapper and logical role boundaries in `services/terms-api/src/infrastructure/db/pool.ts` and `services/terms-api/src/infrastructure/db/transaction.ts`
- [X] T018 Create immutable checksum migrations for the `terms` schema, version, acceptance, audit and idempotency tables plus least-privilege grants in `db/terms-migrations/0001_terms_schema.sql`, `db/terms-migrations/0002_terms_versions.sql`, `db/terms-migrations/0003_terms_acceptances_audit.sql`, and `db/terms-migrations/0004_terms_idempotency_grants.sql`
- [X] T019 Add the independent checksum/advisory-lock migration runner and empty/N-1/concurrent validation in `services/terms-api/src/jobs/migrate.ts`, `services/terms-api/tests/integration/migrations.test.ts`, and `db/terms-migrations/README.md`
- [X] T020 Implement protocol-truthful live/ready endpoints where readiness checks config, migrations and DB but not current-version existence in `services/terms-api/src/http/routes/health.routes.ts`, `services/terms-api/src/app.ts`, and `services/terms-api/tests/integration/health.test.ts`
- [X] T021 [P] Implement terms-web live/ready endpoints, runtime-config generation and cache rules in `apps/terms-web/nginx.conf` and `apps/terms-web/scripts/write-runtime-config.mjs`
- [X] T022 Add producer/consumer validation for `terms-public-v1` and `terms-access-internal-v1`, including generated types and RFC 9457 examples, in `tests/contract/terms-openapi-contracts.test.mjs`, `apps/terms-web/src/app/core/api/generated/terms-public.ts`, and `services/ingestion/src/clients/generated/terms-access.ts`
- [X] T023 Extend local role provisioning, separated secret generation, service dependencies and internal networking for terms-web/API/migrations/retention in `deploy/local/postgres-init/001-create-roles.sql`, `scripts/dev/init-local-secrets.sh`, and `deploy/local/compose.yaml`
- [X] T024 Configure gateway prefix precedence, SPA fallback, correlation headers and same-origin isolation for `/terms/` and `/terms-api/` in `frontend/nginx.conf` and `tests/integration/gateway-routing.test.mjs`
- [X] T025 Create initial OpenShift Deployments, Services, PDBs, ServiceAccounts, ConfigMaps and Kustomize registration for both stateless workloads in `deploy/openshift/base/terms-web/deployment.yaml`, `deploy/openshift/base/terms-web/kustomization.yaml`, `deploy/openshift/base/terms-api/deployment.yaml`, `deploy/openshift/base/terms-api/kustomization.yaml`, `deploy/openshift/base/config/terms-configmap.yaml`, and `deploy/openshift/base/kustomization.yaml`
- [X] T026 Add default-deny allowlists for gateway-to-terms, ingestion-to-terms, terms-to-PostgreSQL/JWKS and explicit denied flows in `deploy/openshift/base/network/terms.yaml` and `tests/platform/terms-network-policy.test.mjs`
- [X] T027 Extend the secret-reference contract with distinct runtime, migrator, retention, TLS, backup and optional keyring consumers in `deploy/openshift/base/config/secret-reference-contract.yaml` and `specs/002-openshift-runtime-requirements/contracts/secret-references.md`
- [X] T028 Add base render/schema/policy tests for stable APIs, probes, resources, rollout, termination, read-only filesystems, no extra Route/PVC and no secret values in `tests/platform/terms-manifests.test.mjs` and `deploy/policies/network.rego`

**Checkpoint**: Foundation ready; contracts, migrations, auth, visual foundation, local
topology and static platform validation pass. User stories can now be implemented.

---

## Phase 3: User Story 1 - Aceptar antes de ingresar (Priority: P1) MVP

**Goal**: A person without a current acceptance sees the independent terms UI, cannot
access credit functions, explicitly accepts the exact version once and then continues.

**Independent Test**: Seed one effective version, authenticate an analyst without an
acceptance, prove UI and direct backend access are blocked, accept once, prove one
durable record and authorized return, then prove later sessions do not prompt again.

### Tests and Automated Validation for User Story 1

- [X] T029 [P] [US1] Add public contract tests for current document, exact digest acceptance, ETag, idempotent replay, validation and version-changed conflict in `services/terms-api/tests/contract/current-acceptance.contract.test.ts`
- [X] T030 [P] [US1] Add PostgreSQL integration tests for effective-version selection, atomic acceptance, duplicate/concurrent requests, idempotency key reuse and append-only audit in `services/terms-api/tests/integration/acceptance.test.ts`
- [X] T031 [P] [US1] Add authorization tests proving JWT-derived actor/organization, forged input rejection, self-only acceptance and cross-scope denial in `services/terms-api/tests/authorization/acceptance-authorization.test.ts`
- [X] T032 [P] [US1] Add internal decision contract and failure tests for accepted, required, no-effective-version, invalid response, 500 ms timeout and circuit recovery in `services/ingestion/tests/terms/terms-access-client.test.ts`
- [X] T033 [P] [US1] Add ingestion integration tests proving every credit route returns 428 for pending and 503 for unavailable without loading business data in `services/ingestion/tests/terms/terms-gate.integration.test.ts`
- [X] T034 [P] [US1] Add terms-web component tests for loading, long document, accepting, success, changed, expired, unavailable, disabled and exit states in `apps/terms-web/src/app/features/acceptance/acceptance-page.component.spec.ts`
- [X] T035 [P] [US1] Add E2E tests for direct navigation, returnUrl allowlist, accept/exit, double click, later session and new-version gate in `apps/terms-web/tests/e2e/us1-required-acceptance.spec.ts`
- [X] T036 [P] [US1] Add deterministic visual and geometry coverage for all gate states at 320×568, 375×667, 768×1024, 1024×768 and 1440×900 in `apps/terms-web/tests/visual/us1-acceptance.visual.spec.ts`
- [X] T037 [P] [US1] Add keyboard, skip-link, focus reset, zoom 200%, reduced-motion and Axe WCAG 2.2 AA coverage in `apps/terms-web/tests/accessibility/us1-acceptance.a11y.spec.ts`

### Implementation for User Story 1

- [X] T038 [P] [US1] Implement immutable terms-version and acceptance domain models with digest, state and validation rules in `services/terms-api/src/modules/versions/version.model.ts` and `services/terms-api/src/modules/acceptances/acceptance.model.ts`
- [X] T039 [P] [US1] Implement version lookup and acceptance repositories with transactional current-version verification and uniqueness handling in `services/terms-api/src/modules/versions/version.repository.ts` and `services/terms-api/src/modules/acceptances/acceptance.repository.ts`
- [X] T040 [US1] Implement current-terms and idempotent acceptance services that atomically persist acceptance, idempotency metadata and safe audit events in `services/terms-api/src/modules/acceptances/acceptance.service.ts` and `services/terms-api/src/modules/audit/audit.repository.ts`
- [X] T041 [US1] Implement `GET /terms-api/v1/current` and `POST /terms-api/v1/acceptances` with ETag, digest checks and RFC 9457 failures in `services/terms-api/src/http/routes/current.routes.ts` and `services/terms-api/src/http/routes/acceptance.routes.ts`
- [X] T042 [US1] Implement the internal access-decision endpoint without legal content and with deterministic reasons in `services/terms-api/src/modules/access/access-decision.service.ts` and `services/terms-api/src/http/routes/internal-access.routes.ts`
- [X] T043 [US1] Implement the ingestion terms client, timeout/circuit behavior and fail-closed middleware after authentication but before all business routers in `services/ingestion/src/clients/terms-access.client.ts`, `services/ingestion/src/http/middleware/require-terms-acceptance.ts`, and `services/ingestion/src/app.ts`
- [X] T044 [US1] Add shared 428 `TERMS_ACCEPTANCE_REQUIRED` and 503 `TERMS_SERVICE_UNAVAILABLE` responses to protected operations and generated consumers in `specs/001-alternative-credit-scoring/contracts/ingestion-public-v1.openapi.yaml` and `frontend/src/app/core/api/problem-mapper.ts`
- [X] T045 [US1] Implement the own terms public API client, acceptance facade, idempotency keys and version-change recovery in `apps/terms-web/src/app/core/api/terms-api.service.ts` and `apps/terms-web/src/app/features/acceptance/acceptance.facade.ts`
- [X] T046 [US1] Implement the semantic sanitized document surface, metadata, sticky action bar and complete gate states in `apps/terms-web/src/app/features/acceptance/terms-document.component.ts`, `apps/terms-web/src/app/features/acceptance/terms-action-bar.component.ts`, and `apps/terms-web/src/app/features/acceptance/acceptance-page.component.ts`
- [X] T047 [US1] Implement `/terms/` routing, session-expiry handling, same-origin allowlisted return navigation and logout in `apps/terms-web/src/app/app.routes.ts`, `apps/terms-web/src/app/core/navigation/return-url.service.ts`, and `apps/terms-web/src/app/core/auth/session.guard.ts`
- [X] T048 [US1] Redirect frontend navigation to the independent gate on 428 without embedding terms code and preserve only authorized destinations in `frontend/src/app/core/api/terms-required.interceptor.ts` and `frontend/src/app/app.config.ts`
- [X] T049 [US1] Add the local seed/smoke flow for effective version → blocked business → accept → authorized business with safe evidence in `scripts/test/validate-terms-us1.sh` and `scripts/smoke/terms-gate.sh`

**Checkpoint**: US1 is a deployable MVP. Contract, DB, authorization, fail-closed,
independent UI, responsive/a11y and smoke suites pass without US2 or US3 screens.

---

## Phase 4: User Story 2 - Exigir una nueva versión (Priority: P2)

**Goal**: An authorized terms administrator creates, schedules and withdraws future
versions while published history remains immutable and new effective text reopens the gate.

**Independent Test**: Using seeded acceptances only as fixtures, create and schedule a
future version through admin API/UI, advance the controlled clock, prove exactly one
effective version and rejection of edits/overlap, and verify the access decision changes.

### Tests and Automated Validation for User Story 2

- [X] T050 [P] [US2] Add admin contract tests for list/get/create/schedule/withdraw, idempotency, boundaries and RFC 9457 responses in `services/terms-api/tests/contract/version-admin.contract.test.ts`
- [X] T051 [P] [US2] Add controlled-clock and concurrent PostgreSQL tests for the DRAFT→SCHEDULED→EFFECTIVE→SUPERSEDED lifecycle, overlap prevention and published immutability in `services/terms-api/tests/integration/version-lifecycle.test.ts`
- [X] T052 [P] [US2] Add role tests for `terms_admin`, denied analyst/supervisor mutations and admin control-plane access when no effective version exists in `services/terms-api/tests/authorization/version-admin-authorization.test.ts`
- [X] T053 [P] [US2] Add admin UI tests for draft validation, Markdown preview, publish confirmation, conflicts, empty/loading/error and responsive table-to-card behavior in `apps/terms-web/src/app/features/admin/version-admin-page.component.spec.ts`
- [X] T054 [P] [US2] Add end-to-end, visual and Axe coverage for version list/create/detail/schedule/withdraw and effective-version rollover in `apps/terms-web/tests/e2e/us2-version-admin.spec.ts`, `apps/terms-web/tests/visual/us2-version-admin.visual.spec.ts`, and `apps/terms-web/tests/accessibility/us2-version-admin.a11y.spec.ts`

### Implementation for User Story 2

- [X] T055 [P] [US2] Implement version draft, scheduling, withdrawal and publication transition commands with strict title/code/content/date validation in `services/terms-api/src/modules/versions/version.commands.ts` and `services/terms-api/src/modules/versions/version-lifecycle.ts`
- [X] T056 [US2] Implement serializable/advisory-lock version repository operations that atomically supersede the prior effective version in `services/terms-api/src/modules/versions/version.repository.ts`
- [X] T057 [US2] Implement administrator list/get/create/schedule/withdraw endpoints and safe audit events in `services/terms-api/src/http/routes/version-admin.routes.ts` and `services/terms-api/src/modules/versions/version-admin.service.ts`
- [X] T058 [US2] Implement strict Markdown sanitization and canonical SHA-256 generation shared by draft preview and publication in `services/terms-api/src/modules/versions/content-sanitizer.ts` and `services/terms-api/src/modules/versions/content-digest.ts`
- [X] T059 [US2] Implement the terms-web admin API facade and generated-type-only boundary in `apps/terms-web/src/app/features/admin/version-admin-api.service.ts` and `apps/terms-web/src/app/features/admin/version-admin.facade.ts`
- [X] T060 [US2] Implement own admin routes and screens for version list, create, detail, preview, confirmation, schedule and withdraw states in `apps/terms-web/src/app/features/admin/version-admin.routes.ts`, `apps/terms-web/src/app/features/admin/version-admin-page.component.ts`, and `apps/terms-web/src/app/features/admin/version-editor.component.ts`
- [X] T061 [US2] Add `terms_admin` navigation and route guards without exposing credit navigation before acceptance in `apps/terms-web/src/app/layout/terms-header.component.ts` and `apps/terms-web/src/app/core/auth/role.guard.ts`
- [X] T062 [US2] Add deterministic version-rollover smoke validation proving prior acceptances stay immutable and become insufficient in `scripts/test/validate-terms-us2.sh`

**Checkpoint**: US2 works with synthetic actors and acceptances independently of the US1
screen; it produces a valid effective version consumed by the access-decision contract.

---

## Phase 5: User Story 3 - Auditar aceptación y recuperarse de fallos (Priority: P3)

**Goal**: Authorized supervisors/auditors inspect scoped acceptance evidence and
operators distinguish, observe and recover dependency, retention and data failures.

**Independent Test**: Seed versions and acceptances directly, search them in-scope,
prove cross-scope denial and empty results, inject DB/API failures, recover without data
loss, and run five-year anonymization plus restore verification.

### Tests and Automated Validation for User Story 3

- [X] T063 [P] [US3] Add audit search contract and validation tests for actor/version/date/cursor filters, empty results and masked output in `services/terms-api/tests/contract/acceptance-audit.contract.test.ts`
- [X] T064 [P] [US3] Add authorization and PostgreSQL integration tests for organization isolation, read-only behavior, pagination and no partial evidence on dependency failure in `services/terms-api/tests/integration/acceptance-audit.test.ts`
- [X] T065 [P] [US3] Add five-year controlled-clock retention tests for batched idempotent anonymization, restricted role grants and safe disposal audit in `services/terms-api/tests/integration/retention.test.ts`
- [X] T066 [P] [US3] Add audit UI unit, E2E, visual and Axe tests for filters, results, mobile cards, loading, empty, denied, retry and unavailable states in `apps/terms-web/src/app/features/audit/acceptance-audit-page.component.spec.ts`, `apps/terms-web/tests/e2e/us3-acceptance-audit.spec.ts`, `apps/terms-web/tests/visual/us3-acceptance-audit.visual.spec.ts`, and `apps/terms-web/tests/accessibility/us3-acceptance-audit.a11y.spec.ts`
- [X] T067 [P] [US3] Add operational failure-injection tests for DB/JWKS/circuit/no-version, truthful probes, metrics, alerts and recovery in `tests/integration/terms-operability.test.mjs`

### Implementation for User Story 3

- [X] T068 [P] [US3] Implement scoped acceptance search models, cursor validation and masked projections in `services/terms-api/src/modules/audit/acceptance-search.model.ts` and `services/terms-api/src/modules/audit/acceptance-audit.repository.ts`
- [X] T069 [US3] Implement the supervisor/auditor search endpoint with organization enforcement and no partial-result fallback in `services/terms-api/src/http/routes/acceptance-audit.routes.ts` and `services/terms-api/src/modules/audit/acceptance-audit.service.ts`
- [X] T070 [US3] Implement the daily idempotent retention job and restricted DB function that anonymize expired actor/organization/fingerprint values in `services/terms-api/src/jobs/retention.ts` and `db/terms-migrations/0005_terms_retention.sql`
- [X] T071 [US3] Implement audit API facade, filter validation, table/card results and complete recovery states in `apps/terms-web/src/app/features/audit/acceptance-audit-api.service.ts`, `apps/terms-web/src/app/features/audit/acceptance-audit-page.component.ts`, and `apps/terms-web/src/app/features/audit/acceptance-audit.routes.ts`
- [X] T072 [US3] Add supervisor/auditor navigation and readonly route guards in `apps/terms-web/src/app/layout/terms-header.component.ts` and `apps/terms-web/src/app/core/auth/role.guard.ts`
- [X] T073 [US3] Add terms-specific metrics and actionable alert rules for availability, current-version cardinality, latency/errors, migration, retention and restore freshness in `services/terms-api/src/observability/metrics.ts` and `deploy/observability/terms-alerts.yaml`
- [X] T074 [US3] Add the retention and audit recovery validation command with redacted evidence in `scripts/test/validate-terms-us3.sh`

**Checkpoint**: All three stories are independently functional and their automated
contract, authorization, failure, UI and data-lifecycle evidence passes.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Complete declarative delivery, recovery, documentation, performance,
traceability and full-product regression after the desired stories are complete.

- [X] T075 Create the migration Job and daily retention CronJob with separate SAs, credentials, deadlines, TTL, `Forbid` concurrency and sync waves in `deploy/openshift/base/jobs/terms-migrations-job.yaml`, `deploy/openshift/base/jobs/terms-retention-cronjob.yaml`, and `deploy/openshift/base/jobs/serviceaccounts.yaml`
- [X] T076 [P] Add dev and production Kustomize images, config, DB/TLS/JWKS patches and pending capability markers without secret values in `deploy/openshift/overlays/dev/kustomization.yaml`, `deploy/openshift/overlays/production/kustomization.yaml`, and `deploy/openshift/overlays/production/platform-profile.json`
- [X] T077 Extend CI to test, build once, create SBOM, scan, publish and return immutable digests for terms-web and terms-api in `.tekton/pipeline.yaml`, `.tekton/tasks/publish.yaml`, and `scripts/images/build-all.sh`
- [X] T078 Extend digest-only GitOps proposal, waves and deployment evidence with both terms images and jobs in `.tekton/tasks/propose-gitops.yaml`, `deploy/gitops/applications/finance2-dev.yaml`, and `specs/002-openshift-runtime-requirements/contracts/deployment-evidence.schema.json`
- [X] T079 [P] Add image-policy tests for arbitrary UID, read-only root FS, no critical vulnerabilities, SBOM, immutable digest and commit linkage in `tests/platform/terms-images.test.mjs`
- [X] T080 Implement terms-aware external backup and isolated restore verification covering schema, version cardinality, acceptances, authorization and smoke in `deploy/openshift/components/postgres-dev/backup.yaml`, `scripts/platform/verify-backup-restore`, and `tests/platform/terms-backup-restore.test.mjs`
- [X] T081 Add rollout, reconciliation, persistence and digest rollback verification that never runs destructive down migrations in `scripts/platform/verify-terms-release` and `scripts/platform/rollback`
- [X] T082 [P] Generate operational topology, URLs, expected pods, Services, jobs, DB, Secret refs, alerts, GitOps and recovery documentation with DESIRED/CONFIRMED/PENDING states in `docs/operations/terms-and-conditions.md` and `scripts/platform/generate-docs`
- [X] T083 [P] Add requirement-to-test-to-evidence traceability for FR-001–FR-021, OO-001–OO-005 and SC-001–SC-008 in `specs/003-accept-terms/traceability.md`
- [X] T084 Record `PLATFORM_INPUT_REQUIRED` for GitOps repository/reconciler, production namespace/registry/domain, managed terms DB/TLS/CIDR, backup/PITR target, JWKS destination and monitoring integration using only approved tickets and secret-reference names in `docs/operations/terms-platform-input-required.md`
- [X] T085 [P] Add automated log, manifest and repository scans proving no JWT, credentials, legal content, raw actor IDs, PII or Secret values leak in `tests/security/terms-data-minimization.test.mjs`
- [X] T086 [P] Add load and latency tests for p95 access decision, 99% start-state target, concurrent acceptance and stable UI interaction/CLS budgets in `services/terms-api/tests/performance/terms-performance.test.ts` and `apps/terms-web/tests/performance/terms-web-performance.spec.ts`
- [X] T087 Run and preserve the five-viewport quickstart evidence, contract bundles, migration, smoke, retention and restore outputs in `build/validation/terms/quickstart-evidence.json`
- [X] T088 Run the unchanged deterministic scoring regression for repeated low, medium, high, incomplete, invalid and scoring-dependency-failure cases and record non-impact evidence in `build/validation/terms/scoring-regression.json`
- [X] T089 Extend the root validation orchestration so contracts, terms US1–US3, UI, security, platform, restore, rollback and scoring regression are mandatory in `Makefile` and `scripts/test/validate-all.sh`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: starts immediately.
- **Phase 2 Foundational**: depends on Phase 1 and blocks every story.
- **Phase 3 US1**: depends on Phase 2; it is the recommended MVP.
- **Phase 4 US2**: depends only on Phase 2. It may run in parallel with US1 using seeded
  data, although sequential P1→P2 delivery reduces integration risk.
- **Phase 5 US3**: depends only on Phase 2. It uses seeded versions/acceptances for its
  independent test and may run in parallel with US1/US2.
- **Phase 6 Polish**: platform manifest work may begin after the relevant workloads/jobs
  exist; final evidence tasks depend on all selected stories.

### User Story Dependency Graph

```text
Phase 1 Setup
      │
      ▼
Phase 2 Foundation
   ┌──┼───────────┐
   ▼  ▼           ▼
 US1  US2         US3
 MVP  admin       audit/recovery
   └──┴─────┬─────┘
            ▼
     Phase 6 delivery/evidence
```

### Within Each User Story

1. Define automated contract, unit, integration, authorization, E2E, visual and a11y
   checks and confirm they fail when behavior is absent.
2. Implement models/repositories, then services, then endpoints and UI.
3. Integrate only through the versioned public or internal contract.
4. Complete failure, recovery, audit and responsive states before the checkpoint.
5. Run the independent story validation command before starting promotion.

### Parallel Opportunities

- Setup: T002, T003, T005, T006 and T008 target independent projects/files.
- Foundation: parity/config/logging/DB/web health can progress in parallel after their
  scaffolds; T025–T028 can proceed once component/config names stabilize.
- US1: T029–T037 are independent test suites; T038 and T039 can start together.
- US2: T050–T054 are independent test suites; backend lifecycle and UI facade can be
  assigned separately after the contract baseline.
- US3: T063–T067 are independent test suites; audit query, retention and UI work target
  separate modules after their tests exist.
- Cross-story: US1, US2 and US3 can be assigned concurrently after Phase 2 because US2
  and US3 independent tests seed their prerequisites directly.
- Polish: T076, T079, T082, T083, T085 and T086 target distinct artifacts.

## Parallel Example: User Story 1

```text
Track A: T029 → T030 → T038 → T039 → T040 → T041
Track B: T032 → T033 → T042 → T043 → T044
Track C: T034 + T035 + T036 + T037 → T045 → T046 → T047 → T048
Join: T049
```

## Parallel Example: User Story 2

```text
Track A: T050 + T051 + T052 → T055 → T056 → T057 → T058
Track B: T053 + T054 → T059 → T060 → T061
Join: T062
```

## Parallel Example: User Story 3

```text
Track A: T063 + T064 → T068 → T069
Track B: T065 → T070
Track C: T066 → T071 → T072
Track D: T067 → T073
Join: T074
```

## Implementation Strategy

### MVP First: User Story 1

1. Complete T001–T009 (Setup).
2. Complete T010–T028 (Foundation).
3. Define T029–T037 tests and confirm they detect missing behavior.
4. Complete T038–T049 (US1).
5. Stop and validate the independent MVP before adding administration or audit UI.
6. Promote only through the declared digest/GitOps flow when its external inputs exist.

### Incremental Delivery

1. Setup + Foundation → two independently buildable workloads and validated boundaries.
2. US1 → mandatory acceptance gate MVP.
3. US2 → safe version lifecycle and reacceptance.
4. US3 → scoped evidence, retention and operational recovery.
5. Polish → immutable delivery, DR, documentation and complete evidence.

### Parallel Team Strategy

After Foundation, one track may implement acceptance, another administration and a
third audit/retention using synthetic fixtures. Contract and shared-file changes
(`version.repository.ts`, header/guards, pipeline/Makefile) must be serialized at the
specified task boundaries.

## Notes

- `[P]` means different files and no unfinished prerequisite, not merely desirable concurrency.
- User-story labels map directly to the three prioritized stories in `spec.md`.
- Every task includes an exact path and observable outcome.
- Cluster inspection remains read-only, scoped and excludes Secrets.
- Ordinary deployments use GitOps; local imperative commands and one-time bootstrap are
  the only allowed exceptions.
- Do not mark runtime, rollout, GitOps, backup or production evidence `CONFIRMED` until
  the corresponding automated verification succeeds against an authorized target.
