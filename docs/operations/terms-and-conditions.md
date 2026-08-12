# Operación del servicio de términos y condiciones

> Documento generado desde manifiestos y contratos versionados. Estados permitidos:
> `DESIRED`, `CONFIRMED`, `PENDING_VALIDATION`.

## Topología y entrada pública

```text
Browser → Route/frontend → /terms/ → Service/terms-web:8080
                         → /terms-api/ → Service/terms-api:8080 → PostgreSQL/terms
Ingestion ── JWT + service token ────────────────────────────┘
Terms API ── HTTPS/443 → OIDC JWKS
Terms migrations / retention / backup → PostgreSQL/terms
```

Existe una sola Route pública, `frontend` — `DESIRED`. `terms-web` y `terms-api` son
workloads independientes, con imágenes y ciclo de release propios, pero solo Services
ClusterIP. La SPA propia conserva `/terms/`; el gateway elimina `/terms-api/` antes de
entregar las rutas internas de API.

## Inventario esperado

| Recurso | Cantidad/ciclo | Dependencia | Estado |
|---|---:|---|---|
| Deployment/terms-web | 2 pods | ConfigMap terms-web-config | DESIRED |
| Deployment/terms-api | 2 pods | DB, JWKS, terms-runtime | DESIRED |
| Service/terms-web | ClusterIP:8080 | frontend | DESIRED |
| Service/terms-api | ClusterIP:8080 | frontend, ingestion | DESIRED |
| Job/terms-migrations | PreSync wave -1 | terms-migrator, DB/TLS | DESIRED |
| CronJob/terms-retention | diario, Forbid | terms-retention, DB/TLS | DESIRED |
| CronJob/terms-backup | diario, suspendido en dev | terms-backup/target | PENDING_VALIDATION |
| PostgreSQL lógico `terms` | administrado/aislado | backup/PITR | PENDING_VALIDATION |

No hay PVC ni Route de terms. PDB `minAvailable: 1`, rolling update sin indisponibilidad,
UID arbitrario, seccomp, capabilities vacías y filesystem raíz de solo lectura están
verificados por pruebas de manifiesto — `CONFIRMED`.

## URLs y salud

- Pública: `https://<host-frontend>/terms/` — host dinámico `PENDING_VALIDATION`.
- API same-origin: `https://<host-frontend>/terms-api/v1` — `DESIRED`.
- Live API: `/terms-api/health/live`; ready: `/terms-api/health/ready`.
- Live/ready web: `/terms/health/live` y `/terms/health/ready`.
- Métricas internas: `http://terms-api:8080/metrics`.

Readiness comprueba configuración, DB y migraciones, no la existencia de una versión
vigente; así la consola administrativa puede corregir el estado. La falta de versión es
un fallo de negocio fail-closed y genera alerta.

## Secret references

`terms-runtime`, `terms-migrator`, `terms-retention`, `terms-database-tls`,
`terms-backup`, `terms-backup-target` y el opcional `terms-keyring`. Sus valores nunca
se almacenan ni se muestran en documentación — `DESIRED`.

## Alertas

El contrato `deploy/observability/terms-alerts.yaml` declara disponibilidad, DB,
cardinalidad de versión vigente, error/latencia de aceptación, migraciones, retención,
restore y gate. La integración corporativa de Prometheus/Alertmanager permanece
`PENDING_VALIDATION`.

## Recuperación y rollback

1. Ejecutar backup cifrado externo del esquema/DB lógico `terms`.
2. Restaurar únicamente en un destino aislado.
3. Validar migraciones, cardinalidad vigente, versiones, aceptaciones, auditoría,
   autorización, retención y smoke.
4. Para rollback de aplicación, proponer por GitOps los digests saludables previos.
   Nunca ejecutar down migrations ni restaurar datos como rollback ordinario.

Comandos:

```bash
scripts/platform/verify-backup-restore --scope terms --restore-target isolated
scripts/platform/verify-terms-release --environment dev
scripts/platform/rollback --environment dev --to-release HEALTHY_RELEASE --propose-only
```

Los checks estáticos de render, red, imágenes, jobs, recovery y rollback están
`CONFIRMED`. Reconciliación GitOps, rollout observado, backup/restore real, dominio,
DB productiva y monitoreo están `PENDING_VALIDATION`; sus entradas se registran en
`docs/operations/terms-platform-input-required.md`.
