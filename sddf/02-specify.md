---

Bloque para `specify`: requisitos de ejecucion en Red Hat OpenShift

Al generar `spec.md`, trata OpenShift como el destino operativo de la aplicacion. No pidas al cliente que disene el despliegue ni conviertas la especificacion funcional en un cuestionario de infraestructura. Deduce las necesidades operativas desde los flujos, componentes, datos, integraciones y criterios de exito descritos para el producto.

Preflight bloqueante antes de especificar

- Antes de inspeccionar o modificar los artefactos de la feature, ejecuta `oc whoami`
  y `oc whoami --show-server` como operaciones de solo lectura.
- Si cualquiera falla por falta de autenticacion, la identidad esta vacia o no se puede
  confirmar el servidor, detente inmediatamente con `OPENSHIFT_SESSION_REQUIRED`.
- Solicita al usuario que ejecute `oc login` usando el canal seguro de su organizacion y
  que confirme cuando haya terminado. No solicites ni aceptes tokens, contrasenas,
  kubeconfigs, certificados o contenido de Secrets en la conversacion.
- No continues con preguntas funcionales, especificacion, plan, implementacion,
  validacion local ni despliegue hasta que el preflight sea exitoso al reintentarlo.

Objetivo del LLM en esta fase

- Expresar QUE debe observarse cuando la aplicacion opere en OpenShift, sin decidir todavia la estructura exacta de manifiestos, pipelines o recursos Kubernetes.
- Dejar informacion suficiente para que `plan` pueda implementar la arquitectura completa de la aplicacion: monolito, microservicios, procesos asincronos, jobs, aplicacion stateless o solucion con persistencia.
- Resolver ambiguedades con inferencias conservadoras. Las preguntas al cliente deben reservarse para restricciones externas que cambien el alcance, el riesgo o la experiencia del producto.

Analisis obligatorio de la aplicacion

1. Extrae del producto un inventario logico, sin forzar decisiones tecnicas:
   - interfaces de usuario y puntos de entrada;
   - capacidades o servicios con ciclos de vida independientes;
   - procesamiento sincrono, asincrono, programado o de larga duracion;
   - datos que deben sobrevivir reinicios y datos temporales;
   - integraciones de entrada y salida;
   - operaciones de inicializacion, migracion o mantenimiento;
   - flujos criticos cuya disponibilidad debe comprobarse.

2. Para cada capacidad identificada, documenta requisitos observables:
   - quien o que la consume;
   - si requiere acceso externo o solo comunicacion interna;
   - estado que conserva y consecuencias de perderlo;
   - necesidades conocidas de concurrencia, latencia, volumen o ejecucion programada;
   - comportamiento esperado ante reinicio, dependencia no disponible y despliegue parcial;
   - senal funcional que permite determinar que esta lista y saludable.

3. Deriva los requisitos de datos sin elegir prematuramente un producto:
   - consistencia, durabilidad, retencion, residencia y sensibilidad;
   - backup y restauracion esperados segun el impacto de perdida;
   - necesidad de migraciones y compatibilidad entre versiones;
   - almacenamiento compartido, por instancia, de objetos o base de datos, solo si el producto lo requiere.

4. Deriva requisitos de operacion:
   - ambientes necesarios a partir del proceso de validacion y liberacion descrito;
   - disponibilidad y recuperacion proporcionales a la criticidad del producto;
   - configuracion variable por ambiente;
   - trazabilidad entre version de aplicacion y resultado funcional;
   - logs, metricas y alertas necesarios para detectar fallos de los flujos principales;
   - criterio de smoke test basado en una accion real y segura del usuario o consumidor.

5. Deriva el delta de despliegue de la feature:
   - compara la arquitectura y composicion local anterior con la resultante;
   - identifica capacidades ejecutables nuevas, modificadas y retiradas;
   - para una nueva frontera desplegable, como un microservicio, exige su incorporacion completa a OpenShift y no solo su ejecucion local;
   - identifica cambios requeridos en exposicion, comunicacion interna, datos, migraciones, configuracion, identidades, tareas programadas y observabilidad;
   - define una comprobacion de paridad que pruebe que el comportamiento disponible localmente tambien queda disponible en OpenShift mediante equivalentes seguros por ambiente.

Seccion que debe agregar `spec.md`

Genera una seccion `Requisitos operativos en OpenShift` que contenga:

- `Perfil de ejecucion`: resumen de capacidades, consumidores, exposicion, estado y ciclo de vida.
- `Matriz de componentes logicos`: capacidad, tipo de trabajo, dependencias, persistencia, acceso y condicion de salud. Los nombres son logicos, no nombres definitivos de recursos OpenShift.
- `Matriz de datos`: dato, propietario, durabilidad, sensibilidad, retencion, recuperacion y migracion requerida.
- `Escenarios operativos`: primera instalacion, despliegue ordinario, escalado, reinicio, fallo de dependencia, migracion, rollback y restauracion cuando aplique.
- `Delta de arquitectura y paridad`: componentes agregados, modificados o retirados por la feature y resultado observable equivalente exigido en local y OpenShift.
- `Requisitos testables`: resultados observables de build, despliegue, disponibilidad, conectividad, persistencia, seguridad y recuperacion.
- `Documentacion de entrega`: informacion operativa que debe recibir el equipo al finalizar, incluyendo arquitectura, ambientes, endpoints, recursos desplegados, dependencias, acceso no sensible y procedimientos principales.
- `Supuestos y restricciones externas`: solo decisiones que no pertenecen al diseno interno de la aplicacion.

Defaults que no requieren preguntar al cliente

