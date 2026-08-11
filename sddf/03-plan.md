---

Bloque para `plan`: implementar la arquitectura de la aplicacion en Red Hat OpenShift

Al generar `plan.md`, disena e implementa el despliegue OpenShift completo a partir de `spec.md`, la constitucion, los contratos, el modelo de datos y el repositorio disponible. El cliente no debe traducir su aplicacion a objetos Kubernetes ni seleccionar manualmente cada pieza de plataforma. El LLM debe tomar decisiones conservadoras, justificarlas y producir artefactos listos para convertirse en tareas e implementarse.

Regla principal de autonomia

Aplica este orden antes de formular cualquier pregunta:

1. `INFERIR`: inspecciona especificacion, contratos, codigo, Dockerfiles, configuracion, dependencias, puertos, comandos, migraciones y pruebas.
2. `DECIDIR`: usa defaults simples, soportados, reversibles y compatibles con OpenShift.
3. `DESCUBRIR`: si existe acceso de solo lectura, consulta version del cluster, APIs, cuotas, StorageClasses, operadores, registro, dominio de ingreso y politicas aplicables, sin leer Secrets.
4. `GENERAR`: completa manifiestos, pipelines, GitOps, pruebas y documentacion aunque no exista acceso al cluster.
5. `PREGUNTAR`: solo si falta un dato externo, no inferible ni descubrible, que impide una decision segura. Agrupa todas esas preguntas una sola vez y nunca solicites credenciales por chat.

1. Construir el modelo de despliegue desde la arquitectura real

Genera una matriz por componente con: origen en la especificacion o codigo, comando de ejecucion, puertos, protocolo, dependencias, configuracion, secretos referenciados, estado, escalado, exposicion, probes y recurso OpenShift elegido.

Selecciona recursos segun el comportamiento:

- `Deployment` para servicios stateless, frontends, APIs y workers reemplazables.
- `StatefulSet` solo si la identidad estable u orden de almacenamiento es una propiedad real del componente y no existe una opcion administrada u operador mas apropiado.
- `Job` para migraciones, carga inicial y tareas finitas; `CronJob` para tareas recurrentes.
- `Service` para descubrimiento interno; `Route` unicamente para entradas externas HTTP(S). Para otros protocolos, documenta la capacidad de plataforma requerida.
- `ConfigMap` para configuracion no sensible y referencias a `Secret` u operador de secretos para valores sensibles.
- `PersistentVolumeClaim` solo para datos que realmente necesiten filesystem persistente. No uses almacenamiento persistente para codigo, logs ni estado recreable.

No dividas un monolito artificialmente. En microservicios, conserva fronteras, escalado y permisos independientes. Para aplicaciones sin persistencia, no agregues bases de datos ni volumenes. Para arquitecturas con datos, modela explicitamente propietarios, migraciones, backup y restauracion.

2. Resolver servicios de datos y dependencias

Para cada base de datos, cache, broker, almacenamiento de objetos o servicio equivalente:

1. Determina si es obligatorio por la arquitectura o solo una comodidad de desarrollo.
2. Prefiere, en este orden, un servicio corporativo requerido, un servicio administrado aprobado, un operador soportado disponible y, por ultimo, una instancia autogestionada con limites operativos documentados.
3. Define conectividad, TLS, autenticacion por referencia, NetworkPolicy, capacidad, backup, restauracion, actualizacion y observabilidad.
4. Implementa migraciones con un Job o mecanismo equivalente controlado. Evita que todas las replicas migren simultaneamente al iniciar.
5. Define que ocurre durante despliegue y rollback si el cambio de esquema no es retrocompatible.

Si la seleccion depende de capacidades del cluster todavia desconocidas, genera interfaces y overlays para las alternativas viables, elige una opcion por defecto documentada para validacion estatica y marca la comprobacion como tarea de descubrimiento, no como pregunta inicial al cliente.

3. Generar los artefactos segun necesidad, no desde una plantilla rigida

El plan debe enumerar y la implementacion posterior debe crear, como minimo cuando apliquen:

```text
deploy/
  openshift/
    base/                   # recursos comunes derivados de cada componente
    overlays/dev/
    overlays/staging/       # solo si el flujo requiere este ambiente
    overlays/production/    # solo si el flujo requiere este ambiente
  gitops/                   # Applications/ApplicationSets y estado por ambiente
  policies/                 # validaciones o politicas locales cuando correspondan
.tekton/                    # Pipelines as Code cuando esta capacidad este disponible
scripts/platform/
  discover                  # inspeccion de solo lectura, sin Secrets
  render
  validate
  smoke
  rollback
docs/operations/
  openshift-deployment.md   # inventario, URLs, estado y guia operativa
```

