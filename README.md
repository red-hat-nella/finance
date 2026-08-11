# Aplicacion de Scoring Crediticio Alternativo

MVP de apoyo a analistas de credito para registrar datos alternativos, calcular un
score determinista y explicable y consultar evaluaciones historicas. La recomendacion
es orientativa y nunca representa una aprobacion crediticia automatica definitiva.

## Arquitectura

```text
Navegador
   |
   v
frontend (puerto 8080 / unica Route publica)
   |
   v
ingestion (API publica interna, persistencia y orquestacion)
   |                         |
   v                         v
scoring (API interna)     PostgreSQL
```

| Directorio | Responsabilidad |
|---|---|
| `frontend/` | Angular y Angular Material; formulario, resultado, historico y auditoria |
| `services/ingestion/` | API publica, validacion, cifrado PII, persistencia y orquestacion |
| `services/scoring/` | Motor interno determinista; recibe datos normalizados sin PII |
| `db/migrations/` | Esquema PostgreSQL versionado e idempotente |
| `deploy/local/` | Topologia Docker Compose y Podman Compose |
| `deploy/openshift/` | Base y overlays Kustomize para OpenShift |
| `.tekton/` | Tasks, Pipeline y disparadores Pipelines as Code |
| `deploy/gitops/` | Bootstrap namespace-scoped y estado GitOps declarado |
| `scripts/platform/` | Descubrimiento, render, validación, verificación y recuperación |
| `specs/001-alternative-credit-scoring/` | Constitucion, spec, plan, contratos, tareas y evidencia |
| `specs/002-openshift-runtime-requirements/` | Diseño y contratos de operación OpenShift |

## Requisitos

Para ejecutar solo con contenedores:

- Docker Engine con Compose v2, o Podman 5 con un proveedor Compose.
- Node.js 22 y npm para generar secretos y JWT locales.
- `openssl`, `curl`, `jq` y GNU Make.

Para validacion completa se requieren tambien Python 3.12, `uv` y Chromium de
Playwright. Para OpenShift se requieren `oc`, Podman para construir/publicar las
imagenes y permisos sobre un proyecto para Route, Deployment, Service, ConfigMap,
Secret, StatefulSet, PVC, Job, CronJob y NetworkPolicy.

Instale las dependencias usadas por los scripts locales:

```bash
npm ci
```

## Configuracion y secretos locales

Prepare las variables no sensibles y genere secretos distintos para cada funcion:

```bash
cp deploy/local/.env.example deploy/local/.env
./scripts/dev/init-local-secrets.sh
```

El segundo comando genera archivos ignorados por Git bajo
`deploy/local/.secrets/`, con passwords de PostgreSQL, claves de cifrado/HMAC, token
ingestion-scoring y un emisor JWT exclusivo para desarrollo. No reutilice esos
valores fuera de la demo.

### Variables no sensibles

| Variable | Componente | Ejemplo / proposito |
|---|---|---|
| `FRONTEND_PORT` | Compose | Puerto publicado; `8080` por defecto |
| `API_BASE_URL` | frontend | Ruta same-origin; `/api/v1` |
| `AUTH_MODE` | frontend | `development` local; `oidc` en OpenShift |
| `OIDC_ISSUER` | frontend | Issuer OIDC visible para el navegador |
| `OIDC_CLIENT_ID` | frontend | Cliente publico OIDC |
| `OIDC_SCOPE` | frontend | `openid profile` |
| `PORT` | ingestion/scoring | Puerto interno `8080` |
| `DATABASE_HOST` | ingestion/jobs | DNS de PostgreSQL |
| `DATABASE_PORT` | ingestion/jobs | `5432` |
| `DATABASE_NAME` | ingestion/jobs | `alternative_scoring` |
| `DATABASE_USER` | ingestion/jobs | Rol de minimo privilegio |
| `DATABASE_SSL_MODE` | ingestion/jobs | `disable` local; `require` o `verify-full` productivo |
| `SCORING_BASE_URL` | ingestion | `http://scoring:8080` |
| `SCORING_TIMEOUT_MS` | ingestion | Timeout interno; `750` |
| `SCORING_CRITERIA_VERSION` | ingestion | `SCORING-MVP-1.0.0` |
| `CRITERIA_VERSION` | scoring | Misma version activa del criterio |
| `AUTH_ISSUER` | ingestion | Issuer OIDC que firma el JWT |
| `AUTH_JWKS_URL` | ingestion | JWKS del issuer |
| `AUTH_AUDIENCE` | ingestion | `alternative-credit-scoring` |
| `AUTH_ALLOWED_ALGORITHMS` | ingestion | `RS256` |
| `CORS_ALLOWED_ORIGINS` | ingestion | Vacio con proxy same-origin; lista explicita si aplica |
| `PII_KEY_VERSION` | ingestion | Version de la clave activa; inicia en `1` |
| `RETENTION_BATCH_SIZE` | retention | Filas por lote; `500` |
| `LOG_LEVEL` | servicios | `info` |