- Separar componentes solo cuando tengan distinta responsabilidad, politica de escalado, superficie de seguridad o ciclo de vida; mantener juntos los que formen un monolito real.
- Mantener internos todos los componentes salvo los puntos de entrada exigidos por los flujos de usuario o integracion.
- Exigir TLS para trafico externo, configuracion por ambiente, secretos fuera de Git, health checks, recursos iniciales conservadores y despliegue declarativo.
- Considerar desarrollo como despliegue automatico despues de controles; exigir promocion controlada para ambientes de mayor criticidad.
- Exigir backup y restauracion para datos durables, sin imponer una tecnologia hasta `plan`.
- Adoptar disponibilidad y escalado modestos cuando no existan objetivos cuantificados, dejando esos valores como supuestos ajustables y no como bloqueos.

Interaccion minima con el cliente

No preguntes por namespaces, YAML, Deployments, Routes, operadores, nombres de ServiceAccounts, estructura GitOps, probes, requests/limits, herramientas de pipeline ni clases de almacenamiento. Esos datos deben ser inferidos, decididos en `plan` o descubiertos en la plataforma.

La autenticacion de `oc` es la excepcion previa: si no existe una sesion valida, no se
agrupa con aclaraciones posteriores ni se difiere como `PLATFORM_INPUT_REQUIRED`; se
detiene el flujo y se emite `OPENSHIFT_SESSION_REQUIRED` antes de cualquier otro trabajo.

Solo usa `[NEEDS CLARIFICATION: PLATFORM_INPUT]` cuando falte una restriccion externa que no pueda inferirse y cambie materialmente la solucion, por ejemplo:

- cluster o dominio organizacional que el cliente controla y no puede descubrirse con el acceso disponible;
- obligacion regulatoria de residencia, retencion, aislamiento o cifrado;
- servicio corporativo que deba reutilizarse obligatoriamente;
- objetivo contractual de disponibilidad o recuperacion no deducible del producto;
- aprobacion humana obligatoria para liberar a un ambiente regulado.

Agrupa todos los campos imprescindibles en un unico marcador, explica por que bloquean y continua especificando todo lo demas. Nunca solicites tokens, contrasenas, kubeconfigs, llaves o valores de Secret. Cuando se requiera acceso posterior, registra solamente el tipo de identidad y la referencia al canal seguro.

Criterios de aceptacion que siempre deben quedar cubiertos

- La arquitectura funcional completa puede desplegarse sin que el cliente traduzca sus componentes a recursos OpenShift.
- Un cambio aceptado produce una version trazable y una actualizacion declarativa del ambiente.
- El fallo de build, politica, migracion, rollout o smoke test detiene la promocion y deja un diagnostico accionable sin secretos.
- Solo los puntos de entrada requeridos quedan expuestos; la comunicacion interna y los datos mantienen el aislamiento especificado.
- Los datos declarados durables sobreviven recreaciones de workloads y disponen de un criterio verificable de backup y restauracion.
- El sistema puede volver a una version saludable sin repetir manualmente el despliegue.
- La ausencia temporal de acceso al cluster no impide que el flujo SDD produzca una especificacion completa.
- La entrega incluye documentacion verificable de lo creado: cluster o contexto, namespaces, workloads y pods esperados, Services, Routes, URLs, persistencia, servicios de datos, Jobs, identidades y estado del despliegue, sin revelar secretos.
- Todo componente que la feature agregue a la composicion local queda incluido en el inventario OpenShift y dispone de workload, imagen, configuracion, identidad, conectividad, probes, politica de red y recursos auxiliares aplicables.
- Cada cambio aceptado converge en el ambiente OpenShift autorizado: mediante reconciliacion GitOps cuando exista o mediante aplicacion directa automatizada y registrada cuando GitOps no este disponible.
- El smoke test de la feature demuestra tanto el comportamiento nuevo como la continuidad de los flujos existentes; una diferencia funcional entre local y OpenShift impide declarar la feature terminada.
- La convergencia ocurre como ultima fase de la feature, despues de completar y validar conjuntamente codigo, contratos, datos, UI, manifiestos y pruebas. La especificacion no debe exigir despliegues por edicion, archivo, commit intermedio ni tarea parcial.

Requisitos para una demostracion acelerada

- Si el producto admite un modo de autenticacion de desarrollo ya implementado, la
  especificacion puede permitirlo solo en un ambiente de prueba aislado. No se debe
  inventar un bypass nuevo ni trasladarlo a staging o produccion.
- La ausencia de GitOps, OIDC, backup u otra capacidad opcional no debe ocultarse:
  cada una se clasifica como `PENDING_VALIDATION` y se declara que funcionalidades
  quedan deshabilitadas o fuera del criterio de terminado completo.
- El criterio minimo observable de una demo desplegada exige workloads saludables,
  unica Route externa con TLS, datos inicializados mediante migracion separada y un
  smoke test sintetico del flujo principal. Que la pagina cargue no es suficiente.
- La especificacion debe distinguir `APP_AVAILABLE_FOR_TEST` de
  `PLATFORM_DELIVERY_COMPLETE`; el primero puede alcanzarse mediante una desviacion
  temporal, mientras el segundo conserva todos los criterios de GitOps, backup,
  rollback y promocion.
- En un cluster no productivo autorizado sin GitOps, la demostracion no se limita a
  documentar el bloqueo: debe aplicar automaticamente el estado deseado, crear los
  recursos faltantes de componentes nuevos, esperar sus rollouts y registrar una
  `DIRECT_APPLY_DEVIATION`. Produccion sigue requiriendo su control de promocion.
