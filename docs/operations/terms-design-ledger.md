# Ledger de diseño operativo: términos y condiciones

**Fecha de corte**: 2026-08-12  
**Alcance**: inventario ejecutable y decisiones reversibles del bounded context `terms`.  
**Estados**: `DESIRED` significa definido por diseño pero aún no demostrado en ejecución;
`CONFIRMED` exige evidencia observable citada; `PENDING_VALIDATION` identifica una
capacidad externa o dinámica que no se puede afirmar todavía.

Este ledger no declara que un recurso exista por estar diseñado. No contiene Secrets,
tokens, contenido legal, identificadores de personas ni valores de infraestructura
productiva.

## Inventario ejecutable

| Componente | Estado | Ejecución/lifecycle deseado | Interfaz y dependencias | Evidencia |
|------------|--------|-----------------------------|--------------------------|----------|
| `terms-web` | DESIRED | SPA autónoma, imagen y Deployment propios; HTTP 8080 | `/terms/**`; `terms-api`, OIDC/JWKS | `specs/003-accept-terms/plan.md`; pendiente build, health y rollout |
| `terms-api` | DESIRED | servicio Node.js autónomo, imagen y Deployment propios; HTTP 8080 | `/terms-api/**`; PostgreSQL terms, OIDC/JWKS | contratos OpenAPI v1; pendiente tests, imagen y rollout |
| `terms-migrations` | DESIRED | Job finito antes del rollout, con checksum y advisory lock | PostgreSQL; credencial exclusiva de migrador | `data-model.md`; pendiente migraciones y ejecución desde vacío/N-1 |
| `terms-retention` | DESIRED | CronJob diario `30 2 * * *`, concurrencia `Forbid` | PostgreSQL; rol exclusivo de retención | `data-model.md`; pendiente job y prueba de reloj controlado |
| PostgreSQL local | CONFIRMED | servicio durable compartido como hosting local; ownership lógico separado | TCP 5432; volumen `postgres-data` | `deploy/local/compose.yaml` y `deploy/openshift/topology.yaml`; aislamiento terms aún DESIRED |
| PostgreSQL productivo | PENDING_VALIDATION | base lógica administrada, TLS, PITR/backup y restore aislado | endpoint/CIDR/TLS externos | no hay destino ni contrato operativo organizacional aprobado |
| Gateway/Route único | DESIRED | precedencia explícita de prefijos; sin Route adicional | `/terms/**` → web; `/terms-api/**` → API | `plan.md`; configuración y pruebas de routing pendientes |
| `ingestion` | CONFIRMED | consumidor existente; incorporará gate fail-closed antes del negocio | decisión interna con JWT original + identidad de servicio, timeout 500 ms | `services/ingestion/`; integración terms aún DESIRED |
| IdP/JWKS | CONFIRMED (local) / PENDING_VALIDATION (production) | emisor local para pruebas; proveedor corporativo externo en producción | HTTPS/JWKS, issuer, audience, algoritmo | `deploy/local/dev-auth/`; destino productivo pendiente |
| OpenShift dev | CONFIRMED | APIs estables y namespace observado; workloads terms todavía no desplegados | OpenShift 4.21.21 | `build/platform/dev-profile.json`, captura 2026-08-10 |
| Pipeline/GitOps | CONFIRMED (Pipelines) / PENDING_VALIDATION (GitOps) | build único, SBOM/scan, promoción por digest y reconciliación | Tekton v1; reconciliador aprobado | perfil dev confirma Pipelines y no confirma API GitOps |

## Grafo de comunicación deseado