### Secretos

Los servicios productivos exigen referencias separadas montadas como archivos. El
contrato completo vive en
`specs/002-openshift-runtime-requirements/contracts/secret-references.md`:

| Key | Consumidor |
|---|---|
| `ingestion-runtime` | Solo password runtime, claves PII actuales y token de scoring |
| `scoring-runtime` | Solo token de scoring |
| `database-migrator` | Password del schema owner acotado; no superusuario |
| `database-retention` | Password exclusivo de retención |
| `database-runtime` | Password runtime para ingestion/reconciler y PostgreSQL dev |
| `database-tls` | CA para PostgreSQL externo con `verify-full` |
| `pii-keyring` | Referencias versionadas para rotación/lectura histórica |

Nunca ponga esos valores en `.env`, ConfigMaps, manifiestos, prompts de Spec Kit,
logs o pull requests.

## Ejecutar con Docker Compose

```bash
./scripts/dev/compose.sh docker up --build --wait
```

Abra `http://localhost:8080`. Solo el frontend publica un puerto; ingestion,
scoring y PostgreSQL permanecen en redes internas.

Comandos operativos:

```bash
./scripts/dev/compose.sh docker ps
./scripts/dev/compose.sh docker logs -f frontend ingestion scoring
./scripts/smoke/local-health.sh docker
./scripts/dev/compose.sh docker down --volumes --remove-orphans
./scripts/dev/clean-local-secrets.sh
```

## Ejecutar con Podman Compose

Podman delega Compose a `podman-compose` u otro proveedor compatible. El wrapper
crea los secretos de Podman desde los archivos locales antes de iniciar:

```bash
./scripts/dev/compose.sh podman up --build -d
./scripts/smoke/local-health.sh podman
```

Abra `http://localhost:8080`. Para detener y limpiar:

```bash
./scripts/dev/compose.sh podman down --volumes --remove-orphans
./scripts/dev/clean-local-secrets.sh
```

Los jobs no permanecen expuestos. Para ejecutar retencion manualmente en la demo:

```bash
./scripts/dev/compose.sh podman --profile jobs run --rm retention
# Sustituya podman por docker si usa Docker Compose.
```

## Salud, autenticacion y pruebas

```bash
curl --fail --silent http://localhost:8080/health/live | jq .
curl --fail --silent http://localhost:8080/health/ready | jq .
TOKEN="$(./scripts/dev/issue-token.sh credit_analyst)"
```

Use solo fixtures sinteticos de `tests/fixtures/`. La validacion integral reproduce
contratos, migraciones, unitarias, integracion, E2E, responsive, WCAG AA, seguridad,
imagenes y manifiestos:

```bash
CONTAINER_ENGINE=podman make validate
# o
CONTAINER_ENGINE=docker make validate
```

Comandos mas acotados:

```bash
make contracts
make validate-foundation
make visual
make acceptance
make manifests
```

