---

Bloque permanente: implementacion autonoma en Red Hat OpenShift

Este bloque debe incorporarse a la constitucion de cualquier proyecto que tenga como destino Red Hat OpenShift. Su proposito es obligar al flujo SDD y al LLM a convertir la arquitectura real de la aplicacion en una entrega operable, segura y automatizada. El cliente describe su aplicacion y sus restricciones de negocio; el LLM resuelve la arquitectura de despliegue y genera sus artefactos con la menor interaccion posible.

Principios no negociables

1. La aplicacion determina la topologia
   - El despliegue debe derivarse de la especificacion, los contratos, el modelo de datos y, cuando exista, el codigo fuente. No se debe asumir que toda aplicacion es un unico servicio web.
   - El LLM debe identificar todos los componentes ejecutables y sus relaciones: frontends, APIs, servicios internos, workers, procesos batch, tareas programadas, migraciones, bases de datos, caches, colas, almacenamiento de objetos y dependencias externas.
   - Cada componente debe mapearse al recurso OpenShift adecuado segun su comportamiento. Deben usarse Deployments, StatefulSets, Jobs, CronJobs, Services, Routes y almacenamiento persistente solo cuando correspondan.
   - La solucion debe funcionar para monolitos, microservicios, aplicaciones sin persistencia y aplicaciones con uno o varios servicios de datos, sin imponer una estructura fija.

2. Autonomia con minima interaccion
   - Antes de iniciar cualquier trabajo que tenga OpenShift como destino, el LLM debe ejecutar un preflight de sesion no destructivo con `oc whoami` y confirmar el servidor con `oc whoami --show-server`. Si `oc` no tiene una sesion autenticada valida, debe detenerse inmediatamente, no continuar con especificacion, planificacion, implementacion, descubrimiento ni despliegue, y solicitar al usuario que inicie sesion mediante `oc login` por el mecanismo seguro de su organizacion.
   - El LLM nunca debe pedir que el usuario pegue tokens, contrasenas, kubeconfigs o certificados en el chat. Tras el login, debe pedir solo confirmacion para reintentar el preflight y continuar desde el inicio del flujo.
   - El LLM debe inferir primero desde los artefactos del proyecto, aplicar despues defaults conservadores y descubrir finalmente las capacidades del cluster mediante acceso de solo lectura cuando este disponible.
   - No se debe preguntar al cliente por decisiones implementativas que el LLM pueda resolver, tales como nombres internos, probes basicas, puertos detectables, organizacion de manifiestos, estrategia de build compatible, recursos iniciales prudentes o separacion entre componentes.
   - Solo se puede solicitar informacion que sea externa al proyecto, no descubrible y necesaria para continuar: destino autorizado, acceso seguro, restricciones corporativas, dominios controlados, datos regulatorios o aprobaciones que el LLM no pueda otorgarse.
   - Toda aclaracion de plataforma imprescindible debe agruparse en una unica solicitud corta. La falta de acceso al cluster no debe impedir generar, renderizar y validar estaticamente los artefactos.

3. Plataforma declarativa y operacion sin pasos manuales
   - El estado deseado de cada ambiente debe quedar versionado como codigo y ser reconciliado mediante OpenShift GitOps o una capacidad GitOps equivalente aprobada.
   - La integracion continua debe probar, analizar, construir una sola vez, publicar una imagen inmutable, actualizar la referencia por digest y producir evidencia trazable.
   - Los despliegues ordinarios no deben depender de comandos manuales del cliente. Las acciones manuales se limitan al bootstrap o a aprobaciones organizacionales expresamente requeridas.
   - Todo cambio debe permitir promocion controlada, deteccion de fallos, rollback a una version saludable y trazabilidad entre commit, imagen, configuracion y ambiente.
   - Cada feature aceptada debe actualizar en el mismo cambio el estado deseado de OpenShift. Si modifica un componente existente, se deben actualizar su imagen, configuracion, contratos, conectividad y recursos afectados. Si agrega un componente desplegable, como un microservicio, frontend, worker, Job o CronJob, se deben crear todos los recursos OpenShift necesarios para operarlo; no se permite dejarlo funcionando solo en local.
   - La ausencia de GitOps no autoriza a terminar en manifiestos sin aplicar. En un ambiente no productivo autorizado, el LLM debe ejecutar automaticamente el fallback declarativo de aplicacion directa, esperar el rollout y verificar el flujo funcional. La aprobacion humana se conserva para produccion y para cualquier accion que amplie permisos, exposicion o alcance fuera del namespace autorizado.
   - La entrega debe mantener paridad funcional y topologica entre la composicion local y OpenShift: toda capacidad ejecutable, dependencia requerida, migracion, ruta de comunicacion y comportamiento observable presente en local debe tener una realizacion equivalente en OpenShift. La equivalencia no obliga a copiar herramientas, bypasses, secretos o servicios de desarrollo cuando OpenShift proporciona una alternativa segura.
   - La convergencia del cluster es una fase final por feature o servicio, no una accion por cada edicion de codigo. El LLM debe completar primero toda la implementacion, contratos, migraciones, manifiestos y validaciones locales de la feature; despues debe ejecutar una sola secuencia coordinada de despliegue, rollout y smoke, repitiendola unicamente si esa secuencia falla y requiere una correccion.

