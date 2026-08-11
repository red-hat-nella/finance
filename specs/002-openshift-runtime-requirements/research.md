# Investigación: ejecución operativa en OpenShift

**Fecha**: 2026-08-09
**Spec**: `specs/002-openshift-runtime-requirements/spec.md`

## Fuentes y límites

La investigación inspeccionó la especificación, constitución, contratos OpenAPI,
modelo de datos, código, Dockerfiles, Compose, manifiestos, migraciones y pruebas. El
cluster se consultó con `kubernetes-mcp-server@latest` v0.0.66, inicialmente con
`--read-only`, sin invocar `configuration_view` ni consultar Secrets. Las comprobaciones
`oc auth can-i` fueron de solo lectura. La única escritura intentada fue crear el
proyecto solicitado; RBAC la rechazó y el usuario autorizó usar `rh-ee-mpolo-dev`.

## Decisión 1: topología derivada de la aplicación

**Decision**: conservar tres servicios de larga duración (`frontend`, `ingestion` y
`scoring`), un proceso finito de migraciones, dos procesos programados (`retention` y
`reconciler`), PostgreSQL durable y el IdP OIDC externo. No agregar cache, cola, broker,
almacenamiento de objetos ni workers permanentes sin nueva evidencia.

**Rationale**: los comandos, contratos y ciclos de vida aparecen de forma independiente
en `frontend/`, `services/ingestion/`, `services/scoring/`, `db/migrations/` y
`deploy/local/compose.yaml`.

**Alternatives considered**: fusionar servicios en un monolito; separar cada módulo de
ingestion; agregar una cola para scoring. Todas cambian fronteras reales sin necesidad.

**Consequences and validation evidence**: tres Deployments reemplazables, un Job de
migración, dos CronJobs y solo una Route. Las pruebas deben impedir frontend→scoring,
acceso externo a servicios internos y jobs concurrentes.

## Decisión 2: mapeo OpenShift y disponibilidad inicial

**Decision**: usar Deployments de dos réplicas para frontend, ingestion y scoring;
Services ClusterIP internos; Route TLS solo para frontend; Job versionado para
migraciones; CronJobs con `Forbid` para retención y reconciliación. Añadir PDB con
`minAvailable: 1` a los tres Deployments. No añadir HPA ni afinidad obligatoria hasta
obtener métricas de carga/topología.

**Rationale**: los servicios son stateless respecto de sus pods y las cuotas de
`rh-ee-mpolo-dev` admiten los requests actuales. Dos réplicas permiten rollout y una
interrupción voluntaria sin indisponibilidad completa.

**Alternatives considered**: una réplica para reducir consumo; HPA por CPU; topology
spread rígido. La primera debilita rollout; las otras carecen de evidencia o dominios
de fallo confirmados.

**Consequences and validation evidence**: requests actuales se conservan como baseline
ajustable. La aceptación mide uso real antes de habilitar autoscaling.

## Decisión 3: PostgreSQL por ambiente

**Decision**: PostgreSQL es obligatorio. Desarrollo usa temporalmente una instancia
autogestionada de una réplica con 5 Gi `gp3` para validar integración. Staging y
producción requieren, por orden, servicio corporativo, administrado u operador
soportado confirmado. El fallback autogestionado fuera de desarrollo exige aprobación
y una estrategia completa de alta disponibilidad y backup.

**Rationale**: el modelo transaccional, auditoría, idempotencia y retención dependen de
PostgreSQL. El cluster confirmó `gp3` como StorageClass por defecto, pero no confirmó un
operador PostgreSQL. El overlay productivo ya elimina la base local.

**Alternatives considered**: StatefulSet en todos los ambientes; base efímera; operador
asumido. Contradicen recuperación o capacidades reales.

**Consequences and validation evidence**: el contrato de datos abstrae host/TLS/CA y
credenciales. La base de desarrollo no se presenta como diseño productivo.

## Decisión 4: backup, restauración y objetivos iniciales

**Decision**: adoptar como default ajustable RPO de 24 horas y RTO de 4 horas para el
MVP. El servicio administrado debe demostrar backups cifrados y restauración aislada.
El fallback autogestionado requiere backup lógico o físico a almacenamiento externo al
PVC de datos; un segundo PVC no constituye recuperación ante pérdida del cluster.

**Rationale**: no existe SLO contractual y el repositorio carece de implementación o
prueba de backup. Los datos durables y su retención hacen obligatoria la recuperación.

**Alternatives considered**: snapshots sin prueba; backup en el mismo PVC; bloquear el
plan hasta recibir RPO/RTO. Ninguna satisface verificabilidad y autonomía.

