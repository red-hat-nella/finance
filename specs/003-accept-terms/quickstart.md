# Quickstart de validación: términos y condiciones

Esta guía define el recorrido reproducible que la implementación deberá habilitar. No
contiene código de servicio ni valores reales de secretos.

## 1. Prerrequisitos

- Node.js 22, npm, Docker Compose v2 o Podman 5 con proveedor Compose.
- PostgreSQL 16 provisto por el stack local.
- `curl`, `jq`, `openssl`, Chromium/Playwright y las herramientas de validación del repo.
- Para OpenShift: `oc`, Kustomize, acceso al proyecto autorizado y referencias seguras.

## 2. Contratos y configuración

Validar primero los contratos:

```bash
npm ci
npm run contracts:lint
npm run contracts:bundle
npm run contracts:test
```

La implementación debe extender esos targets para incluir:

- `specs/003-accept-terms/contracts/terms-public-v1.openapi.yaml`
- `specs/003-accept-terms/contracts/terms-access-internal-v1.openapi.yaml`

Configuración no sensible esperada:

| Componente | Valores |
|------------|---------|
| terms-web | `TERMS_API_BASE_URL=/terms-api`, AUTH mode/issuer/client/scope, base href `/terms/` |
| terms-api | port, DB host/port/name/user/SSL, issuer/JWKS/audience/algorithms, internal timeout policy |
| gateway | upstreams y prefixes `/terms/`, `/terms-api/` |
| retention | DB config, batch y schedule |

Secret refs locales separados: password runtime, migrator, retention, backup, token
interno ingestion→terms y claves de fingerprint si aplican. Generarlos con el mecanismo
local del repo; no escribir sus valores en `.env`, logs ni esta guía.

## 3. Inicializar datos

El perfil local debe crear roles/schema terms y ejecutar migraciones antes de arrancar
API. La validación esperada es:

```bash
./scripts/dev/init-local-secrets.sh
./scripts/dev/compose.sh docker up --build --wait
```

Se debe demostrar:

- migraciones desde vacío y desde baseline N-1;
- checksum y advisory lock propios;
- reintento idempotente;
- bloqueo ante migración incompatible o rol ausente.

## 4. Salud y topología local

```bash
curl --fail --silent http://localhost:8080/health/live | jq .
curl --fail --silent http://localhost:8080/terms/health/live | jq .
curl --fail --silent http://localhost:8080/terms/health/ready | jq .
curl --fail --silent http://localhost:8080/terms-api/health/live | jq .
curl --fail --silent http://localhost:8080/terms-api/health/ready | jq .
```

`terms-api` ready requiere configuración, migraciones y DB, no una versión vigente. Sin
versión, `GET current` falla de forma cerrada y dispara alerta, mientras la consola de
administración permanece accesible para corregir el estado.

| Local | OpenShift |
|-------|-----------|
| terms-web container | Deployment/Service/PDB `terms-web` |
| terms-api container | Deployment/Service/PDB `terms-api` |
| one-shot migration container | Job `terms-migrations` |
| retention profile | CronJob `terms-retention` |
| shared dev PostgreSQL host, isolated schema | PostgreSQL dev o DB administrada production |
| frontend published port | única Route/gateway con prefixes |

## 5. Preparar una versión

Con token sintético `terms_admin`, crear un draft, programarlo y alcanzar su vigencia
mediante el cliente generado o fixtures de contrato. Nunca usar un token real en el
historial del shell. Verificar:

- código/digest únicos;
- contenido Markdown sanitizado;
- confirmación antes de publicar;
- una sola versión aplicable;
- versión publicada inmutable.

## 6. Recorrido obligatorio E2E

1. Autenticar un `credit_analyst` sin aceptación.
2. Intentar `/applications/new` y una llamada directa a `/api/v1/applications`.
3. Confirmar redirección UI a `/terms/` y respuesta backend 428 sin datos de negocio.
4. Verificar título, versión, vigencia, documento completo y acción `Salir`.
5. Aceptar una vez; confirmar feedback, retorno allowlisted y acceso.
6. Repetir/doble clic con la misma idempotency key; debe existir una sola evidencia.
7. Iniciar otra sesión; no debe parpadear el documento ni pedir aceptación de nuevo.
8. Hacer efectiva una versión nueva; la siguiente navegación/acción vuelve al gate.