El quickstart detallado de API, fixtures, fallos y verificacion visual esta en
[`specs/001-alternative-credit-scoring/quickstart.md`](specs/001-alternative-credit-scoring/quickstart.md).

## Entrega declarativa en OpenShift

El destino de desarrollo confirmado es `rh-ee-mpolo-dev`. No se crea ni elimina el
proyecto compartido y solo se administran recursos etiquetados para esta aplicación.
El overlay productivo permanece parametrizado y no contiene PostgreSQL local.

La validación estática funciona sin acceso al clúster:

```bash
scripts/platform/render --all --output-dir build/rendered
scripts/platform/validate --all --cluster-version 4.21.21 \
  --evidence-dir build/platform/evidence/static
```

El descubrimiento y preflight son de solo lectura y excluyen Secrets:

```bash
scripts/platform/discover --context current --namespace rh-ee-mpolo-dev \
  --output build/platform/dev-profile.json
scripts/platform/bootstrap --profile build/platform/dev-profile.json \
  --preflight-only
```

El flujo ordinario está definido en `.tekton/pipeline.yaml`: inspecciona, prueba,
analiza, construye secuencialmente las tres imágenes una sola vez, publica los mismos
artefactos, abre una propuesta GitOps, verifica y reporta. Los overlays solo aceptan
digests. Ninguna Task aplica directamente los workloads ni escribe en una rama
protegida.

`deploy/gitops/applications/` contiene el estado declarado. En el clúster observado la
API `argoproj.io/Application` no está instalada; por eso reconciliación, rollout y
smoke dinámicos permanecen `PENDING_VALIDATION` hasta que la organización habilite
OpenShift GitOps o un reconciliador equivalente. No se instala ningún operador desde
este repositorio.

## De Spec Driven Development a despliegue automatico

Spec Kit organiza la definicion y la implementacion, pero no es por si mismo un
motor CI/CD. El despliegue sin intervencion del cliente requiere conectar los
artefactos producidos por SDD con un golden path de plataforma:

```text
Red Hat Developer Hub Software Template
  -> repositorio con Spec Kit + contratos + Dockerfiles + manifiestos + pipeline
  -> pull request
  -> OpenShift Pipelines / Pipelines as Code (CI)
       validate -> test -> build -> SBOM -> scan -> push por digest
       -> pull request al repositorio GitOps
  -> OpenShift GitOps / Argo CD (CD)
       sincroniza dev -> staging -> produccion segun aprobaciones
```

Red Hat Developer Hub permite que el equipo de plataforma entregue ese golden path
como formulario de autoservicio. OpenShift Pipelines ejecuta CI desde definiciones
Tekton versionadas en `.tekton/`; OpenShift GitOps observa el repositorio de estado
deseado y reconcilia el cluster. Quay puede almacenar y escanear las imagenes.

### Que adjuntar en cada paso de Spec Kit

| Paso | Adjuntar / indicar | Resultado que debe exigir |
|---|---|---|
| `speckit.constitution` | Politicas de plataforma: OpenShift, GitOps, secretos, SBOM, probes, recursos, restricted-v2, no `latest` | Principios no negociables y gates de release |
| `speckit.specify` | Problema, actores, flujos, datos, errores, UX y criterios medibles; no credenciales ni detalles del cluster | `spec.md` orientado al que y por que |
| `speckit.clarify` | Respuestas de alcance, privacidad, disponibilidad y experiencia que bloqueen implementacion | Spec sin decisiones criticas abiertas |
| `speckit.plan` | Perfil de plataforma no secreto, stack permitido, registro logico, estrategia GitOps, entornos, contratos de observabilidad | Dockerfiles, contratos, modelo, Kustomize/Helm, quickstart y estrategia de validacion |
| `speckit.tasks` | No agregue requisitos nuevos; use spec, plan y contratos ya aprobados | Tareas explicitas para app, pruebas, imagenes, `.tekton`, GitOps y documentacion |
| `speckit.analyze` | Spec, plan y tasks generados | Cobertura y consistencia antes de escribir codigo |
| `speckit.implement` | `tasks.md` aprobado y acceso solo a herramientas de desarrollo | Codigo y artefactos; nunca tokens productivos |
| Pull request | Evidencia del gate, SBOM, digests y cambio de manifiestos | Pipelines as Code decide si puede integrarse |
| Promocion | PR al repositorio GitOps con digests inmutables | Argo CD despliega; produccion conserva aprobacion humana si la politica lo exige |

