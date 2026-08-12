# Modelo de datos: términos y condiciones

## 1. Límites y ownership

`terms-api` es el único propietario de escritura y lectura de negocio del esquema
lógico `terms`. `terms-web` usa el contrato público; `ingestion` usa el contrato interno
de decisión. Ningún consumidor consulta tablas directamente. En dev el esquema puede
vivir en la instancia PostgreSQL existente; esto no comparte roles ni ownership.

Roles mínimos:

| Rol | Permisos | Restricciones |
|-----|----------|---------------|
| `terms_app` | CRUD acotado mediante sentencias del servicio; append de aceptación/auditoría | Sin DDL, sin disposición, sin acceso a otros esquemas |
| `terms_migrator` | Ownership del esquema y migraciones versionadas | Sin administración de roles ni uso runtime |
| `terms_retention` | Funciones acotadas de anonimización por lote | Sin publicación ni lectura de contenido innecesaria |
| `terms_backup` | Lectura consistente para backup/restore | Sin escritura ni acceso a secretos de aplicación |

## 2. Clasificación de datos

| Clase | Ejemplos | Tratamiento |
|-------|----------|-------------|
| Público interno aprobado | título, versión, contenido, vigencia | Visible a usuarios autenticados; publicado es inmutable |
| Identificador personal restringido | `actor_id`, `org_scope_id` | Solo autorización/auditoría; nunca en logs textuales; anonimizado a 5 años |
| Evidencia regulatoria | aceptación, digest, fecha, resultado | Durable, append-only, acceso por ámbito |
| Operativo no sensible | request ID, error code, métricas agregadas | Logs estructurados; sin token, contenido ni PII innecesaria |
| Secreto | credenciales DB, token interno, claves | Solo referencias runtime; nunca persistido en tablas o artefactos |

## 3. Entidades

### 3.1 `terms_versions`

| Campo | Tipo lógico | Nulo | Reglas |
|-------|-------------|------|--------|
| `version_id` | UUID | no | PK inmutable |
| `version_code` | texto 1–64 | no | Único, patrón `^[A-Z0-9][A-Z0-9._-]{0,63}$`, inmutable |
| `title` | texto 1–200 | no | Trim, no solo espacios |
| `content_format` | enum | no | `markdown` en v1 |
| `content_source` | texto | no | Documento aprobado; tamaño máximo 512 KiB UTF-8 |
| `content_sha256` | hex SHA-256 | no | Único; calculado sobre forma canónica |
| `state` | enum | no | `DRAFT`, `SCHEDULED`, `EFFECTIVE`, `SUPERSEDED`, `WITHDRAWN` |
| `created_at` | instante UTC | no | Server-side |
| `created_by_actor_id` | texto 1–128 | no | Actor autenticado administrador |
| `scheduled_at` | instante UTC | sí | Requerido en `SCHEDULED` |
| `effective_at` | instante UTC | sí | Requerido desde `SCHEDULED`; >= publicación |
| `published_at` | instante UTC | sí | Requerido en estados publicados |
| `published_by_actor_id` | texto 1–128 | sí | Requerido en estados publicados |
| `superseded_at` | instante UTC | sí | Solo `SUPERSEDED` |
| `withdrawn_at` | instante UTC | sí | Solo draft/scheduled retirado |
| `request_id` | UUID | no | Correlación de creación/publicación |

Restricciones: no se actualizan `version_code`, contenido o digest después de publicar.
No hay dos versiones aplicables al mismo instante. Un digest no se republica bajo otro
código. El contenido se convierte a HTML sanitizado al responder; no se persiste HTML
arbitrario ejecutable.

### 3.2 `terms_acceptances`

| Campo | Tipo lógico | Nulo | Reglas |
|-------|-------------|------|--------|
| `acceptance_id` | UUID | no | PK |
| `version_id` | UUID | no | FK a versión publicada |
| `actor_id` | texto 1–128 | sí | Del JWT; null tras anonimización |
| `org_scope_id` | texto 1–128 | sí | Del JWT; null tras anonimización |
| `actor_fingerprint` | digest con clave/versionado | sí | Búsqueda autorizada; eliminado al anonimizar |
| `accepted_at` | instante UTC | no | Server-side |
| `content_sha256` | hex SHA-256 | no | Debe igualar versión aceptada |
| `request_id` | UUID | no | Correlación |
| `idempotency_key` | UUID | no | Unicidad con actor/ámbito/operación |
| `retention_until` | instante UTC | no | `accepted_at + 5 años` |
| `anonymized_at` | instante UTC | sí | Disposición irreversible |

Mientras no esté anonimizada existe unicidad lógica
`(org_scope_id, actor_id, version_id)`. Es append-only salvo la función de retención que
pone en null identificadores/fingerprint. No hay FK a identidades externas.

### 3.3 `terms_audit_events`

