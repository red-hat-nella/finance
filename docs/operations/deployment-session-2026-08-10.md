# Sesion de despliegue OpenShift — 2026-08-10

## Resultado

Estado: `APP_AVAILABLE_FOR_TEST` / `DIRECT_APPLY_DEVIATION`.

- Cluster: OpenShift 4.21.21 — `OBSERVED`.
- Namespace: `rh-ee-mpolo-dev` — `OBSERVED`.
- URL: <https://frontend-rh-ee-mpolo-dev.apps.rm1.0a51.p1.openshiftapps.com> — `OBSERVED`.
- Flujo sintetico crear/evaluar/consultar: `PASS` — `OBSERVED`.
- GitOps, OIDC corporativo, backup/restauracion y rollback dinamico:
  `PENDING_VALIDATION`.

## Inventario observado

| Componente | Recurso | Estado esperado/observado | Imagen |
|---|---|---|---|
| frontend | Deployment + Service + Route | 2/2 Ready | `frontend@sha256:e70b81258d722616b2a0debf6c103b972fb48261bd6259c8beb73d61cf981b15` |
| ingestion | Deployment + Service | 2/2 Ready | `ingestion@sha256:308ac0e0c363060a4b621ed34dcc236c36ce6c4bf6476e53cca85d9507e0ced7` |
| scoring | Deployment + Service | 2/2 Ready | `scoring@sha256:28e310ee6fa8040f5b75f65d3e38adea40b2be4e5b1982f79217a684c5e42fa9` |
| PostgreSQL | StatefulSet + Service + PVC `postgres-data` | 1/1 Ready, gp3 5 Gi | RHEL PostgreSQL 16 por digest |
| migraciones | Job `migrations` | Complete | misma imagen de ingestion |

Solo la Route del frontend es externa. Ingestion, scoring y PostgreSQL permanecen
internos. Los Secrets consumidos son `database-runtime`, `database-migrator`,
`ingestion-runtime`, `scoring-runtime` y `pii-keyring`; sus valores no fueron leidos
ni documentados.

## Desviaciones autorizadas

- Aplicacion directa desde el overlay declarativo porque la API Argo CD `Application`
  no esta disponible y la identidad no puede instalar operadores.
- Autenticacion `development` solo en el overlay dev; OIDC queda pendiente.
- PostgreSQL autogestionado de una replica para la prueba.
- Backup, restore, retention y reconciler declarados pero suspendidos en el fast path.

## Fallos encontrados y resolucion

1. Varias PipelineRuns fallaron por parametros Tekton, herramientas ausentes,
   workspaces RWO incompatibles y ausencia de metadata `.git`. Se corrigieron los
   contratos principales, pero el despliegue rapido no depende de esas ejecuciones.
2. La NetworkPolicy DNS que permitia solo puerto 53 produjo `ENOTFOUND postgres`.
   OpenShift requirio permitir tambien el puerto backend 5353; una prueba DNS desde un
   pod con las mismas labels confirmo la correccion.
3. Passwords de texto con salto de linea fueron interpretados de forma distinta por
   PostgreSQL y el cliente. Se rotaron sin exponer valores y se preservo el PVC.
4. La eliminacion del PVC fue rechazada por ser destructiva; se eligio rotacion local
   de roles, preservando cualquier dato existente.

## Verificacion segura

```bash
oc get deployment,statefulset,job,route,pvc -n rh-ee-mpolo-dev
oc rollout status deployment/frontend -n rh-ee-mpolo-dev
oc rollout status deployment/ingestion -n rh-ee-mpolo-dev
oc rollout status deployment/scoring -n rh-ee-mpolo-dev
scripts/platform/smoke --environment dev --namespace rh-ee-mpolo-dev
```

No usar este estado como evidencia de entrega productiva hasta reconciliarlo mediante
GitOps y verificar backup/restauracion, OIDC, promocion y rollback.