Un perfil de plataforma reutilizable para adjuntar a `speckit.plan` puede ser. Todos
sus productos opcionales son capacidades por descubrir o configurar, no instalaciones
que puedan asumirse:

```yaml
platform: openshift
runtimeSecurityContext: restricted-v2
delivery:
  ci: openshift-pipelines
  cd: openshift-gitops
  registry: quay
  imageReference: digest
environments: [dev, staging, production]
publicExposure: frontend-route-only
dataService: derived-from-application-and-confirmed-capabilities
secrets: external-secret-reference-only
requiredArtifacts:
  - Dockerfile-per-service
  - health-and-readiness-probes
  - resource-requests-and-limits
  - kustomize-overlays
  - network-policies
  - migration-job
  - sbom-and-vulnerability-gate
```

El perfil describe capacidades, no URLs privadas, kubeconfigs o tokens. La plataforma
inyecta esos datos en CI mediante ServiceAccounts y Secrets administrados.

### Division de responsabilidades

El cliente debe aportar requisitos, reglas de negocio, contratos externos y aprobar
los resultados. El equipo de plataforma mantiene la plantilla de Developer Hub, las
Tasks/Pipelines Tekton, el repositorio GitOps, RBAC, secretos, registry, observabilidad
y politicas de promocion. Asi cada proyecto hereda despliegue y cumplimiento sin que
el cliente tenga que aprender los detalles del cluster.

### Estado de plataforma documentado

| Estado | Recursos / capacidades |
|---|---|
| Deseado y versionado | Imágenes, gates, manifiestos Kustomize, configuración, referencias de secretos y overlays OpenShift |
| Confirmado en cluster | OpenShift 4.21.21, proyecto `rh-ee-mpolo-dev`, Pipelines 1.23.1, API Tekton v1, StorageClass `gp3` y cuotas suficientes |
| Declarado y validado estáticamente | Base/componentes/overlays Kustomize, Pipeline y Tasks Tekton, Applications GitOps, políticas, perfiles, evidencia offline y rollback propuesto |
| Pendiente de validación | Controlador/repo GitOps aprobado, Pipelines as Code operativo, registro publicable, OIDC, dominio, DB/CA/CIDR/backup productivos y aprobación de producción |

El flujo imperativo anterior no demuestra reconciliación GitOps ni constituye una
entrega productiva terminada. La automatización empresarial debe incorporar los
artefactos pendientes desde el golden path aprobado. Ningún documento debe afirmar que
un recurso existe hasta confirmarlo mediante inspección autorizada de solo lectura que
no consulte Secrets.

Documentacion oficial:

- [GitHub Spec Kit](https://github.com/github/spec-kit)
- [Red Hat Developer Hub: Software Templates](https://docs.redhat.com/en/documentation/red_hat_developer_hub/1.9/html/customizing_red_hat_developer_hub/configuring-templates)
- [Red Hat OpenShift Pipelines](https://docs.redhat.com/en/documentation/red_hat_openshift_pipelines/1.20)
- [Red Hat OpenShift GitOps](https://docs.redhat.com/en/documentation/red_hat_openshift_gitops/1.19/html/understanding_openshift_gitops/about-redhat-openshift-gitops)
- [Red Hat Quay: vulnerability scanning](https://docs.redhat.com/en/documentation/red_hat_quay/3.15/html/use_red_hat_quay/security-scanning)
