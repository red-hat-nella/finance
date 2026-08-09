Genera el plan de implementacion para el MVP de scoring crediticio alternativo definido en la especificacion activa.

Stack objetivo:
- Frontend: Angular 18 con Angular Material.
- API publica de ingestion: Node.js, TypeScript y Express.
- Motor interno de scoring: Python 3.12 y FastAPI.
- Persistencia: PostgreSQL.
- Ejecucion local: Docker Compose o Podman Compose.
- Despliegue: seguir el bloque de automatizacion OpenShift ubicado al final de este documento.

Arquitectura esperada:
- `frontend/`: formulario de solicitud, vista de resultado e historico.
- `services/ingestion/`: API publica, validacion de entrada, persistencia, historico y orquestacion del scoring.
- `services/scoring/`: API interna con calculo deterministico del score.
- `db/migrations/`: esquema inicial de PostgreSQL.
- `specs/<feature>/contracts/`: contratos OpenAPI para API publica e interna.

Entregables obligatorios del plan:
1. `research.md`
   - Resolver decisiones tecnicas abiertas.
   - Justificar por que Angular Material, Express, FastAPI, PostgreSQL y OpenShift encajan con el MVP.
   - Definir el estilo UI/UX elegido para la aplicacion: herramienta financiera profesional, sobria, centrada, clara, con alta legibilidad y baja friccion.
   - Definir tokens visuales iniciales: paleta semantica, tipografia, escala de espaciado, radios, elevacion, breakpoints y estados de interaccion.
   - Registrar alternativas consideradas sin sobredisenar.

2. `design-system.md`
   - Documentar el sistema visual antes de implementar pantallas.
   - Incluir layout base centrado con ancho maximo por breakpoint, gutters, grid/flex rules, z-index scale y reglas para headers/footers fijos.
   - Definir tipografia: familia, pesos, tamanos, line-height, usos por rol y reglas para textos largos.
   - Definir componentes principales: app shell, formulario, stepper o secciones, campos, botones, tarjetas de resultado, badge de riesgo, lista/tabla de historico, empty state, loading, error summary, toast y dialogos.
   - Definir reglas contra solapamiento: dimensiones estables, wrapping, min-height, gap, overflow controlado, breakpoints y pruebas visuales.
   - Definir accesibilidad: contraste WCAG AA, foco visible, labels, aria-labels, orden de tabulacion, navegacion por teclado y reduced-motion.

3. `data-model.md`
   - Modelar solicitante, solicitud, datos alternativos, evaluacion, factores, version de criterios y eventos/auditoria.
   - Definir campos principales, relaciones, validaciones y estados.
   - Incluir reglas de retencion/minimizacion de datos sensibles donde aplique.
   - Incluir tipos de datos, obligatoriedad, unicidad, indices recomendados, claves, relaciones, estados y ejemplos de registros.

4. `contracts/`
   - Contrato OpenAPI para ingestion publica:
     - Crear solicitud.
     - Validar/evaluar solicitud.
     - Consultar detalle de evaluacion.
     - Listar historico con filtros basicos.
     - Health endpoint.
   - Contrato OpenAPI para scoring interno:
     - Calcular score desde datos normalizados.
     - Devolver score, banda, recomendacion, factores y version de criterios.
     - Health endpoint.
   - Definir esquemas de error consistentes y sin datos sensibles.
   - Incluir ejemplos completos de request y response para exito, validacion, revision manual y error operativo.
   - Incluir codigos HTTP, reglas de idempotencia cuando aplique, paginacion, filtros, ordenamiento y correlation/request id.

5. `quickstart.md`
   - Como ejecutar localmente con Docker Compose o Podman Compose.
   - Como ejecutar validaciones y pruebas.
   - Como probar manualmente los flujos principales.
   - Como verificar visualmente las pantallas en 375px, 768px, 1024px y 1440px.
   - Como confirmar que no hay solapamientos, texto cortado, scroll horizontal ni contenido oculto por barras fijas.

