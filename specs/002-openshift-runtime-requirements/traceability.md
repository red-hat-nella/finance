# Trazabilidad de ejecución OpenShift

La especificación autoritativa define `FR-001`…`FR-025`; no existen `FR-026`…`FR-038` en `spec.md`. Esta matriz cubre todos los requisitos realmente definidos, los resultados observables, las historias y los criterios de éxito sin inventar requisitos adicionales.

| Requisito | Tareas | Prueba o control | Evidencia esperada |
|---|---|---|---|
| FR-001 | T002, T017–T023 | `tests/platform/render/kustomize.test.sh` | topología y render dev/production |
| FR-002 | T002, T049–T051 | lifecycle y connectivity | matriz de componentes y políticas renderizadas |
| FR-003 | T017–T020 | Kustomize test | tres servicios y Jobs conservan ciclos independientes |
| FR-004 | T017–T022, T050 | connectivity | una única Route frontend |
| FR-005 | T022, T044, T050, T061 | connectivity/policy | TLS externo y flujos internos allowlist |
| FR-006 | T003, T021, T059 | workload-security y sensitive-data | ConfigMaps separadas y referencias Secret por key |
| FR-007 | T014, T025, T035 | immutable-promotion | una construcción y digests por componente |
| FR-008 | T037, T039, T042, T064 | pipeline y rollback | PR GitOps y revert declarativo |
| FR-009 | T040, T048 | pipeline-contract | disparadores dev tras gates |
| FR-010 | T029, T039 | failure-gates | cada fallo bloquea promoción |
| FR-011 | T049, T056–T058 | workload-lifecycle | probes basadas en endpoints reales |
| FR-012 | T051, T057 | dependency-failure | liveness de proceso y readiness DB diferenciadas |
| FR-013 | T049, T052, T056–T060 | lifecycle/persistence | terminación, rollout y recreación controlada |
| FR-014 | T049, T056–T060 | lifecycle y validación de quota | requests/limits y PDB conservadores |
| FR-015 | T055, T057, T058, T060 | telemetry | métricas, logs seguros y contrato de alertas |
| FR-016 | T031, T047 | critical-flow | create/evaluate/query sintético |
| FR-017 | T052, T053, T062, T063 | persistence y backup-restore | fixture durable y restore aislado |
| FR-018 | T013, T020, T024, T060 | release-job/migration-order | Job PreSync con lock/checksum |
| FR-019 | T013, T030, T054, T064 | release-job/rollback | contrato expand/contract N/N-1 |
| FR-020 | T039, T054, T064 | rollback | revert a digest saludable y smoke |
| FR-021 | T026, T028, T069 | offline-release/offline-generation | render, políticas, evidencia y docs offline |
| FR-022 | T002, T003, T071 | contratos/perfiles/provenance | clasificación y fuente por dato |
| FR-023 | T076 | validadores y revisión del bloque único | `PLATFORM_INPUT_REQUIRED` sin valores sensibles |
| FR-024 | T066–T074, T082 | documentación completa | documento con huella de manifests |
| FR-025 | T010, T016, T070, T078 | discovery-allowlist | perfil/preflight sanitizado sin Secrets |

| Resultado/historia | Tareas | Validación | Evidencia |
|---|---|---|---|
| OO-001 | T002, T017–T023 | render e inventario | `deploy/openshift/topology.yaml` |
| OO-002 / US1 | T027–T048 | pipeline/offline release | digests y deployment evidence |
| OO-003 / US1 | T029, T039 | failure gates | diagnóstico sanitizado |
| OO-004 / US2 | T049–T065 | dependencia, red y smoke | runtime verification |
| OO-005 / US2 | T052–T064 | persistencia/restore/rollback | recovery evidence |
| OO-006 / US3 | T066–T074 | doc tests/validator | documento operacional |

| Criterio | Demostración | Estado actual |
|---|---|---|
| SC-001 | inventario generado de todos los controladores | DECLARED |
| SC-002 | commit, digests y revisión en evidencia de pipeline | PENDING_VALIDATION: release GitOps |
| SC-003 | pruebas de gates | DECLARED |
| SC-004 | `verify-persistence` | PENDING_VALIDATION: ventana disruptiva aprobada |
| SC-005 | `verify-backup-restore` aislado | PENDING_VALIDATION: destino aprobado |
| SC-006 | rollback por revisión y smoke | PENDING_VALIDATION: reconciliador |
| SC-007 | una Route y pruebas de red | DECLARED |
| SC-008 | guía operacional generada y validada | DECLARED |
| SC-009 | generación offline | DECLARED |
| SC-010 | secret scan y validador documental | DECLARED |

## Definición de terminado

La implementación está estáticamente terminada cuando contratos, render, políticas, pruebas de aplicación, documentación y server dry-run pasan. La entrega operativa completa exige además `commit → tests → digests → PR GitOps → reconciliación → migración → rollout → smoke → reporte`, persistencia/restore y rollback demostrados. Mientras falte el reconciliador GitOps aprobado o las entradas productivas, esas comprobaciones permanecen `PENDING_VALIDATION` en `build/platform/evidence/dev-release.json` y `build/platform/evidence/production-release.json`; no se afirma un despliegue real.
