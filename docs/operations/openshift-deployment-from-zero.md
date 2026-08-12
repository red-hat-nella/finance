# Despliegue de Finance2 desde cero en OpenShift

Esta guia describe el despliegue manual y declarativo de la aplicacion en el proyecto
OpenShift `rh-ee-mpolo-dev`. El proceso publica tres imagenes, prepara configuracion y
Secrets, inicia PostgreSQL, ejecuta las migraciones y solo entonces despliega los
microservicios y la Route.

```text
Navegador
   │ HTTPS
   ▼
Route → frontend → ingestion → scoring
                        │
                        ▼
                    PostgreSQL
```

Solo el frontend se expone fuera del namespace. Ingestion, scoring y PostgreSQL se
comunican mediante Services internos y NetworkPolicies.

> Este procedimiento corresponde al ambiente de prueba `dev`. Utiliza autenticacion
> de desarrollo y PostgreSQL autogestionado. GitOps, OIDC corporativo y backup no se
> consideran completados mediante esta guia.

## Camino corto con el repositorio preparado

Este camino se utiliza cuando las imagenes ya estan publicadas, los digests ya estan
registrados en el overlay y los Secrets ya existen en el namespace.

```bash
cd /home/mpolo/Documents/red-hat/projects/finance2

oc project rh-ee-mpolo-dev

# Validar contra la API real sin crear ni modificar recursos.
scripts/openshift/deploy.sh dry-run dev

# Desplegar en el orden correcto.
scripts/openshift/deploy.sh apply dev
```

Obtener la URL:

```bash
oc get route frontend \
  -n rh-ee-mpolo-dev \
  -o jsonpath='https://{.spec.host}{"\n"}'
```

URL observada durante la primera instalación:

<https://frontend-rh-ee-mpolo-dev.apps.rm1.0a51.p1.openshiftapps.com>

## Proceso completo desde cero

### 1. Entrar al repositorio y seleccionar el proyecto

```bash
cd /home/mpolo/Documents/red-hat/projects/finance2

oc whoami
oc project rh-ee-mpolo-dev
```

Definir las variables utilizadas por el procedimiento:

```bash
FINANCE_NS="rh-ee-mpolo-dev"
FINANCE_COMMIT="$(git rev-parse HEAD)"
FINANCE_LOCAL_REGISTRY="localhost/alternative-credit-scoring"
FINANCE_PUBLIC_REGISTRY="default-route-openshift-image-registry.apps.rm1.0a51.p1.openshiftapps.com"
FINANCE_PROJECT_REGISTRY="$FINANCE_PUBLIC_REGISTRY/$FINANCE_NS"
```

### 2. Construir las imagenes una sola vez

```bash
IMAGE_REGISTRY="$FINANCE_LOCAL_REGISTRY" \
IMAGE_TAG="$FINANCE_COMMIT" \
scripts/images/build.sh
```

Se construyen las imagenes de:

- `frontend`
- `ingestion`
- `scoring`

El script prueba ademas que las imagenes puedan ejecutarse con UID arbitrario y con
filesystem de solo lectura cuando el runtime lo permite.

### 3. Autenticarse en el registro integrado

```bash
oc whoami -t | podman login \
  --username "$(oc whoami)" \
  --password-stdin \
  "$FINANCE_PUBLIC_REGISTRY"
```

El token se transmite por entrada estandar y no se imprime ni se guarda en el
repositorio.

### 4. Publicar las imagenes

La opcion preferida utiliza el script de publicacion y conserva evidencia local:

```bash
IMAGE_REGISTRY="$FINANCE_LOCAL_REGISTRY" \
PUBLISH_REGISTRY="$FINANCE_PROJECT_REGISTRY" \
IMAGE_TAG="$FINANCE_COMMIT" \
scripts/images/publish.sh
```

Si se necesita realizar manualmente la misma operacion:

```bash
for component in frontend ingestion scoring; do
  podman tag \
    "$FINANCE_LOCAL_REGISTRY/$component:$FINANCE_COMMIT" \
    "$FINANCE_PROJECT_REGISTRY/$component:$FINANCE_COMMIT"

  podman push \
    "$FINANCE_PROJECT_REGISTRY/$component:$FINANCE_COMMIT"
done
```

Consultar las referencias inmutables asignadas por el registro:

```bash
for component in frontend ingestion scoring; do
  oc get imagestreamtag \
    "$component:$FINANCE_COMMIT" \
    -n "$FINANCE_NS" \
    -o jsonpath='{.image.dockerImageReference}{"\n"}'
done
```

La salida de cada componente debe terminar en `@sha256:<digest>`. Registrar esos
digests en:

```text
deploy/openshift/overlays/dev/kustomization.yaml
```

Ejemplo de la estructura requerida:

