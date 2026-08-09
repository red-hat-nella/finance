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
| `specs/001-alternative-credit-scoring/` | Constitucion, spec, plan, contratos, tareas y evidencia |

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

Los servicios productivos exigen secretos montados como archivos. El Secret
OpenShift `scoring-secrets` debe contener exactamente:

| Key | Consumidor |
|---|---|
| `database-admin-password` | Job de migraciones |
| `database-password` | ingestion y reconciler |
| `database-retention-password` | migraciones y retention |
| `pii-encryption-key` | ingestion; 32 bytes aleatorios |
| `pii-hmac-key` | ingestion; 32 bytes aleatorios e independientes |
| `scoring-service-token` | ingestion y scoring; minimo 32 caracteres |

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

## Despliegue imperativo de la demo en OpenShift

Este flujo existe para validación local, bootstrap o demostraciones aisladas. NO es el
mecanismo de despliegue ordinario exigido por la constitución: los ambientes compartidos
DEBEN reconciliarse desde GitOps con imágenes inmutables referenciadas por digest.

### 1. Preparar proyecto y registro

```bash
oc login https://api.CLUSTER:6443
oc get namespace alternative-scoring-dev >/dev/null 2>&1 || \
  oc create namespace alternative-scoring-dev

REGISTRY="$(oc registry info)"
podman login -u "$(oc whoami)" -p "$(oc whoami -t)" "$REGISTRY"
```

Si el registro integrado no tiene una Route accesible desde su equipo, un
administrador debe exponerlo o se debe usar Red Hat Quay y ajustar `newName` en el
overlay.

### 2. Construir, escanear y publicar imagenes

```bash
IMAGE_REGISTRY="$REGISTRY/alternative-scoring-dev" \
IMAGE_TAG=1.0.0 ./scripts/images/build.sh

IMAGE_REGISTRY="$REGISTRY/alternative-scoring-dev" \
IMAGE_TAG=1.0.0 ./scripts/images/scan.sh

IMAGE_REGISTRY="$REGISTRY/alternative-scoring-dev" \
IMAGE_TAG=1.0.0 ./scripts/images/build.sh --push
```

El overlay `dev` referencia esas imagenes por el DNS interno del registro. Cambie el
tag en el overlay cuando publique otra version; no use `latest`.

### 3. Configurar identidad y secretos

Antes del despliegue, sustituya los dominios `identity.example.test` mediante un
overlay propio o parches Kustomize con los valores de Red Hat build of Keycloak,
Red Hat Single Sign-On u otro proveedor OIDC:

- `frontend-config.OIDC_ISSUER` y `OIDC_CLIENT_ID`;
- `ingestion-config.AUTH_ISSUER`, `AUTH_JWKS_URL` y `AUTH_AUDIENCE`.

Para una demo, puede cargar los secretos aleatorios generados localmente:

```bash
./scripts/dev/init-local-secrets.sh
./scripts/openshift/create-secrets.sh alternative-scoring-dev
```

En un entorno compartido o productivo, cree `scoring-secrets` desde el gestor de
secretos aprobado por la organizacion. No use el generador local ni comprometa un
`Secret` con `stringData` real.

### 4. Renderizar, validar y aplicar

```bash
./scripts/openshift/deploy.sh render dev > /tmp/alternative-scoring-dev.yaml
./scripts/openshift/deploy.sh dry-run dev
./scripts/openshift/deploy.sh diff dev || true
./scripts/openshift/deploy.sh apply dev
```

`apply` crea el namespace si hace falta, aplica recursos base, espera PostgreSQL,
ejecuta las migraciones como gate y solo despues despliega scoring, ingestion y
frontend. Verifique:

```bash
oc -n alternative-scoring-dev get pods,deploy,svc,route,jobs,cronjobs
oc -n alternative-scoring-dev get route frontend \
  -o jsonpath='https://{.spec.host}{"\n"}'
oc -n alternative-scoring-dev rollout status deploy/frontend
oc -n alternative-scoring-dev rollout status deploy/ingestion
oc -n alternative-scoring-dev rollout status deploy/scoring
```

El overlay `production` expresa estado deseado no confirmado: elimina PostgreSQL de demo y usa el `ExternalName`
`postgresql.production.internal`. Antes de usarlo se deben cambiar el registry, host
de base de datos, TLS, OIDC, namespaces, recursos y egress de acuerdo con el entorno
real.

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
| Confirmado en cluster | Ninguno en esta documentación; no se realizó inspección autorizada del cluster |
| Pendiente de validación | Versión OpenShift, operadores, StorageClasses, registry, ingress, gestor de secretos, dominios, namespaces y políticas corporativas |
| Pendiente de implementación | `.tekton/`, publicación por digest, actualización GitOps, `Application` de Argo CD o equivalente, promoción, reconciliación y rollback automatizados |

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
