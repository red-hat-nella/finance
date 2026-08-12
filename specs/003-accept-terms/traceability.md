# Trazabilidad: términos y condiciones

Este registro enlaza cada requisito normativo con su prueba automatizada principal y
con el artefacto donde se conserva o se conservará la evidencia. Los datos utilizados
por las suites son sintéticos. `PENDING_VALIDATION` significa que el test existe o está
planificado, pero requiere el runtime o la capacidad de plataforma indicada antes de
promoción; no equivale a evidencia observada.

| Requisito | Prueba automatizada principal | Evidencia | Estado |
|---|---|---|---|
| FR-001 | `services/terms-api/tests/integration/version-lifecycle.test.ts` | `build/validation/terms/quickstart-evidence.json` | PENDING_VALIDATION |
| FR-002 | `services/ingestion/tests/terms/terms-gate.integration.test.ts` | suite de integración US1 | CONFIRMED |
| FR-003 | `services/ingestion/tests/terms/terms-gate.integration.test.ts` | 8 operaciones protegidas, 428/503 antes de DB | CONFIRMED |
| FR-004 | `apps/terms-web/src/app/features/acceptance/acceptance-page.component.spec.ts` | suite Karma US1 | CONFIRMED |
| FR-005 | `apps/terms-web/tests/e2e/us1-required-acceptance.spec.ts` | `build/validation/terms/quickstart-evidence.json` | PENDING_VALIDATION |
| FR-006 | `services/terms-api/tests/authorization/acceptance-authorization.test.ts` | suite de autorización US1 | CONFIRMED |
| FR-007 | `services/terms-api/tests/integration/acceptance.test.ts` | suite de integración US1 | CONFIRMED |
| FR-008 | `services/terms-api/tests/integration/acceptance.test.ts` | concurrencia e idempotencia US1 | CONFIRMED |
| FR-009 | `apps/terms-web/tests/e2e/us1-required-acceptance.spec.ts` | `build/validation/terms/quickstart-evidence.json` | PENDING_VALIDATION |
| FR-010 | `services/terms-api/tests/integration/version-lifecycle.test.ts` | validación US2 | PENDING_VALIDATION |
| FR-011 | `services/terms-api/tests/authorization/version-admin-authorization.test.ts` | validación US2 | PENDING_VALIDATION |
| FR-012 | `services/terms-api/tests/integration/version-lifecycle.test.ts` | validación US2 | PENDING_VALIDATION |
| FR-013 | `services/terms-api/tests/integration/acceptance-audit.test.ts` | validación US3 | PENDING_VALIDATION |
| FR-014 | `services/ingestion/tests/terms/terms-access-client.test.ts` | timeout, circuito y respuestas inválidas US1 | CONFIRMED |
| FR-015 | `services/terms-api/tests/integration/acceptance.test.ts`; `version-lifecycle.test.ts`; `retention.test.ts` | validaciones US1–US3 | PENDING_VALIDATION |
| FR-016 | `tests/platform/terms-backup-restore.test.mjs` | restore aislado | PENDING_VALIDATION |
| FR-017 | `services/terms-api/tests/integration/retention.test.ts` | validación US3 | PENDING_VALIDATION |
| FR-018 | `services/terms-api/tests/integration/health.test.ts`; `tests/integration/terms-operability.test.mjs` | health US1 y operabilidad US3 | PENDING_VALIDATION |
| FR-019 | `tests/platform/documentation/provenance.test.mjs` | `docs/operations/terms-and-conditions.md` | PENDING_VALIDATION |
| FR-020 | `tests/platform/terms-manifests.test.mjs`; `apps/terms-web/playwright.config.ts` | builds y manifiestos independientes | CONFIRMED |
| FR-021 | `packages/ui-foundation/tests/foundation-parity.test.mjs` | paridad exacta de tokens/geometría | CONFIRMED |
| OO-001 | `apps/terms-web/tests/e2e/us1-required-acceptance.spec.ts` | quickstart cinco viewports | PENDING_VALIDATION |
| OO-002 | `apps/terms-web/tests/e2e/us1-required-acceptance.spec.ts` | sesión ya aceptada | PENDING_VALIDATION |
| OO-003 | `services/ingestion/tests/terms/terms-gate.integration.test.ts` | 503 fail-closed antes de DB | CONFIRMED |
| OO-004 | `services/terms-api/tests/integration/acceptance.test.ts`; `version-lifecycle.test.ts` | auditoría US1/US2 | PENDING_VALIDATION |
| OO-005 | `scripts/platform/verify-terms-release`; `scripts/platform/rollback` | evidencia de rollback | PENDING_VALIDATION |
| SC-001 | `apps/terms-web/tests/e2e/us1-required-acceptance.spec.ts`; `terms-gate.integration.test.ts` | quickstart US1 | PENDING_VALIDATION |
| SC-002 | `apps/terms-web/tests/performance/terms-web-performance.spec.ts` | presupuesto de interacción | PENDING_VALIDATION |
| SC-003 | `services/terms-api/tests/integration/acceptance.test.ts` | rastreo de evidencia US1 | CONFIRMED |
| SC-004 | `services/terms-api/tests/performance/terms-performance.test.ts` | reporte de carga | PENDING_VALIDATION |
| SC-005 | `apps/terms-web/tests/e2e/us1-required-acceptance.spec.ts` | sesión posterior | PENDING_VALIDATION |
| SC-006 | suites US1 E2E, autorización, cliente y gate | quickstart US1 | PENDING_VALIDATION |
| SC-007 | suites `apps/terms-web/tests/visual` y `tests/accessibility` | capturas de cinco viewports | PENDING_VALIDATION |
| SC-008 | `tests/platform/terms-backup-restore.test.mjs`; `scripts/platform/verify-terms-release` | restore y rollback | PENDING_VALIDATION |

La evidencia final se materializa mediante T087 y T088. Un estado solo cambia a
`CONFIRMED` cuando el comando correspondiente termina en cero y su salida redactada se
registra; los valores de producción que dependen de plataforma permanecen en el registro
`PLATFORM_INPUT_REQUIRED` de T084.