Chequeo de constitucion:
- Verifica explicitamente que el plan cumple explicabilidad del score, contratos antes de implementacion, calidad verificable, privacidad/trazabilidad, operabilidad en OpenShift y UI/UX profesional verificable.
- Si alguna regla se viola, detente y marca ERROR con razon y alternativa.

Restricciones del plan:
- Mantener alcance de MVP.
- No introducir integraciones reales con terceros.
- No usar servicios cloud propietarios como requisito obligatorio.
- No almacenar secretos reales.
- No acoplar el frontend directamente al servicio interno de scoring.
- No dejar decisiones criticas como "por definir" si bloquean implementacion.

Estrategia de validacion esperada:
- Pruebas unitarias del scoring con casos deterministas: bajo, medio, alto, incompleto, invalido.
- Pruebas de API para validacion, errores y persistencia de historico.
- Validacion de contratos OpenAPI.
- Smoke test de contenedores locales.
- Al menos una prueba end-to-end del flujo registro -> evaluacion -> resultado -> historico.

Nivel de detalle requerido:
- El plan debe ser casi replicable como codigo: no solo elegir tecnologias, sino definir modulos, responsabilidades, fronteras, contratos, modelos, comandos, variables de entorno, errores, health checks y pruebas esperadas.
- Incluye estructura de carpetas propuesta con archivos principales y proposito de cada uno.
- Incluye estructura de carpetas frontend para componentes reutilizables, layout, tema, tokens, formularios, vistas y pruebas visuales.
- Incluye pseudocodigo o algoritmo detallado para el calculo deterministico del score, con pesos, umbrales, bandas, motivos de revision manual y factores explicables. No dejes el algoritmo como "pendiente".
- Define la estrategia de validacion de entrada en frontend y API, incluyendo reglas compartidas, diferencias y mensajes esperados.
- Define la estrategia UI con Angular Material: tema centralizado, componentes consistentes, densidad apropiada, formularios accesibles, tablas responsivas y estilos sin valores hardcodeados dispersos.
- Define migraciones iniciales de base de datos a nivel de tablas, columnas, constraints e indices.
- Incluye una matriz de pruebas con nombre de prueba, capa, datos usados, resultado esperado y criterio de exito.
- Incluye pruebas visuales/responsive con capturas o validaciones equivalentes para formulario, resultado e historico en mobile, tablet y desktop.
- Incluye criterios UI de "done": contenido centrado, alineacion consistente, tipografia coherente, contraste AA, foco visible, sin overlap, sin scroll horizontal, sin texto cortado y estados completos.
- Incluye una secuencia de implementacion recomendada que pueda convertirse en `tasks.md` con minimo retrabajo.
- Si una decision queda abierta, marca ERROR solo si bloquea implementacion; en los demas casos toma una decision conservadora y documenta la razon.

Resultado esperado:
- El plan debe quedar listo para generar tareas de implementacion sin volver a discutir arquitectura base.
- Los artefactos deben usar rutas relativas del proyecto y comandos ejecutables.
- El plan debe favorecer simplicidad, trazabilidad y despliegue reproducible.

---

Bloque de planificacion para despliegue automatico en Red Hat OpenShift

Este bloque contiene la parte constante del Golden Path y el contrato de entradas variables. Debe ejecutarse para cualquier proyecto cuyo perfil de plataforma solicite OpenShift. El plan no puede reducirlo a "crear un Dockerfile y aplicar YAML".

1. Modelo de automatizacion obligatorio

- Adoptar GitOps como flujo estable: el repositorio de aplicacion construye y verifica; el repositorio GitOps declara el digest que debe ejecutar cada ambiente; OpenShift GitOps reconcilia el cluster.
- Usar OpenShift Pipelines con Pipelines as Code cuando esten disponibles. Si el cliente usa otro CI, conservar las mismas etapas, controles y separacion entre repositorio de aplicacion y repositorio GitOps.
- Usar el registro aprobado por el cliente. Publicar imagenes con version y digest, generar SBOM y conservar evidencia del escaneo.
- Tratar el acceso directo mediante `oc` como bootstrap, diagnostico o fallback controlado. La operacion continua no debe depender de que una persona ejecute `oc apply`.
- Separar tres identidades: `discovery` de solo lectura, `ci-builder` para construir/publicar y `gitops-deployer` para reconciliar namespaces objetivo.

