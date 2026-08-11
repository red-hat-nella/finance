# Quickstart de validación: OpenShift y GitOps

**Feature**: `002-openshift-runtime-requirements`

**Proyecto dev descubierto**: `rh-ee-mpolo-dev`

**Estado actual**: artefactos estáticos implementados. La reconciliación dinámica sigue
`PENDING_VALIDATION` porque la API GitOps no está disponible en el clúster observado.

## Objetivo

Demostrar el recorrido `commit → pruebas → imágenes por digest → cambio GitOps →
reconciliación → migración/rollout → smoke → reporte`, además de persistencia y
rollback, sin pasos manuales ordinarios ni exposición de secretos.

## Prerrequisitos

- Node.js 22, npm, Python 3.12, `uv`, Podman, `oc`, `jq` y Kustomize mediante `oc`.
- Acceso de solo lectura al cluster para descubrimiento; acceso de bootstrap separado
  cuando corresponda.
- Proyecto dev `rh-ee-mpolo-dev` y OpenShift 4.21.21 observados.
- OpenShift Pipelines 1.23.1 observado; Pipelines as Code debe confirmarse.
- Un reconciliador GitOps aprobado. En el cluster observado la API de OpenShift GitOps
  está ausente, por lo que reconciliación permanece `PENDING_VALIDATION`.
- Referencias seguras descritas en `contracts/secret-references.md`; no exportar valores
  en terminal compartida ni pasarlos como argumentos.

## 1. Validar aplicación y contratos localmente

```bash
npm ci
make validate
CONTAINER_ENGINE=podman make smoke
```

Resultado esperado:

- contratos, migraciones, lint, unitarias, integración, autorización, E2E,
  accesibilidad, seguridad, imágenes y manifiestos pasan;
- el fixture sintético de riesgo medio produce score 634 y revisión manual;
- la caída y recuperación de scoring no publica un resultado parcial.

## 2. Descubrir sin leer Secrets

```bash
scripts/platform/discover --context current --namespace rh-ee-mpolo-dev \
  --output build/platform/dev-profile.json
```

Resultado esperado: el perfil valida contra
`contracts/platform-profile.schema.json`, registra OpenShift/APIs/cuotas/storage/RBAC y
marca cada dato como `OBSERVED` o `PENDING_VALIDATION`. El script usa una allowlist que
excluye `Secret`, kubeconfig y credenciales.

## 3. Renderizar y validar todos los ambientes

```bash
scripts/platform/render --all --output-dir build/rendered
scripts/platform/validate --all --cluster-version 4.21.21 \
  --evidence-dir build/platform/evidence/static
```

Resultado esperado:

- dev y production renderizan sin placeholders no tipados;
- dev usa `rh-ee-mpolo-dev`, PostgreSQL de desarrollo y `gp3` 5 Gi;
- producción no contiene StatefulSet/PVC PostgreSQL y requiere el contrato de DB
  administrada;
- imágenes promovidas están por digest, nunca `latest` o tag mutable;
- solo frontend tiene Route; seguridad, RBAC, Secret mounts y NetworkPolicies pasan;
- valores dinámicos no observables quedan `PENDING_VALIDATION`, no inventados.

## 4. Bootstrap autorizado, una sola vez

Bootstrap no es el flujo ordinario. Se ejecuta mediante una identidad revocable y deja
evidencia.

```bash
scripts/platform/bootstrap --profile build/platform/dev-profile.json \
  --preflight-only
```

El preflight comprueba permisos equivalentes a `oc auth can-i` para identidades de
descubrimiento, build/publicación y reconciliación. Después, un operador autorizado:

1. confirma que solo se administrarán recursos etiquetados para esta aplicación en
   `rh-ee-mpolo-dev`;
2. registra las referencias de secretos por canal seguro;
3. conecta el registro y Pipelines as Code si está disponible;
4. registra el repositorio de estado deseado en OpenShift GitOps o equivalente;
5. no instala operadores ni concede privilegios de cluster automáticamente.

## 5. Ejecutar CI sin reconstrucción

Un pull request ejecuta `inspect`, `test`, `secure` y `render`. El merge ejecuta build
secuencial de frontend, ingestion y scoring por la quota observada, publica cada imagen
una vez y registra digest/SBOM/scan.