4. Seguridad nativa de OpenShift
   - Las cargas deben ejecutarse sin privilegios, ser compatibles con UID arbitrario, usar filesystem de solo lectura cuando sea viable y declarar capacidades, ServiceAccounts y permisos minimos.
   - Configuracion y secretos deben estar separados. Nunca se deben escribir credenciales reales en prompts, especificaciones, planes, repositorios, manifiestos de ejemplo ni logs.
   - Los secretos deben inyectarse en tiempo de ejecucion desde mecanismos aprobados por la plataforma. El repositorio solo conserva referencias, esquemas o ejemplos inequivocamente falsos.
   - La exposicion de red debe ser minima: Route solo para entradas externas, Service para comunicacion interna y NetworkPolicies coherentes con los flujos reales entre componentes.
   - Las imagenes deben ser escaneadas, identificables por digest y compatibles con las politicas de seguridad del cluster.

5. Persistencia y servicios de datos segun necesidad
   - La persistencia no se presume ni se omite. Debe derivarse de las necesidades de consistencia, durabilidad, concurrencia, recuperacion y retencion de la aplicacion.
   - Antes de autogestionar una base de datos, cache, cola u otro servicio con estado, el LLM debe preferir un operador soportado o un servicio administrado aprobado y disponible.
   - Si el servicio se ejecuta dentro de OpenShift, deben definirse almacenamiento, backups, restauracion, actualizaciones, disponibilidad y limites operativos. Un PersistentVolumeClaim por si solo no constituye una estrategia de datos.
   - Las migraciones de esquema deben ser automatizadas, observables, idempotentes cuando corresponda y desacopladas del arranque concurrente de replicas.

6. Operabilidad verificable
   - Cada workload debe declarar recursos, health checks pertinentes, estrategia de rollout y comportamiento ante terminacion. No se deben inventar probes que no correspondan al protocolo o al ciclo de vida real del componente.
   - La solucion debe incluir logs estructurados sin datos sensibles, metricas y alertas minimas derivadas de los objetivos funcionales y dependencias criticas.
   - El despliegue debe verificarse con renderizado, validacion de esquemas y politicas, pruebas de rollout y smoke tests representativos del flujo principal.
   - La automatizacion no se considera terminada hasta demostrar build, publicacion, reconciliacion, disponibilidad, conectividad necesaria, persistencia cuando aplique y rollback.

7. Adaptacion a las capacidades reales
   - No se deben asumir operadores, StorageClasses, registros, ingress, gestores de secretos ni productos opcionales instalados. El LLM debe descubrirlos o tratarlos como capacidades configurables.
   - Deben preferirse APIs estables y soportadas por la version objetivo de OpenShift. Toda dependencia opcional debe tener prerrequisitos explicitos y una alternativa razonable cuando exista.
   - El acceso MCP u otro acceso de inspeccion debe comenzar en modo de solo lectura, limitado al alcance autorizado y sin lectura de Secrets. Sirve para descubrir y verificar, no para reemplazar GitOps como fuente de verdad.

8. Documentacion operativa como parte de la entrega
   - Al finalizar, el LLM debe generar documentacion actualizada de la arquitectura desplegada y de los recursos creados, suficiente para operar, diagnosticar y entregar la aplicacion a otro equipo.
   - La documentacion debe incluir cluster o contexto utilizado, ambientes, namespaces, workloads, pods esperados, Services, Routes y URLs, recursos de datos, almacenamiento, Jobs, CronJobs, identidades, configuracion, dependencias y flujo GitOps.
   - Debe diferenciar claramente recursos deseados, recursos confirmados en el cluster y valores pendientes de validacion. No debe afirmar que un recurso existe si solo fue generado declarativamente.
   - Nunca debe incluir tokens, contrasenas, contenido de Secrets, kubeconfigs ni URLs que incorporen credenciales. Las referencias sensibles deben mostrarse solo por nombre y ubicacion segura.
   - La documentacion debe versionarse junto con los artefactos y actualizarse automaticamente o como parte obligatoria del mismo cambio que modifica la plataforma.

Reglas de gobierno para el flujo SDD