Adapta la estructura a las convenciones existentes del repositorio. No generes recursos vacios, operadores no requeridos, Routes para servicios internos ni un conjunto identico de YAML para arquitecturas distintas.

Por workload define cuando aplique:

- imagen y comando reproducibles;
- ServiceAccount dedicada y RBAC minimo;
- compatibilidad con UID arbitrario, ejecucion no root, capacidades eliminadas y filesystem de solo lectura cuando el runtime lo permita;
- requests/limits iniciales razonados y estrategia posterior de ajuste;
- startup, readiness y liveness probes basadas en comportamiento real;
- estrategia de rollout, terminacion ordenada y PodDisruptionBudget si la disponibilidad lo justifica;
- autoscaling solo con una metrica pertinente y limites seguros;
- afinidad o distribucion solo cuando aporte disponibilidad real;
- ConfigMaps, referencias de Secret, Services, Routes, TLS y NetworkPolicies derivados de los flujos.

4. Automatizar build, promocion y reconciliacion

Implementa un flujo estable de GitOps:

1. `inspect`: valida la coherencia entre arquitectura, contratos y artefactos.
2. `test`: ejecuta lint, pruebas unitarias, integracion, contratos y E2E aplicables.
3. `secure`: detecta secretos, analiza dependencias, genera SBOM y escanea cada imagen.
4. `build`: construye una vez cada imagen necesaria y registra su digest.
5. `render`: renderiza todos los ambientes y valida esquemas, politicas y referencias.
6. `publish`: publica imagenes inmutables y evidencia asociada al commit.
7. `promote`: propone el cambio de digest/configuracion en GitOps; no modifica directamente una rama protegida.
8. `reconcile`: permite que OpenShift GitOps aplique el estado deseado.
9. `verify`: comprueba migraciones, rollout, conectividad, Routes, persistencia y smoke tests.
10. `report`: registra commit, digests, ambiente, resultado, evidencia y revision a usar para rollback.

Usa OpenShift Pipelines y Pipelines as Code cuando esten disponibles. Si el repositorio ya utiliza otro CI aprobado, implementa las mismas puertas y conserva GitOps como fuente de verdad. Produccion no debe usar `latest` ni reconstruir una imagen ya validada en un ambiente anterior.

5. Separar bootstrap de operacion continua

El plan debe producir dos flujos ejecutables:

- `Bootstrap`: verificar capacidades, crear o seleccionar namespaces autorizados, establecer identidades y RBAC, conectar registro y repositorios, registrar referencias de secretos e instalar la configuracion inicial de GitOps. No instales operadores ni concedas privilegios de cluster sin autorizacion explicita.
- `Operacion continua`: desde un merge, construir, verificar, promover, reconciliar, probar y reportar sin que el cliente ejecute comandos de despliegue.

Clasifica toda entrada de plataforma como:

- `INFERRED`: obtenida de artefactos del proyecto.
- `DEFAULTED`: decision conservadora documentada.
- `DISCOVERED`: obtenida mediante API, CLI o MCP de solo lectura.
- `EXTERNAL_REQUIRED`: restriccion o identificador que solo controla la organizacion.
- `SECRET_REFERENCE`: nombre o ruta segura; nunca el valor.

Genera un perfil de plataforma validable con esas entradas. No bloquees el plan por URL de API, namespace, dominio, registro o StorageClass si pueden descubrirse mas tarde: usa variables tipadas y completa toda validacion estatica posible.

6. Seguridad de identidades y secretos

- Separa identidades de descubrimiento, build/publicacion y reconciliacion. Limita cada una a sus recursos y namespaces.
- Prefiere ServiceAccounts, workload identity o identidades robot revocables sobre tokens personales.
- Antes del bootstrap, especifica comprobaciones de permisos equivalentes a `oc auth can-i` para cada accion requerida.
- Usa External Secrets u otro mecanismo aprobado si esta disponible. De lo contrario, genera solo contratos y referencias para Secrets creados por canal seguro.
- Desactiva trazas que impriman credenciales y valida que repositorio, manifiestos renderizados, resultados de pipeline y logs no contengan secretos.
- El MCP de OpenShift, si existe, inicia en solo lectura, con un contexto limitado y acceso a Secrets denegado. No habilites escritura directa en produccion ni sustituyas el flujo GitOps.