```bash
oc -n rh-ee-mpolo-dev get pipelineruns.tekton.dev
oc -n rh-ee-mpolo-dev get pipelinerun.tekton.dev RELEASE_RUN \
  -o jsonpath='{.status.conditions[0].reason}{"\n"}'
```

Resultado esperado: `Succeeded`; el artefacto de release valida contra
`contracts/deployment-evidence.schema.json`. Sustituir `RELEASE_RUN` por una referencia
no sensible obtenida de la ejecución, nunca por un token.

## 6. Promover mediante GitOps

La pipeline abre un PR que cambia solo digests/configuración en el estado deseado. No
ejecuta `oc apply` contra los workloads ordinarios.

```bash
scripts/platform/render --environment dev --output-dir build/rendered/dev
scripts/platform/verify --environment dev --namespace rh-ee-mpolo-dev \
  --evidence-dir build/platform/evidence/dev --include-smoke
```

Resultado esperado después de reconciliación:

- migración completa antes del rollout;
- frontend, ingestion y scoring disponibles con 2 réplicas cada uno;
- Route HTTPS redirige HTTP y solo frontend está expuesto;
- conectividad positiva y negativa coincide con la matriz;
- el mismo digest de release figura en estado deseado y observado.

Si GitOps aún no está disponible, `verify` debe marcar reconcile/rollout/smoke como
`PENDING_VALIDATION`; render y validación estática continúan pasando.

## 7. Smoke funcional seguro

```bash
scripts/platform/smoke --environment dev --namespace rh-ee-mpolo-dev \
  --fixture tests/fixtures/medium-risk-application.json \
  --evidence build/platform/evidence/dev/smoke.json
```

Resultado esperado: crea una solicitud sintética única, evalúa, verifica score 634,
consulta detalle/histórico y elimina o anonimiza el fixture conforme al procedimiento
de prueba. El log conserva IDs opacos, no payload ni PII.

## 8. Persistencia, backup y restauración

```bash
scripts/platform/verify-persistence --namespace rh-ee-mpolo-dev
scripts/platform/verify-backup-restore --environment dev \
  --restore-target isolated --evidence build/platform/evidence/dev/restore.json
```

Resultado esperado:

- una solicitud/evaluación sintética sobrevive a recreación de pods de aplicación;
- el backup se ubica fuera del PVC de datos;
- restore aislado conserva esquema/integridad/autorización y supera smoke;
- no se restauran como activas identidades cuyo plazo de disposición venció;
- no se imprime ni copia el keyring PII.

Sin un destino de backup aprobado, la segunda prueba queda `PENDING_VALIDATION` y
producción no puede aceptarse.

## 9. Rollback

```bash
scripts/platform/rollback --environment dev --to-release HEALTHY_RELEASE \
  --propose-only
scripts/platform/verify --environment dev --namespace rh-ee-mpolo-dev \
  --include-smoke --evidence-dir build/platform/evidence/dev-rollback
```

Resultado esperado: se propone revertir GitOps a digests/configuración ya saludables,
el reconciliador aplica la revisión y el smoke pasa sin reconstrucción. Si el esquema
no admite N-1, el comando bloquea el rollback ordinario y enlaza la recuperación de
datos aprobada.

## 10. Documentación y reporte

```bash
scripts/platform/generate-operations-doc --render-root build/rendered \
  --cluster-profile build/platform/dev-profile.json \
  --output docs/operations/openshift-deployment.md
scripts/platform/validate-operations-doc docs/operations/openshift-deployment.md
```

Resultado esperado: inventario, URLs, imágenes, réplicas, datos, identidades, red,
GitOps, observabilidad y procedimientos están actualizados y cada valor es `DECLARED`,
`OBSERVED` o `PENDING_VALIDATION`. La validación falla ante secretos o afirmaciones sin
fuente.

## Limpieza

Los fixtures y pods efímeros de prueba se eliminan mediante el propio pipeline. No se
elimina el proyecto compartido ni recursos ajenos. El rollback/cleanup se limita a
recursos con labels de la aplicación y revisión de evidencia correspondiente.