| Campo | Tipo lógico | Nulo | Reglas |
|-------|-------------|------|--------|
| `event_id` | UUID | no | PK append-only |
| `event_type` | enum | no | created/scheduled/effective/superseded/withdrawn/accepted/denied/retention |
| `actor_id` | texto | sí | Minimizado/anónimo según retención |
| `org_scope_id` | texto | sí | Acotamiento; minimizado según retención |
| `actor_role` | enum | sí | `credit_analyst`, `supervisor`, `auditor`, `terms_admin`, `system` |
| `version_id` | UUID | sí | Referencia lógica |
| `acceptance_id` | UUID | sí | Referencia lógica |
| `occurred_at` | instante UTC | no | Server-side |
| `request_id` | UUID | no | Correlación |
| `outcome` | enum | no | `succeeded`, `denied`, `failed` |
| `error_code` | texto seguro | sí | Sin payload, token ni contenido |
| `retention_until` | instante UTC | sí | Máximo de la aceptación asociada o política operativa |

### 3.4 `terms_idempotency_records`

| Campo | Tipo lógico | Nulo | Reglas |
|-------|-------------|------|--------|
| `record_id` | UUID | no | PK |
| `actor_id` / `org_scope_id` | texto | no | Derivados de JWT |
| `operation` | enum | no | `accept`, `create_version`, `schedule`, `withdraw` |
| `idempotency_key` | UUID | no | Único con actor/ámbito/operación |
| `request_sha256` | hex SHA-256 | no | Detecta replay con body distinto |
| `response_status` | entero | no | Resultado original |
| `resource_id` | UUID | sí | Recurso estable, no body sensible |
| `created_at` / `expires_at` | instante UTC | no | Expiración operativa definida por contrato |

## 4. Relaciones

```text
terms_versions 1 ──────── * terms_acceptances
       │                          │
       └──────── * audit_events * ┘

idempotency_records ── referencia lógica ──► recurso creado
```

## 5. Máquinas de estado

### Versión

```text
DRAFT ──schedule──► SCHEDULED ──effective_at──► EFFECTIVE
  │                     │                           │
  └─withdraw────────────┴──► WITHDRAWN             └─new effective──► SUPERSEDED
```

- `EFFECTIVE` y `SUPERSEDED` son inmutables.
- Retirar solo aplica antes de vigencia.
- La transición a vigente y la supersesión anterior ocurren en una transacción con
  lock de dominio. Si faltan datos o existe solapamiento, no cambia ningún estado.

### Aceptación

```text
PENDING ──explicit accept exact version+digest──► CONFIRMED
PENDING ──exit/error/version change────────────► PENDING
CONFIRMED ──retention due───────────────────────► ANONYMIZED
```

No existe estado parcialmente aceptado ni revocación retroactiva. Una versión nueva
crea otro requisito pendiente, no modifica la aceptación anterior.

## 6. Consistencia y concurrencia

- Publicación usa transacción serializable o advisory lock estable del contexto terms.
- Aceptación valida dentro de la misma transacción que versión y digest siguen vigentes.
- La restricción única resuelve doble clic/concurrencia y retorna el recurso existente.
- Idempotencia igual devuelve status/recurso original; misma clave con hash distinto da 409.
- Lecturas de decisión siempre comparan aceptación con la versión aplicable actual; no
  hay cache positivo en v1.

## 7. Migraciones y compatibilidad

Migraciones SQL de terms son inmutables, ordenadas, con checksum y advisory lock
`finance2-terms-schema-v1`. Un Job finito las aplica antes del rollout; ningún pod
runtime ejecuta DDL. Se usa expand/contract compatible con N/N-1. No existen down
migrations destructivas automáticas.

## 8. Durabilidad, backup y restore

- PostgreSQL confirma commit antes de responder aceptación.
- Dev puede reutilizar hosting PostgreSQL, pero backup debe incluir explícitamente el
  esquema/base terms y almacenarse fuera del PVC.
- Producción usa base lógica administrada aprobada con TLS, HA, backup/PITR y restore
  aislado. Objetivos iniciales: RPO 24 h, RTO 4 h.
- Restore verifica migraciones/checksums, una sola versión vigente, digest de documentos,
  decisiones autorizativas, aceptaciones e idempotencia antes del smoke.
- Rollback de imagen/config no modifica datos; si N no soporta N-1, promoción se bloquea.

## 9. Retención

Un job diario selecciona lotes vencidos, anonimiza identificadores mediante función DB
acotada y emite evento seguro. Es idempotente, evita procesar filas ya anonimizadas y
publica métricas de backlog/último éxito. Documentos publicados se conservan porque son
necesarios para interpretar evidencia histórica; no contienen datos personales.

## 10. Trazabilidad de scoring

Este modelo no cambia `evaluation_id`, timestamp, estado ni versión de criterios de
scoring. La decisión de acceso registra versión de términos y `checked_at`, pero no se
convierte en factor, banda, recomendación ni criterio crediticio.
