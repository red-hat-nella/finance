# Modelo de datos: entrega y operación OpenShift

**Fecha**: 2026-08-09
**Feature**: `002-openshift-runtime-requirements`

## Alcance

Esta feature no cambia las entidades de negocio ni el esquema PostgreSQL descritos en
`specs/001-alternative-credit-scoring/data-model.md`. Define entidades declarativas y
de evidencia para que el despliegue sea trazable y verificable. Los registros de
pipeline pueden vivir como artefactos firmados o metadata del sistema de entrega; no se
añaden automáticamente a la base de negocio.

## Relación con el modelo existente

La plataforma debe preservar sin reinterpretar:

- solicitudes, revisiones, identidad cifrada y datos alternativos;
- consentimiento versionado;
- evaluaciones, instantáneas sin PII, factores y criterios versionados;
- auditoría append-only, idempotencia y ejecuciones de retención;
- borradores durante 90 días y evaluaciones identificables durante 5 años antes de la
  anonimización irreversible.

PostgreSQL es el propietario durable. Frontend y scoring no adquieren almacenamiento.
Los Jobs/CronJobs solo modifican el registro durable mediante roles acotados.

## Entidades declarativas

### PlatformProfile

Describe entradas de plataforma sin valores secretos.

| Campo | Tipo | Regla |
|-------|------|-------|
| `schemaVersion` | string | `platform.finance2/v1` |
| `generatedAt` | timestamp | UTC, ISO 8601 |
| `cluster.version` | string/null | `OBSERVED` o `PENDING_VALIDATION` |
| `cluster.contextRef` | string | Nombre lógico; nunca kubeconfig |
| `environment` | enum | `dev`, `production` |
| `namespace` | string | DNS label, autorizado externamente |
| `capabilities[]` | Capability | Sin contenido de Secrets |
| `inputs[]` | PlatformInput | Clasificada por origen |
| `sources[]` | EvidenceSource | Comando/API y fecha, sin payload sensible |

### PlatformInput

| Campo | Tipo | Regla |
|-------|------|-------|
| `name` | string | Clave estable y no secreta |
| `classification` | enum | `INFERRED`, `DEFAULTED`, `DISCOVERED`, `EXTERNAL_REQUIRED`, `SECRET_REFERENCE` |
| `value` | string/null | Obligatorio salvo referencia o pendiente; no admite secreto |
| `reference` | string/null | Nombre/ruta segura para `SECRET_REFERENCE` |
| `evidence` | string | Ruta de repo o fuente de descubrimiento |
| `requiredFor` | array | `static`, `bootstrap`, `promotion`, `runtime`, `verification` |
| `status` | enum | `DECLARED`, `OBSERVED`, `PENDING_VALIDATION` |

Regla: un input `SECRET_REFERENCE` no puede tener `value`. Un
`EXTERNAL_REQUIRED` pendiente bloquea solo las actividades listadas en `requiredFor`.

### Capability

| Campo | Tipo | Regla |
|-------|------|-------|
| `name` | string | Nombre de API/capacidad, no producto supuesto |
| `available` | boolean/null | null significa no verificable |
| `version` | string/null | Solo si fue observada |
| `status` | enum | `OBSERVED`, `DECLARED`, `PENDING_VALIDATION` |
| `source` | EvidenceSource | Sin datos sensibles |
| `alternative` | string/null | Requerida si es opcional y no disponible |

### ReleaseRecord

| Campo | Tipo | Regla |
|-------|------|-------|
| `releaseId` | string | Identificador único e inmutable |
| `commitSha` | string | SHA completo del código |
| `pipelineRunRef` | string | Nombre/URL no sensible de evidencia |
| `images` | map | `frontend`, `ingestion`, `scoring`, cada uno por `sha256` |
| `sbomRefs` | map | Referencias a CycloneDX por digest |
| `scanRefs` | map | Evidencia de política por digest |
| `configRevision` | string | Commit GitOps/configuración |
| `createdAt` | timestamp | UTC |

Reglas: ningún ambiente promovido acepta tag mutable; los tres digests son idénticos
entre ambientes para el mismo `releaseId`.

### EnvironmentRevision

| Campo | Tipo | Regla |
|-------|------|-------|
| `environment` | enum | `dev`, `production` |
| `namespace` | string | `rh-ee-mpolo-dev` para dev; producción externa |
| `releaseId` | string | FK lógica a ReleaseRecord |
| `gitopsRevision` | string | Commit de estado deseado |
| `syncStatus` | enum | `PENDING`, `SYNCING`, `SYNCED`, `DEGRADED`, `FAILED` |
| `healthStatus` | enum | `UNKNOWN`, `PROGRESSING`, `HEALTHY`, `DEGRADED` |
| `verificationStatus` | enum | `NOT_RUN`, `RUNNING`, `PASSED`, `FAILED` |
| `observedAt` | timestamp/null | Solo al consultar el cluster |
| `sources[]` | EvidenceSource | Una por dato observado |