7. Validacion y definicion de terminado

Incluye una matriz ejecutable de verificaciones:

- build reproducible de todas las imagenes;
- renderizado de cada overlay y validacion contra las APIs de la version objetivo;
- cumplimiento de politicas de seguridad, UID arbitrario y minimo privilegio;
- ausencia de secretos y de etiquetas mutables en ambientes promovidos;
- orden correcto de migraciones y compatibilidad de esquema;
- rollout y probes de cada workload;
- conectividad permitida y bloqueo de trafico no requerido;
- Route, TLS y DNS para cada entrada publica;
- persistencia, backup y restauracion para cada dato durable;
- smoke test del flujo funcional principal y pruebas de dependencias criticas;
- promocion de la misma imagen entre ambientes;
- rollback probado a una revision saludable, incluyendo el tratamiento de datos.

El trabajo de plataforma esta terminado solo cuando un cambio representativo completa `commit -> pruebas -> imagen por digest -> cambio GitOps -> reconciliacion -> verificacion`, sin pasos manuales ordinarios del cliente. Si no hay acceso al cluster, indica claramente que la validacion dinamica queda pendiente, pero entrega los artefactos, esquemas, renderizado, pruebas estaticas y comandos automatizados.

8. Salida obligatoria de `plan.md`

El plan debe incluir:

- diagrama de componentes y flujos de red/datos;
- matriz de mapeo entre arquitectura y recursos OpenShift;
- decisiones inferidas, defaults y evidencia utilizada;
- estrategia por servicio de datos, migracion, backup y restauracion;
- estructura exacta de artefactos a generar;
- matriz de configuracion y referencias de secretos por componente y ambiente;
- identidades y permisos minimos;
- flujo de bootstrap, CI, GitOps, promocion y rollback;
- matriz de pruebas de plataforma con comando o herramienta, resultado esperado y evidencia;
- riesgos y alternativas dependientes de capacidades no confirmadas;
- secuencia concreta que pueda convertirse directamente en `tasks.md`.

9. Documentacion final de lo creado

El plan debe exigir que la implementacion genere `docs/operations/openshift-deployment.md` o una ruta equivalente acorde con el repositorio. Esta documentacion debe construirse a partir de los manifiestos renderizados y enriquecerse con el estado real del cluster cuando exista acceso de solo lectura.

Debe contener, como minimo:

- resumen y diagrama de la arquitectura desplegada;
- nombre y version del cluster o contexto, dominio de aplicaciones y capacidades relevantes confirmadas;
- tabla por ambiente con namespace, revision GitOps, estado de sincronizacion y estado general;
- inventario por componente con Deployment, StatefulSet, Job o CronJob, imagen por digest, replicas deseadas, pods esperados, ServiceAccount, Services y almacenamiento;
- Routes, hosts y URLs completas de acceso, indicando cuales son publicas, internas o pendientes de DNS/TLS;
- bases de datos, caches, colas, operadores y servicios externos utilizados, sin incluir credenciales;
- PersistentVolumeClaims, capacidad solicitada, StorageClass confirmada y politica de backup/restauracion;
- ConfigMaps y nombres de Secrets consumidos, mostrando solo referencias y nunca valores;
- NetworkPolicies, puertos y flujos de comunicacion autorizados entre componentes;
- pipelines, repositorio GitOps, Applications/ApplicationSets y recorrido de promocion;
- comandos seguros o procedimientos para consultar pods, logs, eventos, rollouts, sincronizacion, smoke tests y rollback;
- ubicacion de dashboards, metricas y alertas cuando existan;
- fecha de generacion, commit de aplicacion, revision GitOps, digests desplegados y resultado de la ultima verificacion.

Cada dato debe marcar su procedencia y estado como `DECLARED`, `OBSERVED` o `PENDING_VALIDATION`. Las listas de pods deben documentar controladores y replicas esperadas; los nombres efimeros de pods observados pueden incluirse como evidencia fechada, pero no tratarse como identificadores permanentes.

Si no existe conexion al cluster, genera la documentacion con los valores declarados y marca como `PENDING_VALIDATION` el cluster, URLs asignadas, estado, pods observados y demas valores dinamicos. Tras el primer despliegue, la automatizacion debe actualizar o complementar el documento con evidencia real. La documentacion debe validarse como una salida obligatoria del pipeline o de la tarea final de entrega y mantenerse sincronizada cuando cambien manifiestos, endpoints o topologia.