**Consequences and validation evidence**: restauración periódica a destino aislado,
verificación de esquema, conteos, autorización y smoke test. La retención de backups no
puede reintroducir datos ya dispuestos.

## Decisión 5: migraciones expand/contract y privilegios

**Decision**: separar provisión inicial de roles de base de datos del Job ordinario de
migraciones. El bootstrap autorizado crea roles/credenciales según el contrato del
proveedor; cada release ejecuta migraciones con un rol de schema-owner acotado, advisory
lock, checksum, deadline y evidencia. Los cambios siguen expand/contract y soportan
aplicación N y N-1 durante rollout/rollback.

**Rationale**: el Job actual usa `postgres` y algunas migraciones crean roles, algo que
servicios administrados suelen restringir. `schema_migrations` evita repetir archivos,
pero aún no prueba checksum ni concurrencia.

**Alternatives considered**: migrar al arrancar cada réplica; conservar superusuario en
runtime; down migrations automáticas. Elevan privilegios y riesgo concurrente.

**Consequences and validation evidence**: una migración destructiva requiere release en
dos pasos y backup verificado; si el esquema no admite N-1, no se permite rollback de
aplicación hasta ejecutar la estrategia de recuperación aprobada.

## Decisión 6: mínimo privilegio y secretos separados

**Decision**: mantener ServiceAccounts dedicadas y separar además `postgres`,
`migrations`, `retention` y `reconciler`; declarar
`automountServiceAccountToken: false` cuando el pod no use la API. Dividir el Secret
agregado por consumidor y montar únicamente keys proyectadas. External Secrets se usa
solo si aparece una API aprobada; el fallback conserva contratos de Secret creados por
canal seguro.

**Rationale**: el cluster no expone External Secrets y el Secret actual permite que
workloads lean credenciales que no consumen. Ningún workload de aplicación necesita
RBAC Kubernetes.

**Alternatives considered**: un Secret y SA compartidos; tokens personales; secretos
versionados. Contradicen mínimo privilegio.

**Consequences and validation evidence**: `oc auth can-i` por identidad de bootstrap,
build y reconciliación; escaneo del repo, manifiestos renderizados, resultados y logs.

## Decisión 7: seguridad de pod y filesystem

**Decision**: conservar `runAsNonRoot`, UID arbitrario, `RuntimeDefault`,
`allowPrivilegeEscalation: false` y `drop: [ALL]`. Frontend, ingestion, scoring y jobs
usan root filesystem de solo lectura más `emptyDir` acotados. PostgreSQL documenta la
excepción de filesystem escribible únicamente en data/tmp.

**Rationale**: Dockerfiles y pruebas actuales ya funcionan con UID arbitrario. La base
necesita escritura durable real.

**Alternatives considered**: UID fijo, contenedores privilegiados o filesystem
completamente escribible. No son necesarios.

**Consequences and validation evidence**: prueba de imagen con UID aleatorio y read-only,
validación de políticas en cada overlay y ejecución bajo SCC restringida.

## Decisión 8: red y TLS

**Decision**: default-deny; DNS permitido; router→frontend; frontend→ingestion;
ingestion→scoring, DB e IdP/JWKS; jobs→DB. Restringir los egress 443 y 5432 actuales a
destinos descubiertos mediante patches tipados. PostgreSQL externo exige TLS
`verify-full`, CA por referencia y hostname verificable.

**Rationale**: coincide con los contratos y evita Routes internas. Los CIDR abiertos
actuales son placeholders, no política final.

**Alternatives considered**: egress libre, service mesh obligatorio o Route por API.
La primera es insegura y las otras no están justificadas/confirmadas.

**Consequences and validation evidence**: pruebas positivas y negativas desde pods de
test efímeros, TLS/DNS de Route y certificado DB.

## Decisión 9: imágenes, CI y promoción

**Decision**: OpenShift Pipelines/Pipelines as Code es el default para CI porque el
namespace muestra reconciliación Pipelines 1.23.1 y `tekton.dev/v1` está disponible.
Cada una de las tres imágenes se construye una sola vez, genera SBOM, se escanea, se
publica y se registra por digest. Dev, staging y producción promueven esos mismos
digests.

**Rationale**: los scripts actuales ya prueban, construyen con bases por digest y generan
SBOM, pero los overlays usan tags y no existe pipeline declarativo.

**Alternatives considered**: reconstruir por ambiente; CI externo aprobado; tags
versionados sin digest. CI externo sigue siendo alternativa si implementa las mismas
puertas; las otras rompen identidad inmutable.

**Consequences and validation evidence**: pipeline `inspect → test → secure → build →
render → publish → promote → reconcile → verify → report`; ninguna tarea escribe
directamente una rama protegida ni aplica workloads ordinarios con `oc apply`.