Transición normal:

```text
PENDING/UNKNOWN/NOT_RUN
  -> SYNCING/PROGRESSING/RUNNING
  -> SYNCED/HEALTHY/PASSED
```

Cualquier control fallido pasa a `FAILED` o `DEGRADED`; promoción se detiene. Rollback
crea una nueva EnvironmentRevision que referencia un ReleaseRecord saludable anterior,
nunca reescribe la evidencia histórica.

### OperationalEvidence

| Campo | Tipo | Regla |
|-------|------|-------|
| `evidenceId` | string | Único |
| `type` | enum | `inspect`, `test`, `secure`, `build`, `render`, `publish`, `reconcile`, `migration`, `rollout`, `network`, `smoke`, `backup`, `restore`, `rollback`, `report` |
| `result` | enum | `PASS`, `FAIL`, `PENDING_VALIDATION` |
| `releaseId` | string/null | Requerido después de build |
| `environment` | string/null | Requerido para evidencia dinámica |
| `sourceRef` | string | Artefacto/comando/PipelineRun |
| `observedAt` | timestamp | UTC |
| `summary` | string | Diagnóstico allowlisted, sin secretos/PII |

### EvidenceSource

| Campo | Tipo | Regla |
|-------|------|-------|
| `state` | enum | `DECLARED`, `OBSERVED`, `PENDING_VALIDATION` |
| `sourceType` | enum | `repository`, `render`, `mcp`, `cli`, `pipeline`, `gitops`, `test` |
| `sourceRef` | string | Ruta, API kind o referencia de ejecución |
| `capturedAt` | timestamp | UTC |

### DataRecoveryPolicy

| Campo | Tipo | Regla |
|-------|------|-------|
| `dataOwner` | string | `postgresql` |
| `rpoHours` | integer | default 24, ajustable por política externa |
| `rtoHours` | integer | default 4, ajustable por política externa |
| `backupMechanism` | string | Producto/capacidad confirmada; no solo PVC |
| `backupEncryptionRef` | string | Referencia segura, nunca clave |
| `retentionPolicy` | string | Compatible con disposición funcional |
| `restoreTarget` | string | Destino aislado |
| `lastRestoreEvidence` | string/null | Requerido para aceptación productiva |
| `piiKeyringRef` | string | Referencia a keyring versionado seguro |

## Contratos de datos por componente

| Componente | Lee | Escribe | Identidad DB | Recuperación |
|------------|-----|---------|--------------|--------------|
| ingestion | solicitudes, criterios, evaluaciones, auditoría | borradores, intentos, resultados, auditoría | runtime DML acotado | Reintento/idempotencia; no DDL |
| scoring | criterios embebidos en imagen | nada en DB | ninguna | Réplica reemplazable |
| migrations | versión de esquema | DDL y catálogo de migraciones | schema-owner acotado | Advisory lock, checksum, expand/contract |
| retention | elegibilidad de retención | disposición y registro de ejecución | rol de retención | Advisory lock, lotes, auditoría segura |
| reconciler | intentos incompletos | transición recuperable | runtime/recovery acotado | Idempotente por estado/advisory lock |

## Backup, restauración y claves

- El backup incluye datos, metadata de esquema y referencias de versión de claves.
- Las claves PII no se guardan en el backup ni en Git; un keyring seguro debe conservar
  versiones necesarias para restaurar hasta completar rotación o disposición.
- Restaurar no autoriza reintroducir datos cuyo plazo de retención ya venció: después de
  restaurar se ejecuta la disposición antes de abrir el servicio.
- La prueba de restore valida migraciones, constraints, conteos allowlisted, lectura
  autorizada y smoke con fixtures sintéticos.
- Producción no se acepta sin `lastRestoreEvidence` vigente según política.

## Validaciones de compatibilidad

1. Migraciones nuevas se aplican a una base vacía y a snapshot de la versión anterior.
2. Aplicación N-1 funciona mientras N se despliega cuando el rollback ordinario está
   habilitado.
3. El checksum impide reutilizar un identificador de migración con contenido distinto.
4. Dos Jobs de migración no ejecutan DDL concurrente.
5. Rotar claves conserva lectura de versiones anteriores o completa re-encryption antes
   de retirar la clave.
6. Retención funciona después de restauración y no deja datos identificables vencidos.