- `OPENSHIFT_SESSION_REQUIRED` es un bloqueo previo absoluto. Si `oc whoami` falla, devuelve una identidad vacia o no permite confirmar el servidor, el LLM debe emitir ese estado y parar antes de leer o modificar artefactos de la feature. No puede sustituir la comprobacion con credenciales solicitadas al usuario, una sesion supuesta, validacion solamente local ni acceso a otro cluster.
- `spec.md` define resultados operativos observables y restricciones de negocio, no obliga al cliente a disenar la plataforma.
- `plan.md` debe producir la arquitectura concreta de OpenShift a partir de la aplicacion y justificar cualquier componente de plataforma adicional.
- `tasks.md` debe incluir la generacion, validacion y prueba de todos los artefactos necesarios para desplegar sin pasos manuales ordinarios.
- `tasks.md` debe incluir la generacion y verificacion de la documentacion operativa final a partir de manifiestos renderizados y, cuando exista acceso, del estado real del cluster.
- Una decision inferida debe registrarse con su evidencia y default. Un dato descubierto debe registrar su fuente sin copiar informacion sensible.
- Si falta un dato externo realmente bloqueante, el LLM debe completar todo el trabajo independiente de ese dato y emitir `PLATFORM_INPUT_REQUIRED` con solo los campos imprescindibles, su motivo y el canal seguro esperado.
- Nunca se debe convertir una preferencia no expresada en una pregunta bloqueante. Ante opciones equivalentes, el LLM elige la alternativa mas simple, soportada, reversible y coherente con el proyecto.
- Toda feature debe incluir un analisis de delta entre la arquitectura local anterior, la arquitectura local resultante y el estado deseado de OpenShift. El delta debe cubrir componentes nuevos, modificados y retirados, asi como imagenes, Services, Routes, Jobs, datos, configuracion, secretos referenciados, NetworkPolicies, observabilidad, pipeline y documentacion.
- Una feature no esta operativamente terminada mientras exista una capacidad que funcione en la composicion local pero no este declarada, desplegada y verificada en OpenShift, salvo una dependencia externa marcada expresamente como `PLATFORM_INPUT_REQUIRED` que no pueda ser sustituida de forma segura.
- El cierre debe demostrar uno de estos resultados: `GITOPS_RECONCILED` cuando exista reconciliador, o `DIRECT_APPLY_DEVIATION` cuando el reconciliador no exista. La simple generacion de YAML, un build exitoso o una pagina inicial accesible no prueban convergencia.

Fallback automatico para ambientes no productivos sin GitOps

- Este fallback solo se evalua despues de que el preflight confirme una sesion `oc`
  valida. Ausencia de GitOps y ausencia de autenticacion son estados distintos: la
  primera activa el fallback; la segunda detiene todo el flujo con
  `OPENSHIFT_SESSION_REQUIRED`.
- Si el destino es no productivo y el cluster no ofrece un reconciliador GitOps
  operativo con los permisos disponibles, el LLM debe ejecutar una entrega temporal
  desde los mismos manifiestos declarativos versionados, sin solicitar una nueva
  confirmacion para cada feature dentro del namespace autorizado.
- Antes de aplicar, el LLM debe comparar la topologia local con los manifiestos
  renderizados. Todo componente nuevo debe tener workload, Service cuando requiera
  descubrimiento, identidad, configuracion, conectividad, probes y pipeline de imagen;
  tambien se deben incluir migraciones, Jobs, CronJobs, datos y Route cuando apliquen.
- La excepcion no convierte el estado observado en operacion GitOps completada. Debe
  registrarse como `DIRECT_APPLY_DEVIATION`, con ambiente, motivo, alcance, commit,
  digests, comandos automatizados, resultado del smoke test y prerrequisito pendiente.
- La excepcion nunca autoriza credenciales en prompts, tags mutables, privilegios,
  exposicion adicional, saltarse migraciones ni afirmar backup/rollback no probados.
- Solo se despliega el subconjunto seguro y funcional. Capacidades sin dependencia
  disponible, como backup, OIDC corporativo o tareas programadas incompletas, deben
  deshabilitarse declarativamente en un overlay de prueba y quedar documentadas.
- La secuencia minima es `render -> validacion server-side -> datos -> migracion ->
  workloads -> rollout -> Route -> smoke`. Un fallo detiene la fase siguiente.
- Al finalizar la implementacion completa de cada feature o servicio, el flujo debe
  volver a renderizar y aplicar una sola vez el overlay completo o un delta calculado
  de manera segura, esperar los controladores afectados y ejecutar smoke tests que
  demuestren el comportamiento nuevo y la no regresion del existente. No se despliega
  por cada cambio de linea, archivo guardado, commit intermedio o tarea parcial.
- La aplicacion directa se limita al proyecto/namespace autorizado. Crear un proyecto
  nuevo es el default cuando las instrucciones del entorno asi lo establezcan; no se
  cambian otros namespaces ni se despliega a produccion sin la aprobacion requerida.
- El cierre de la desviacion consiste en instalar o seleccionar GitOps, importar el
  mismo estado deseado y verificar que la reconciliacion no produce diferencias.