2. Perfil de plataforma que el plan debe consumir

Generar `deploy/platform-profile.example.yaml` sin secretos y documentar que el cliente o el template de Developer Hub produce una copia fuera de Git o una variante aprobada. Debe contemplar como minimo:

```yaml
project:
  slug: alternative-scoring
  owner: group:default/credit-platform
  sourceRepo: https://git.example.com/team/application.git
  gitopsRepo: https://git.example.com/team/application-gitops.git
platform:
  apiUrl: https://api.cluster.example.com:6443
  baseDomain: apps.cluster.example.com
  registry: quay.example.com/team
  environments:
    - name: dev
      namespace: alternative-scoring-dev
      autoPromote: true
    - name: prod
      namespace: alternative-scoring-prod
      autoPromote: false
  capabilities:
    pipelinesAsCode: true
    gitops: true
    developerHub: true
    externalSecrets: false
access:
  deploymentAuth: serviceAccount
  deploymentCredentialRef: ci/openshift-deployer
  gitWriteCredentialRef: ci/gitops-writer
  registryCredentialRef: ci/registry-push
  mcpDiscoveryAllowed: true
  mcpWriteAllowedInDev: false
exposure:
  publicComponents: [frontend]
  tlsMode: edge
promotion:
  productionApprovalGroup: platform-release-managers
```

El plan debe validar el perfil con un esquema y clasificar cada entrada como:

- `REQUIRED`: no puede inferirse de forma segura.
- `DEFAULTABLE`: puede recibir un valor conservador documentado.
- `DISCOVERABLE`: puede consultarse mediante API/MCP de solo lectura.
- `SECRET_REFERENCE`: solo se almacena el nombre o ruta de la credencial, nunca su valor.

3. Variables y credenciales

Documentar una matriz con nombre, obligatoriedad, sensibilidad, origen, consumidor y mecanismo de rotacion. Como minimo:

| Entrada | Tipo | Regla |
| --- | --- | --- |
| `OPENSHIFT_API_URL` | Publica/restringida | Obligatoria para acceso externo; URL de API, no URL de consola. |
| `OPENSHIFT_CONTEXT` | Publica/restringida | Obligatoria si el kubeconfig contiene mas de un contexto. |
| `OPENSHIFT_NAMESPACE_<ENV>` | Publica | Namespace existente o autorizado para creacion. |
| `OPENSHIFT_BASE_DOMAIN` | Publica | Requerida para generar o validar Routes. |
| `IMAGE_REGISTRY` | Publica/restringida | Registro y organizacion destino. |
| `SOURCE_REPO_URL` | Publica/restringida | Repositorio de codigo. |
| `GITOPS_REPO_URL` | Publica/restringida | Repositorio de estado deseado. |
| `OPENSHIFT_TOKEN` | Secreta | Solo para acceso externo o bootstrap cuando no exista identidad preferible. Nunca escribir el valor en Git o prompts. |
| `KUBECONFIG` | Secreta | Alternativa preferida para contexto dedicado; archivo con permisos `0600`. |
| `REGISTRY_AUTH` | Secreta | Referencia para push/pull; rotacion independiente. |
| `GITOPS_WRITE_CREDENTIAL` | Secreta | GitHub App o credencial robot para abrir/actualizar PR, con alcance minimo. |
| Secretos de aplicacion | Secreta | Referencias por clave; se inyectan desde Secret u operador de secretos. |

Generar `.env.example`, Secret de ejemplo y documentacion solo con nombres de variables y valores falsos inequivocos. Los scripts deben desactivar `set -x`, evitar imprimir cabeceras o tokens y limpiar archivos temporales.

Cuando se use login externo, documentar y automatizar una comprobacion equivalente a:

```bash
set +x
oc login "$OPENSHIFT_API_URL" --token "$OPENSHIFT_TOKEN"
if [ -n "${OPENSHIFT_CONTEXT:-}" ]; then oc config use-context "$OPENSHIFT_CONTEXT"; fi
oc project "$OPENSHIFT_NAMESPACE"
oc whoami
oc auth can-i create deployments.apps -n "$OPENSHIFT_NAMESPACE"
oc auth can-i create routes.route.openshift.io -n "$OPENSHIFT_NAMESPACE"
```

El token se obtiene del gestor de secretos en runtime. No debe solicitarse por chat ni persistirse en el workspace. Para pipelines ejecutadas dentro de OpenShift, preferir la ServiceAccount del PipelineRun y no un token externo.

4. Artefactos que debe generar la implementacion

```text
.tekton/
  pull-request.yaml          # validaciones sin promocion
  push.yaml                  # build, scan, push y propuesta GitOps
catalog-info.yaml            # registro en Red Hat Developer Hub
deploy/
  platform-profile.schema.json
  platform-profile.example.yaml
  openshift/
    base/
      kustomization.yaml
      serviceaccount.yaml
      role.yaml
      rolebinding.yaml
      deployment.yaml
      service.yaml
      route.yaml
      configmap.yaml
      secret.example.yaml
      networkpolicy.yaml
    overlays/dev/
    overlays/staging/
    overlays/production/
  gitops/
    application.example.yaml # bootstrap de Argo CD/OpenShift GitOps
    environments/            # estado deseado o plantilla para repo separado
mcp/
  openshift-mcp.toml.example # configuracion sin credenciales y acceso restringido
scripts/
  platform/discover.sh
  platform/render.sh
  platform/validate.sh
  platform/smoke.sh
```

Agregar por componente Deployment, Service, ConfigMap, probes, recursos, security context y NetworkPolicy. Crear Route solo para componentes publicos. Agregar almacenamiento, jobs, autoscaling o disruption budget solamente cuando la especificacion lo requiera.

El repositorio GitOps real debe estar separado del codigo de aplicacion cuando la plataforma lo permita. No duplicar valores secretos entre ambos repositorios.

5. Pipeline y puertas de calidad

Definir etapas ejecutables y su criterio de exito:

1. `resolve`: validar perfil, contratos, herramientas y versiones compatibles.
2. `test`: lint, unitarias, integracion, contratos y E2E aplicables.
3. `security`: secret scan, dependencias, SBOM, imagen y politicas de severidad.
4. `build`: construir una vez y calcular digest inmutable.
5. `manifest`: renderizar overlays, validar esquemas, politicas, referencias y ausencia de secretos.
6. `publish`: subir imagen y adjuntar metadata de commit/SBOM.
7. `propose`: abrir o actualizar PR en GitOps con el digest; no escribir directamente en la rama protegida.
8. `reconcile`: dejar que OpenShift GitOps sincronice segun politica del ambiente.
9. `verify`: observar rollout, probes, Route, eventos y smoke test.
10. `report`: publicar commit, digest, ambiente, URL, estado, rollback y enlaces de evidencia.

Pull requests no deben publicar ni desplegar a produccion. Desarrollo puede usar ambientes efimeros si el cliente lo solicita y existe limpieza automatica.

6. Bootstrap y operacion continua

El plan debe separar explicitamente:

- Bootstrap de plataforma, una vez: comprobar operadores, crear o seleccionar namespaces, ServiceAccounts/RBAC, integrar Pipelines as Code, registrar el componente en Developer Hub, configurar repositorio GitOps, crear la Application de Argo CD y registrar referencias a secretos.
- Operacion continua: cada PR ejecuta validaciones; cada merge produce imagen; la promocion modifica GitOps; Argo CD reconcilia; la pipeline verifica y reporta. El cliente no ejecuta comandos de despliegue ordinarios.

Si Pipelines, GitOps o el registro no estan disponibles, el plan debe marcar `ERROR: PLATFORM_CAPABILITY_MISSING` e indicar el prerrequisito o una alternativa compatible aprobada. No instalar operadores en un cluster del cliente sin autorizacion explicita.

7. Integracion opcional con OpenShift MCP Server