```text
Browser
  | HTTPS + OIDC
  v
Route -> frontend gateway
          |-- /terms/** ------> terms-web
          |                       |-- /terms-api/** -> terms-api
          |                       `-- HTTPS/JWKS ---> IdP
          |-- /terms-api/** -----------------------> terms-api
          `-- /api/** ----------> ingestion
                                      |-- POST /internal/v1/access-decisions
                                      |       JWT original + service identity
                                      |       timeout 500 ms, fail-closed
                                      `-------------------------------> terms-api

terms-api -------- PostgreSQL terms <-------- terms-migrations
                         ^
                         `-------------------- terms-retention
terms-api -------- HTTPS/JWKS ----------------> IdP
```

Flujos no mostrados están denegados por defecto. En especial: browser→Service interno,
terms→scoring, ingestion→tablas terms y cualquier lectura de Secrets por ServiceAccount.
La comprobación dinámica de estas negaciones permanece `PENDING_VALIDATION` hasta que
existan las NetworkPolicies y el despliegue objetivo.

## Defaults reversibles

| Decisión | Default DESIRED | Motivo | Reversión/condición | Evidencia pendiente |
|----------|-----------------|--------|--------------------|--------------------|
| Réplicas | 2 por workload y PDB `minAvailable: 1` | el gate es crítico y ambos workloads son stateless | ajustar con capacidad observada; HPA solo con métricas aprobadas | carga, rollout y presupuesto del namespace |
| Recursos | web 50m/64Mi→250m/128Mi; API 100m/128Mi→500m/512Mi | punto inicial prudente | parche de overlay sin cambiar contrato | métricas de CPU/memoria y throttling |
| Rutas públicas | mismo host, `/terms/` y `/terms-api/` | evita CORS y conserva una entrada pública | host separado requiere decisión explícita de DNS/TLS/OIDC/CORS | test de precedencia, SPA fallback y headers |
| Cache de decisión | ninguna cache positiva inicial | reduce riesgo de permitir una versión nueva sin aceptar | incorporar cache solo con invalidación y prueba fail-closed | p95 de decisión y pruebas de rollover |
| Timeout interno | 500 ms, sin reintento inline | latencia acotada y fallo cerrado | ajustar tras SLO/carga; circuito mantiene 503 seguro | timeout, circuito y recuperación automatizados |
| Retención | ejecución diaria 02:30 UTC, lotes de 500 | limita carga y permite reintento idempotente | schedule/tamaño son configuración no sensible | prueba de cinco años, backlog y duración |
| Rollout | `maxUnavailable: 0`, `maxSurge: 1`, grace 30 s, preStop 5 s | continuidad del gate | afinar con evidencia de drenaje y capacidad | rollout y rollback conservando persistencia |
| Datos productivos | servicio PostgreSQL administrado, sin PVC de la app | separa ciclo durable del despliegue | alternativa solo mediante aprobación de datos/plataforma | endpoint, TLS/CIDR, RPO 24 h, RTO 4 h y restore |
| Fingerprint/keyring | opcional y deshabilitado hasta decisión aprobada | no inventar tratamiento criptográfico o retención adicional | habilitar con rotación/reindexación demostrada | evaluación de privacidad y mecanismo de claves |

## Referencias sensibles por consumidor

Solo se registran nombres lógicos; los valores se entregan fuera del repositorio.

| Referencia | Consumidor | Estado |
|------------|------------|--------|
| `terms-runtime` | `terms-api` runtime | DESIRED |
| `terms-migrator` | `terms-migrations` | DESIRED |
| `terms-retention` | `terms-retention` | DESIRED |
| `terms-backup` | backup/restore | DESIRED |
| `terms-database-tls` | API y jobs de datos | DESIRED localmente; PENDING_VALIDATION en producción |
| `terms-keyring` | API/retención solo si fingerprint se aprueba | PENDING_VALIDATION |

El inventario de nombres locales inequívocamente falsos está en
`deploy/local/terms-secrets.example`; ninguna entrada constituye una credencial.

## Evidencia y pendientes

| Afirmación | Estado | Fuente autoritativa / siguiente prueba |
|------------|--------|----------------------------------------|
| Los dos OpenAPI v1 son parseables y lintables | CONFIRMED | `scripts/contracts/validate.sh` y contratos bajo `specs/003-accept-terms/contracts/` |
| La generación tiene fronteras independientes para web e ingestion | DESIRED | `scripts/contracts/generate-terms-public.sh` y `generate-terms-internal.sh`; falta validación consumidor/productor |
| OpenShift dev reportó 4.21.21, Pipelines y External Secrets | CONFIRMED | `build/platform/dev-profile.json`, generado 2026-08-10 |
| GitOps está disponible | PENDING_VALIDATION | el perfil observado reporta `openshift-gitops.available=false`; se requiere reconciliador aprobado |
| terms está desplegado y saludable | PENDING_VALIDATION | requiere imágenes por digest, reconciliación, probes y smoke en el ambiente objetivo |
| producción tiene namespace, registro, dominio, DB/TLS/CIDR y backup | PENDING_VALIDATION | requiere entradas organizacionales no sensibles y referencias aprobadas |
| red mínima y flujos denegados funcionan | PENDING_VALIDATION | requiere render/policy y pruebas de conectividad permitida/denegada |
| migración, retención, backup/restore y rollback preservan datos | PENDING_VALIDATION | requiere suites desde vacío/N-1, reloj controlado, restore aislado y rollback por digest |
| la UI coincide con el foundation y WCAG 2.2 AA | PENDING_VALIDATION | requiere parity, visual y Axe en los cinco viewports del plan |

## Regla de actualización

Una fila cambia de `DESIRED` o `PENDING_VALIDATION` a `CONFIRMED` únicamente cuando la
evidencia citada existe y cubre el ambiente correspondiente. El render declarativo por sí
solo no confirma reconciliación, salud, seguridad de red, persistencia ni recuperación.