Si queda un bloqueo externo, emite una unica seccion `PLATFORM_INPUT_REQUIRED` al final. Incluye solo el dato indispensable, por que no puede inferirse o descubrirse, quien debe proporcionarlo y como referenciarlo de forma segura. No detengas ningun trabajo que pueda completarse sin ese dato.

'oc' ya esta instalado y autenticado, `usa un proyecto nuevo a menos que se especifique el proyecto a usar` y comienza a trabajar en el. Usa el MCP 'kubernetes-mcp-server@latest'.

10. Fallback ejecutable para un cluster de prueba sin GitOps

Este fallback solo se activa con autorizacion explicita y debe producir una
`DIRECT_APPLY_DEVIATION`. No reemplaza la arquitectura GitOps del plan.

1. Descubrir por lectura version, namespace autorizado, cuotas, SCC, registro,
   StorageClass, dominio de Route, DNS y APIs opcionales. Distinguir Argo Workflows,
   Argo CD Agent y el controlador Argo CD: ninguno sustituye automaticamente a otro.
2. Construir una sola vez, publicar en el registro del proyecto y obtener el digest
   observado del ImageStreamTag. Actualizar el overlay con `image@sha256`, nunca con
   `latest` ni solo con el tag del commit.
3. Crear secretos aleatorios directamente en el cluster mediante archivos temporales
   con permisos `0600`; no imprimir valores y destruir los temporales inmediatamente.
   Los secretos de texto consumidos tanto como variables como archivos no deben tener
   salto de linea final, porque los runtimes pueden normalizarlos de forma distinta.
4. Crear un overlay de prueba explicito para autenticacion local ya soportada y para
   eliminar Jobs/CronJobs cuyas dependencias externas se hayan pospuesto. No parchear
   la base ni produccion para acomodar la demo.
5. Renderizar y ejecutar validacion local, politicas y `oc apply --dry-run=server`.
6. Aplicar primero identidades, configuracion, Services, NetworkPolicies, PVC y datos.
   Esperar el StatefulSet antes de crear el Job de migracion.
7. Ejecutar una migracion finita y bloquear los Deployments hasta que el Job termine.
   En una base autogestionada de prueba puede usarse el administrador del contenedor;
   esta excepcion no se replica en una base administrada ni en produccion.
8. Aplicar Deployments y Route, esperar todos los rollouts y ejecutar un smoke test
   que cree, procese y consulte una entidad sintetica.
9. Registrar URL, replicas, digests, PVC, migracion, smoke y todas las capacidades
   pendientes. Importar el overlay en GitOps cuando la API `Application` exista.

Lecciones de diagnostico que deben automatizarse

- En OpenShift DNS puede terminar en el puerto backend `5353` despues de DNAT. Una
  NetworkPolicy que permite solo TCP/UDP `53` puede producir `ENOTFOUND` aun cuando
  `/etc/resolv.conf` apunte correctamente al Service DNS. Validar una resolucion real
  desde un pod con las mismas labels y permitir solamente `53/5353`.
- No usar un chart `Argo CD Agent` como sustituto del operador GitOps. El Agent exige
  un Principal, CA y credenciales mTLS preexistentes; sin ellos debe quedar pendiente.
- El pipeline debe recibir el commit como parametro; un workspace empaquetado sin
  `.git` no puede depender de `.git/HEAD` para generar evidencia.
- No vincular dos PVC RWO a una misma TaskRun sin comprobar co-scheduling y zona. En
  pipelines pequeños, conservar fuente y evidencia en un unico workspace persistente
  evita afinidades imposibles.
- Los Tasks deben usar herramientas realmente presentes en la imagen. Si el toolbox
  contiene `oc` pero no `kubectl`, usar `oc kustomize` o un shim probado.
- Un fallo de migracion no habilita el rollout. Antes de recrear almacenamiento,
  verificar que no haya datos; si existen o no puede demostrarse, preservar el PVC y
  rotar roles desde una sesion local autorizada.

Evidencia obligatoria de la desviacion

- `DECLARED`: manifiestos renderizados y overlay de prueba versionado.
- `OBSERVED`: version del cluster, recursos Ready, Route, digests y smoke PASS.
- `PENDING_VALIDATION`: GitOps/reconciliacion, OIDC corporativo, backup/restauracion,
  promocion y rollback dinamico.