Usar el MCP para descubrimiento y verificacion cuando este disponible. El servidor consulta directamente la API Kubernetes/OpenShift, por lo que no requiere `oc`; los scripts y el fallback humano si deben declarar `oc` como prerrequisito.

Generar una configuracion de ejemplo equivalente a:

```toml
read_only = true
toolsets = ["core", "config", "openshift", "tekton"]

[[denied_resources]]
group = ""
version = "v1"
kind = "Secret"
```

Iniciar con un kubeconfig dedicado, un solo contexto, acceso namespace-scoped y operaciones destructivas deshabilitadas. El flujo del agente debe ser:

1. Descubrir version, APIs, operadores, namespaces autorizados, registro, storage classes, cuotas y restricciones.
2. Comparar descubrimiento con el perfil, sin leer Secrets.
3. Generar o corregir artefactos localmente.
4. Renderizar, validar y mostrar diff sin escritura.
5. Crear un PR para revision.
6. Permitir que pipeline y GitOps apliquen el cambio.
7. Usar MCP de solo lectura para verificar rollout y diagnosticar eventos.

No habilitar escritura MCP en produccion. Si se autoriza en desarrollo, crear una identidad distinta y limitarla a recursos y namespace concretos. No permitir operaciones destructivas sin aprobacion humana explicita.

8. Validacion de OpenShift y criterios de terminado

El plan debe incluir comandos o herramientas equivalentes para:

- Validar el esquema del perfil y que no existan campos bloqueantes vacios.
- Ejecutar `kustomize build` u `oc kustomize` para cada overlay.
- Validar manifiestos contra los esquemas de la version destino y politicas de seguridad.
- Ejecutar server-side dry-run y diff cuando exista acceso de lectura suficiente.
- Verificar que todos los contenedores tengan probes, requests/limits, usuario no root y filesystem compatible con UID arbitrario de OpenShift.
- Verificar Routes, TLS, DNS, NetworkPolicies, ServiceAccounts y permisos efectivos.
- Confirmar que ninguna imagen use `latest` y que produccion use digest.
- Confirmar que Git, logs y resultados de pipeline no contengan secretos.
- Probar rollback con una version anterior controlada.
- Ejecutar smoke test despues de sincronizar y conservar evidencia.

La automatizacion se considera terminada solo cuando un cambio de ejemplo recorre PR -> pruebas -> imagen -> PR GitOps -> reconciliacion -> smoke test sin que el cliente ejecute un despliegue manual.

9. Salida esperada del modelo

El modelo debe entregar junto al plan:

- Lista de entradas recibidas, defaults usados y valores descubiertos, sin secretos.
- Lista exacta de datos faltantes y quien debe proporcionarlos.
- Matriz de permisos requeridos por identidad.
- Diagrama del flujo de promocion y rollback.
- Artefactos a generar con ruta y propietario.
- Comandos de bootstrap, validacion y diagnostico.
- Matriz de pruebas de plataforma y criterios de exito.
- Riesgos, decisiones y limites de acciones permitidas al agente.

Si falta una credencial, el modelo debe completar generacion y validacion estatica, producir referencias seguras y detener solamente las operaciones que requieren conexion. Nunca debe sustituirla por una credencial inventada o ampliar privilegios.

10. Fuentes oficiales que el modelo debe consultar

- OpenShift Container Platform: `https://docs.redhat.com/en/documentation/openshift_container_platform/`
- Red Hat OpenShift Pipelines: `https://docs.redhat.com/en/documentation/red_hat_openshift_pipelines/`
- Red Hat OpenShift GitOps: `https://docs.redhat.com/en/documentation/red_hat_openshift_gitops/`
- Red Hat Developer Hub: `https://docs.redhat.com/en/documentation/red_hat_developer_hub/`
- OpenShift MCP Server: `https://github.com/openshift/openshift-mcp-server`

El modelo debe seleccionar documentacion compatible con la version descubierta del cluster y registrar las versiones usadas. No debe copiar ejemplos de una version distinta sin verificar APIs, operadores y campos disponibles. El OpenShift MCP Server se usa para inspeccionar el estado real del cluster; las URLs de Red Hat son la fuente para requisitos y comportamiento documentado.