## Decisión 10: GitOps con capacidad ausente

**Decision**: versionar el estado deseado y contratos de `Application`/`ApplicationSet`
para OpenShift GitOps, pero no instalarlos en el cluster actual. Hasta que la
organización proporcione un controlador aprobado, el plan entrega renderizado y
validación completa y marca reconciliación dinámica como `PENDING_VALIDATION`.

**Rationale**: `argoproj.io/v1alpha1 Application` no existe en el cluster accesible y no
se autoriza instalar operadores ni otorgar privilegios de cluster.

**Alternatives considered**: pipeline aplicando YAML directamente; instalar Argo CD;
declarar GitOps disponible sin evidencia. Todas contradicen la constitución o autoridad.

**Consequences and validation evidence**: bootstrap registra repo, proyecto y
credenciales revocables cuando exista controlador. Operación continua permanece GitOps.

## Decisión 11: ambientes y proyecto descubierto

**Decision**: usar `rh-ee-mpolo-dev` para desarrollo. Añadir overlays staging y
production parametrizados porque una aplicación financiera necesita validar migración,
restauración y rollback antes de producción. Sus namespaces, dominios y repositorios
son entradas externas de bootstrap.

**Rationale**: el usuario autorizó el proyecto existente después de que RBAC rechazó
crear `alternative-scoring-dev`. El namespace tiene cuotas, LimitRange, Pipelines y
StorageClass suficientes; también contiene workloads ajenos que no se modificarán.

**Alternatives considered**: crear namespace propio; usar el proyecto `claw`; omitir
staging. Las dos primeras no están autorizadas y la última reduce evidencia previa a
producción.

**Consequences and validation evidence**: nombres y labels con prefijo/part-of evitan
colisiones. El inventario pre-bootstrap confirma que solo se administran recursos
etiquetados por esta aplicación.

## Decisión 12: documentación generada como evidencia

**Decision**: generar `docs/operations/openshift-deployment.md` desde perfiles y
manifiestos renderizados, y enriquecerlo con consultas de solo lectura. Cada valor lleva
estado `DECLARED`, `OBSERVED` o `PENDING_VALIDATION`, fuente y fecha.

**Rationale**: no se debe confundir intención con estado observado. Actualmente no
existe documentación operativa generada ni workloads de la aplicación desplegados en
`rh-ee-mpolo-dev`.

**Alternatives considered**: documentación manual o solo salida de `oc get`. Ambas se
desincronizan o carecen de intención declarativa.

**Consequences and validation evidence**: el pipeline falla si cambian topología,
endpoints o manifiestos sin regenerar/verificar documentación, o si detecta secretos.

## Descubrimiento del cluster

| Capacidad | Estado | Fuente no sensible | Resultado |
|-----------|--------|---------------------|-----------|
| Versión OpenShift | DISCOVERED | MCP `ClusterVersion/version` | 4.21.21, disponible |
| Proyecto/contexto dev | DISCOVERED | MCP `projects_list`, `oc config current-context` + decisión del usuario | proyecto `rh-ee-mpolo-dev`; contexto `rh-ee-mpolo-dev/api-rm1-0a51-p1-openshiftapps-com:6443/rh-ee-mpolo` |
| Crear namespaces/proyectos | DISCOVERED | MCP create + `oc auth can-i` | Denegado |
| Workloads app en dev | DISCOVERED | `oc get` namespaced | Ninguno; existen recursos ajenos que no se tocarán |
| OpenShift Pipelines | DISCOVERED | labels de Project + API `tekton.dev/v1` | 1.23.1 disponible |
| OpenShift GitOps | DISCOVERED | consulta API `argoproj.io` | API ausente |
| External Secrets | DISCOVERED | consulta API `external-secrets.io` | API ausente |
| StorageClass | DISCOVERED | MCP `StorageClass` | `gp3` default, expansión, WaitForFirstConsumer |
| Quota de deploy | DISCOVERED | MCP `ResourceQuota` | requests 3 CPU/30 Gi; limits 30 CPU/30 Gi |
| Quota de storage | DISCOVERED | MCP `ResourceQuota` | 10 PVC y 80 Gi |
| Dominio Route | PENDING_VALIDATION | lectura de IngressController denegada; no hay Route accesible existente | Resolver al crear Route o por plataforma |
| Registro aprobado | PENDING_VALIDATION | lectura de Image config denegada | Default interno tipado; confirmar bootstrap |
| PostgreSQL administrado/operador | PENDING_VALIDATION | catálogo/operadores fuera del RBAC | Producción no usa fallback sin aprobación |

No quedan `NEEDS CLARIFICATION` técnicas: los valores dinámicos se expresan como
entradas tipadas y el trabajo estático puede continuar.
