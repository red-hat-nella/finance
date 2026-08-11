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
   - El LLM debe inferir primero desde los artefactos del proyecto, aplicar despues defaults conservadores y descubrir finalmente las capacidades del cluster mediante acceso de solo lectura cuando este disponible.
   - No se debe preguntar al cliente por decisiones implementativas que el LLM pueda resolver, tales como nombres internos, probes basicas, puertos detectables, organizacion de manifiestos, estrategia de build compatible, recursos iniciales prudentes o separacion entre componentes.
   - Solo se puede solicitar informacion que sea externa al proyecto, no descubrible y necesaria para continuar: destino autorizado, acceso seguro, restricciones corporativas, dominios controlados, datos regulatorios o aprobaciones que el LLM no pueda otorgarse.
   - Toda aclaracion de plataforma imprescindible debe agruparse en una unica solicitud corta. La falta de acceso al cluster no debe impedir generar, renderizar y validar estaticamente los artefactos.

3. Plataforma declarativa y operacion sin pasos manuales
   - El estado deseado de cada ambiente debe quedar versionado como codigo y ser reconciliado mediante OpenShift GitOps o una capacidad GitOps equivalente aprobada.
   - La integracion continua debe probar, analizar, construir una sola vez, publicar una imagen inmutable, actualizar la referencia por digest y producir evidencia trazable.
   - Los despliegues ordinarios no deben depender de comandos manuales del cliente. Las acciones manuales se limitan al bootstrap o a aprobaciones organizacionales expresamente requeridas.
   - Todo cambio debe permitir promocion controlada, deteccion de fallos, rollback a una version saludable y trazabilidad entre commit, imagen, configuracion y ambiente.

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

- `spec.md` define resultados operativos observables y restricciones de negocio, no obliga al cliente a disenar la plataforma.
- `plan.md` debe producir la arquitectura concreta de OpenShift a partir de la aplicacion y justificar cualquier componente de plataforma adicional.
- `tasks.md` debe incluir la generacion, validacion y prueba de todos los artefactos necesarios para desplegar sin pasos manuales ordinarios.
- `tasks.md` debe incluir la generacion y verificacion de la documentacion operativa final a partir de manifiestos renderizados y, cuando exista acceso, del estado real del cluster.
- Una decision inferida debe registrarse con su evidencia y default. Un dato descubierto debe registrar su fuente sin copiar informacion sensible.
- Si falta un dato externo realmente bloqueante, el LLM debe completar todo el trabajo independiente de ese dato y emitir `PLATFORM_INPUT_REQUIRED` con solo los campos imprescindibles, su motivo y el canal seguro esperado.
- Nunca se debe convertir una preferencia no expresada en una pregunta bloqueante. Ante opciones equivalentes, el LLM elige la alternativa mas simple, soportada, reversible y coherente con el proyecto.

Excepcion controlada para pruebas efimeras sin GitOps

- Si el destino es inequivocamente de prueba, el usuario autoriza expresamente la
  aplicacion directa y el cluster no ofrece un reconciliador GitOps instalable con
  los permisos disponibles, el LLM puede ejecutar una entrega temporal desde los
  mismos manifiestos declarativos versionados.
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
- El cierre de la desviacion consiste en instalar o seleccionar GitOps, importar el
  mismo estado deseado y verificar que la reconciliacion no produce diferencias.