Resultados trazables: version ID/code, digest, acceptance ID, instante y request ID; no
se capturan JWT, contenido, actor crudo ni datos crediticios en logs.

## 7. Autorización y fallos

Ejecutar casos automatizados para:

- JWT ausente/expirado, issuer/audience/algoritmo inválidos;
- actor/ámbito falsificados en body o headers;
- `terms_admin`, supervisor y auditor dentro/fuera de ámbito;
- intento de editar publicada o retirar vigente;
- cambio de versión entre lectura y aceptación;
- DB/JWKS/API timeout, circuito abierto y recuperación;
- ausencia o multiplicidad de versión aplicable;
- `returnUrl` externo o no allowlisted;
- token interno ausente/reutilizado y NetworkPolicy denegada.

En todos los fallos de verificación, negocio permanece bloqueado. El control-plane de
terms sigue accesible al administrador autorizado cuando la API y DB están sanas.

## 8. UI/UX, responsive y accesibilidad

Ejecutar unit, E2E, visual y Axe de `terms-web`:

```bash
npm --prefix apps/terms-web run lint
npm --prefix apps/terms-web run test
npm --prefix apps/terms-web run test:e2e
npm --prefix apps/terms-web run test:visual
npm --prefix apps/terms-web run test:a11y
```

La matriz incluye 320×568, 375×667, 768×1024, 1024×768 y 1440×900, y estados loading,
pending con documento largo, accepting, success, changed, expired, unavailable, admin
empty/conflict y audit results. Evidencia requerida:

- paridad exacta de tokens/Roboto/geometría con `frontend`;
- no overflow, recorte, solapamiento, layout shift ni barra sticky ocluyendo contenido;
- targets >=44 px, teclado completo, skip link, foco 3 px, `aria-live`/alert;
- Axe WCAG 2.2 A/AA, zoom 200 %, reduced motion y texto ampliado.

## 9. Retención, backup y restore

Con reloj controlado, crear evidencia vencida y ejecutar el perfil de retención:

```bash
./scripts/dev/compose.sh docker --profile jobs run --rm terms-retention
```

Confirmar anonimización idempotente, auditoría segura y métricas. Después ejecutar el
procedimiento de backup/restore aislado que la implementación extienda:

```bash
scripts/platform/verify-backup-restore --environment dev \
  --restore-target isolated --evidence build/platform/evidence/dev/terms-restore.json
```

El restore debe cubrir explícitamente terms; el backup actual del scoring no basta.

## 10. OpenShift y GitOps

Validación estática/autorizada:

```bash
scripts/platform/render --environment dev --output build/platform/rendered/dev
scripts/platform/validate --all --cluster-version 4.21.21 \
  --input build/platform/rendered/dev
```

Comprobar dos imágenes por digest, Job wave -1, workloads wave 0, consumidores wave 1,
Secret refs mínimos, default-deny y matriz de conectividad. El deployment ordinario se
realiza por pipeline+PR+reconciliador, nunca por `oc apply` manual.

Hasta contar con reconciliador GitOps aprobado, la reconciliación, rollout, smoke y
rollback quedan `PENDING_VALIDATION`; no se afirma que terms exista en el cluster.

## 11. Regresión de scoring

Ejecutar la validación existente completa, incluyendo low/medium/high, incomplete,
invalid y dependencia caída. La aceptación solo autoriza acceso; nunca cambia score,
banda, factores, recomendación, criterios ni revisión manual.

```bash
make validate
```

## 12. Cleanup local

```bash
./scripts/dev/compose.sh docker down --volumes --remove-orphans
./scripts/dev/clean-local-secrets.sh
```

El borrado de volúmenes es exclusivo del entorno local efímero. En ambientes compartidos
o productivos, recuperación/disposición solo usa procedimientos declarativos aprobados.
