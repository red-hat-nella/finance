---

description: "Task list template for feature implementation"
---

# Tasks: [FEATURE NAME]

**Input**: Design documents from `/specs/[###-feature-name]/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, and
quickstart.md are required. The plan's pre-research and post-design Constitution
Checks MUST pass.

**Tests and Automated Validation**: Every behavior and platform artifact MUST have an
automated test or validation task. Include unit, contract, integration, end-to-end,
render, schema, policy, image, rollout, smoke, reconciliation, persistence and rollback
checks as applicable. A manual check MAY supplement but MUST NOT replace reproducible
automated evidence.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Generation Gate

Do not start implementation while either Constitution Check in `plan.md` fails or a
required artifact is missing. A missing external, non-discoverable platform value does
not block independent work: complete that work and add one `PLATFORM_INPUT_REQUIRED`
task containing only the essential fields, reason, and approved secure channel. Never
turn an unexpressed preference into a blocker.

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- **Containerized web app**: `frontend/src/`, `services/ingestion/src/`,
  `services/scoring/src/`, `tests/`, `deploy/local/`, and `deploy/openshift/`
- Paths shown below assume single project - adjust based on plan.md structure

<!--
  ============================================================================
  IMPORTANT: The tasks below are SAMPLE TASKS for illustration purposes only.

  The /speckit-tasks command MUST replace these with actual tasks based on:
  - User stories from spec.md (with their priorities P1, P2, P3...)
  - Feature requirements from plan.md
  - Entities from data-model.md
  - Endpoints from contracts/
  - Application topology, resource mapping, decision/discovery ledger, and data lifecycle
  - Declarative CI/GitOps, security/network, operability, rollback, and documentation gates

  Tasks MUST be organized by user story so each story can be:
  - Implemented independently
  - Tested independently
  - Delivered as an MVP increment

  Tasks MUST preserve evidence for every inferred default and non-sensitive source for
  every discovered capability. Cluster inspection MUST begin read-only and exclude Secrets.

  DO NOT keep these sample tasks in the generated tasks.md file.
  ============================================================================
-->

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create project structure per implementation plan
- [ ] T002 Initialize [language] project with [framework] dependencies
- [ ] T003 [P] Configure linting and formatting tools
- [ ] T004 Inventory executable components and dependencies from specs, contracts, data model, and source in [exact paths]
- [ ] T005 Record inferred defaults and read-only capability-discovery sources without sensitive values in [exact paths]

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

Examples of foundational tasks (adjust based on your project):

- [ ] T006 Define and validate component contracts and the real communication graph in [exact paths]
- [ ] T007 Map each component to its justified Deployment, StatefulSet, Job, CronJob, Service, Route, or no-resource decision in [exact paths]
- [ ] T008 Define stateful-service selection, storage, backup, restore, upgrade, availability, retention, limits, and migration strategy in [exact paths]
- [ ] T009 [P] Implement non-root arbitrary-UID security contexts, least-privilege ServiceAccounts/RBAC, and read-only filesystems where viable in [exact paths]
- [ ] T010 [P] Separate configuration from runtime secret references and add unequivocally fake examples in [exact paths]
- [ ] T011 Derive Routes, Services, and NetworkPolicies from external entry points and component flows in [exact paths]
- [ ] T012 Implement protocol-appropriate health checks, requests/limits, rollout, termination, and dependency-failure behavior in [exact paths]
- [ ] T013 Configure non-sensitive structured logs, metrics, and minimum actionable alerts in [exact paths]
- [ ] T014 Create stable-API environment overlays and GitOps desired state in [exact paths]
- [ ] T015 Create CI for test/analysis, single build, SBOM, scan, immutable push, and digest-only GitOps update in [exact paths]
- [ ] T016 Implement automated, observable, and conditionally idempotent migrations separate from replica startup in [exact paths]
- [ ] T017 Set up render, schema, policy, rollout, smoke, reconciliation, persistence, and rollback validation in [exact paths]
- [ ] T018 Generate versioned operational documentation separating desired, confirmed, and pending state in [exact paths]

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - [Title] (Priority: P1) MVP

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests and Automated Validation for User Story 1

> Define these checks before implementation and confirm they detect missing or
> incorrect behavior.

- [ ] T019 [P] [US1] Add contract validation for [endpoint/schema] in [exact path]
- [ ] T020 [P] [US1] Add integration coverage for authorized, denied, error, and recovery paths in [exact path]
- [ ] T021 [P] [US1] Add behavior and dependency-failure validation in [exact path]
- [ ] T022 [P] [US1] Add applicable UI, accessibility, and responsive checks in [exact path]

### Implementation for User Story 1

- [ ] T023 [P] [US1] Create [Entity1] model in [exact path]
- [ ] T024 [P] [US1] Create [Entity2] model in [exact path]
- [ ] T025 [US1] Implement [Service] in [exact path] (depends on T023 and T024)
- [ ] T026 [US1] Implement [versioned endpoint/feature] in [exact path]
- [ ] T027 [US1] Implement specified UI and failure states in [exact path]
- [ ] T028 [US1] Add boundary validation, authorization, explicit states, and recovery behavior in [exact path]
- [ ] T029 [US1] Add redacted diagnostic logging and trace metadata in [exact path]

**Checkpoint**: User Story 1 MUST be fully functional and independently testable

---

## Phase 4: User Story 2 - [Title] (Priority: P2)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests and Automated Validation for User Story 2

- [ ] T030 [P] [US2] Add contract validation for [endpoint/schema] in [exact path]
- [ ] T031 [P] [US2] Add integration coverage for [user journey, authorization, and failures] in [exact path]
- [ ] T032 [P] [US2] Add applicable rule, UI state, accessibility, and responsive checks in [exact path]

### Implementation for User Story 2

- [ ] T033 [P] [US2] Create [Entity] model in [exact path]
- [ ] T034 [US2] Implement [Service] in [exact path]
- [ ] T035 [US2] Implement [versioned endpoint/feature] in [exact path]
- [ ] T036 [US2] Implement complete UI, validation, error, and recovery states in [exact path]
- [ ] T037 [US2] Integrate with User Story 1 through documented contracts in [exact path]

**Checkpoint**: User Stories 1 and 2 MUST both work independently

---

## Phase 5: User Story 3 - [Title] (Priority: P3)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests and Automated Validation for User Story 3

- [ ] T038 [P] [US3] Add contract validation for [endpoint/schema] in [exact path]
- [ ] T039 [P] [US3] Add integration coverage for [user journey, authorization, and failures] in [exact path]
- [ ] T040 [P] [US3] Add applicable rule, UI state, accessibility, and responsive checks in [exact path]

### Implementation for User Story 3

- [ ] T041 [P] [US3] Create [Entity] model in [exact path]
- [ ] T042 [US3] Implement [Service] in [exact path]
- [ ] T043 [US3] Implement [versioned endpoint/feature] in [exact path]
- [ ] T044 [US3] Implement complete UI, validation, error, and recovery states in [exact path]

**Checkpoint**: All user stories MUST be independently functional

---

[Add more user story phases as needed, following the same pattern]

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] TXXX Generate architecture and resource documentation from rendered manifests in docs/operations/
- [ ] TXXX Reconcile authorized read-only cluster observations into confirmed state without reading Secrets
- [ ] TXXX Code cleanup and refactoring
- [ ] TXXX Performance optimization across all stories
- [ ] TXXX [P] Complete requirement-to-validation traceability and regression coverage in [exact paths]
- [ ] TXXX Verify data minimization, authorization, secret handling, log redaction, and audit traceability in [exact paths]
- [ ] TXXX Validate stable OpenShift APIs, rendered schemas, policies, ConfigMap/Secret references, probes, resources, rollout, and termination in [exact paths]
- [ ] TXXX Verify image scan, SBOM, immutable digest, commit/config/environment traceability, and build-once promotion evidence
- [ ] TXXX Exercise GitOps reconciliation, main-flow smoke tests, required connectivity, persistence where applicable, and rollback to a healthy revision
- [ ] TXXX Verify data backup/restore and automated migrations where stateful services apply
- [ ] TXXX Confirm operational docs distinguish desired, cluster-confirmed, and pending state and contain no sensitive values
- [ ] TXXX Verify mobile, tablet, and desktop layout integrity plus WCAG AA evidence in [exact paths]
- [ ] TXXX Run and record the reproducible quickstart.md validation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel only when their files and contracts do not conflict
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - May integrate with US1 but MUST remain independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - May integrate with US1/US2 but MUST remain independently testable

### Within Each User Story

- Automated tests or validation checks MUST be defined before implementation and pass before the story checkpoint
- Resource mapping and optional capability prerequisites MUST be validated before platform manifests consume them
- Stateful service lifecycle and migration tasks MUST precede workloads that depend on them
- CI publication by digest MUST precede GitOps promotion and reconciliation checks
- Versioned contracts and models MUST be validated before producer or consumer code
- Models before services
- Services before endpoints
- Core implementation before integration
- Complete failure, authorization, traceability, and UI states before acceptance
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel
- Models within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all independent validation tasks for User Story 1 together:
Task: "Contract test for [endpoint] in tests/contract/test_[name].py"
Task: "Integration test for [user journey] in tests/integration/test_[name].py"

# Launch all models for User Story 1 together:
Task: "Create [Entity1] model in src/models/[entity1].py"
Task: "Create [Entity2] model in src/models/[entity2].py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Promote through the declared GitOps flow if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2
   - Developer C: User Story 3
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story MUST be independently completable and testable
- Confirm validation detects missing or incorrect behavior before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Every task names an exact file, observable outcome, and requirement, contract, or constitutional gate
- Every discovered fact records a non-sensitive source; every inference records evidence and its reversible default
- Ordinary deployments use GitOps; imperative steps are limited to local validation, bootstrap, or explicit organizational approval
- Avoid vague tasks, same-file conflicts, untracked manual-only checks, and cross-story dependencies that break independence