```yaml
images:
  - name: quay.io/finance2/frontend
    newName: image-registry.openshift-image-registry.svc:5000/rh-ee-mpolo-dev/frontend
    digest: sha256:<digest-frontend>
  - name: quay.io/finance2/ingestion
    newName: image-registry.openshift-image-registry.svc:5000/rh-ee-mpolo-dev/ingestion
    digest: sha256:<digest-ingestion>
  - name: quay.io/finance2/scoring
    newName: image-registry.openshift-image-registry.svc:5000/rh-ee-mpolo-dev/scoring
    digest: sha256:<digest-scoring>
```

No usar `latest` ni depender solamente del tag del commit para desplegar.

### 5. Crear los Secrets en una instalacion nueva

Este paso se ejecuta solo durante la primera instalacion. No se deben regenerar
passwords cuando ya exista una base de datos inicializada sin realizar antes una
rotacion coordinada de los roles PostgreSQL y sus consumidores.

Crear un directorio temporal y valores aleatorios:

```bash
FINANCE_SECRET_DIR="$(mktemp -d /tmp/finance2-secrets.XXXXXX)"

openssl rand -hex 32 | tr -d '\n' \
  > "$FINANCE_SECRET_DIR/database-password"

openssl rand -hex 32 | tr -d '\n' \
  > "$FINANCE_SECRET_DIR/database-migrator-password"

openssl rand -hex 32 | tr -d '\n' \
  > "$FINANCE_SECRET_DIR/scoring-service-token"

openssl rand -out "$FINANCE_SECRET_DIR/encryption-key-v1" 32
openssl rand -out "$FINANCE_SECRET_DIR/hmac-key-v1" 32

chmod 600 "$FINANCE_SECRET_DIR"/*
```

`tr -d '\n'` evita que PostgreSQL y las aplicaciones interpreten los passwords de
texto de forma diferente.

Crear los objetos Secret sin imprimir sus valores:

```bash
oc create secret generic database-runtime \
  -n "$FINANCE_NS" \
  --from-file=database-password="$FINANCE_SECRET_DIR/database-password"

oc create secret generic database-migrator \
  -n "$FINANCE_NS" \
  --from-file=database-migrator-password="$FINANCE_SECRET_DIR/database-migrator-password"

oc create secret generic ingestion-runtime \
  -n "$FINANCE_NS" \
  --from-file=database-password="$FINANCE_SECRET_DIR/database-password" \
  --from-file=scoring-service-token="$FINANCE_SECRET_DIR/scoring-service-token"

oc create secret generic scoring-runtime \
  -n "$FINANCE_NS" \
  --from-file=scoring-service-token="$FINANCE_SECRET_DIR/scoring-service-token"

oc create secret generic pii-keyring \
  -n "$FINANCE_NS" \
  --from-file=encryption-key-v1="$FINANCE_SECRET_DIR/encryption-key-v1" \
  --from-file=hmac-key-v1="$FINANCE_SECRET_DIR/hmac-key-v1"
```

Eliminar inmediatamente los archivos temporales:

```bash
rm -f \
  "$FINANCE_SECRET_DIR/database-password" \
  "$FINANCE_SECRET_DIR/database-migrator-password" \
  "$FINANCE_SECRET_DIR/scoring-service-token" \
  "$FINANCE_SECRET_DIR/encryption-key-v1" \
  "$FINANCE_SECRET_DIR/hmac-key-v1"

rmdir "$FINANCE_SECRET_DIR"
```

Nunca copiar estos valores al repositorio, consola, logs, documentación o chat.

### 6. Renderizar los manifiestos

```bash
oc kustomize deploy/openshift/overlays/dev \
  > /tmp/finance2-dev.yaml
```

El render contiene el estado deseado completo del ambiente dev, pero no contiene el
contenido de los Secrets.

### 7. Validar contra la API de OpenShift

```bash
oc apply \
  --dry-run=server \
  -f /tmp/finance2-dev.yaml \
  -n "$FINANCE_NS"
```

Esta operacion no despliega. Solo comprueba que los objetos y campos sean aceptados
por la version y las politicas actuales del cluster.

### 8. Ejecutar el despliegue ordenado

```bash
scripts/openshift/deploy.sh apply dev
```

El script automatiza esta secuencia:

1. Aplica ServiceAccounts, ConfigMaps, Services, NetworkPolicies, PVC y PostgreSQL.
2. Espera que el StatefulSet de PostgreSQL quede disponible.
3. Elimina cualquier Job de migracion anterior ya finalizado.
4. Crea un Job de migracion con la nueva imagen de ingestion.
5. Espera que la migracion termine correctamente.
6. Solo entonces aplica frontend, ingestion, scoring, CronJobs suspendidos y Route.
7. Espera los rollouts de scoring, ingestion y frontend.

La secuencia equivalente, resumida como comandos `oc`, es:

```bash
# Aplicar primero configuracion, red, Services, PVC y PostgreSQL.
oc apply -f <manifiestos-bootstrap>

oc rollout status statefulset/postgres \
  -n "$FINANCE_NS" \
  --timeout=5m

# Ejecutar la migracion como operacion finita y bloqueante.
oc delete job migrations \
  -n "$FINANCE_NS" \
  --ignore-not-found \
  --wait=true

oc apply -f <manifiesto-job-migrations>

oc wait \
  --for=condition=complete \
  job/migrations \
  -n "$FINANCE_NS" \
  --timeout=5m

# Aplicar los servicios de aplicacion y la Route.
oc apply -f <manifiestos-workloads>

oc rollout status deployment/scoring \
  -n "$FINANCE_NS" \
  --timeout=5m

oc rollout status deployment/ingestion \
  -n "$FINANCE_NS" \
  --timeout=5m

oc rollout status deployment/frontend \
  -n "$FINANCE_NS" \
  --timeout=5m
```

Los marcadores `<manifiestos-bootstrap>`, `<manifiesto-job-migrations>` y
`<manifiestos-workloads>` representan las secciones que el script extrae del render
Kustomize. Para evitar aplicar los recursos en un orden incorrecto, se recomienda
usar `scripts/openshift/deploy.sh apply dev`.

Si el Job de migracion falla, el script detiene el despliegue antes de actualizar los
microservicios. Consultar el fallo con:

```bash
oc logs job/migrations \
  -n "$FINANCE_NS" \
  --all-containers=true
```

No eliminar el PVC `postgres-data` para solucionar una migracion o un problema de
credenciales.

### 9. Obtener la URL desplegada

```bash
oc get route frontend \
  -n "$FINANCE_NS" \
  -o jsonpath='https://{.spec.host}{"\n"}'
```

La Route utiliza terminacion TLS `edge` y redirecciona HTTP hacia HTTPS.
















## Validaciones y pruebas posteriores al despliegue

Las siguientes comprobaciones se ejecutan al final. No forman parte de la creación
de recursos, pero son necesarias para demostrar que el despliegue funciona.

### 1. Validacion estatica del repositorio

```bash
scripts/platform/validate \
  --all \
  --cluster-version 4.21.21 \
  --evidence-dir /tmp/finance2-validation
```

### 2. Comprobar que el render no contenga Secrets ni tags mutables

```bash
if grep -q '^kind: Secret$' /tmp/finance2-dev.yaml; then
  echo "ERROR: el render contiene un objeto Secret" >&2
  exit 1
fi

if grep -Eq 'image:.*:(latest|dev|main)$' /tmp/finance2-dev.yaml; then
  echo "ERROR: el render contiene una imagen mutable" >&2
  exit 1
fi
```

### 3. Consultar el inventario y estado

```bash
oc get deployment,statefulset,job,cronjob,pvc,service,route \
  -n "$FINANCE_NS"
```

Resultado esperado para los workloads principales:

```text
frontend    2/2
ingestion   2/2
scoring     2/2
postgres    1/1
migrations  Complete
```

Las capacidades pospuestas deben permanecer suspendidas:

```bash
oc get cronjob postgres-backup retention reconciler \
  -n "$FINANCE_NS"
```

### 4. Confirmar los rollouts

```bash
oc rollout status statefulset/postgres \
  -n "$FINANCE_NS" \
  --timeout=5m

oc rollout status deployment/scoring \
  -n "$FINANCE_NS" \
  --timeout=5m

oc rollout status deployment/ingestion \
  -n "$FINANCE_NS" \
  --timeout=5m

oc rollout status deployment/frontend \
  -n "$FINANCE_NS" \
  --timeout=5m
```

### 5. Ejecutar el smoke test funcional

```bash
scripts/platform/smoke \
  --environment dev \
  --namespace "$FINANCE_NS" \
  --evidence build/platform/evidence/dev/smoke-live.json
```

El smoke test:

1. Crea una solicitud sintetica.
2. Ejecuta una evaluacion.
3. Comprueba el resultado determinista.
4. Consulta nuevamente la evaluacion.
5. Busca el registro en el historial.

Resultado esperado:

```text
functional smoke: PASS
```

## Estado y limitaciones de esta instalacion

- Aplicacion disponible para pruebas: `APP_AVAILABLE_FOR_TEST`.
- Metodo de entrega: `DIRECT_APPLY_DEVIATION`.
- GitOps y reconciliacion automatica: `PENDING_VALIDATION`.
- OIDC corporativo: `PENDING_VALIDATION`; dev usa autenticacion local.
- Backup y restauracion: `PENDING_VALIDATION`.
- `postgres-backup`, `retention` y `reconciler`: declarados pero suspendidos.

La evidencia de la primera instalacion se encuentra en
[`deployment-session-2026-08-10.md`](deployment-session-2026-08-10.md).
