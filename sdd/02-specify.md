Especifica el MVP de una aplicacion web de scoring crediticio alternativo.

Objetivo:
Permitir que un analista de credito registre una solicitud, capture datos alternativos del solicitante, ejecute una evaluacion de riesgo y consulte el resultado historico de evaluaciones anteriores.

Actores principales:
- Analista de credito: registra solicitudes, revisa resultados y consulta historico.
- Solicitante: persona evaluada. Sus datos son ingresados por el analista con consentimiento registrado.
- Supervisor o auditor: consulta evaluaciones pasadas para revision operativa.

Flujos principales:
1. Registro de solicitud
   - El analista captura identificacion basica del solicitante, datos de contacto, consentimiento, ingresos estimados, referencias de servicios publicos y datos de telefonia movil.
   - El sistema valida campos obligatorios, formatos, rangos y consistencia basica antes de permitir la evaluacion.

2. Evaluacion de riesgo
   - El analista solicita calcular el score.
   - El sistema devuelve un identificador de evaluacion, score numerico, banda de riesgo, recomendacion operativa y factores que explican el resultado.
   - Si faltan datos relevantes o hay inconsistencias, el resultado debe marcar revision manual.

3. Consulta de resultado
   - El analista ve el resultado en pantalla con fecha, estado, score, banda, recomendacion y factores.
   - El resultado debe ser comprensible sin conocer la implementacion interna del algoritmo.

4. Historico
   - El analista puede consultar evaluaciones previas, filtrar por identificador del solicitante, fecha o estado, y abrir el detalle de una evaluacion.

Requisitos UI/UX del producto:
- La aplicacion debe sentirse como una herramienta financiera profesional, sobria, clara y orientada al trabajo diario de analistas.
- Todas las vistas principales deben presentar su contenido centrado en la pantalla dentro de un contenedor responsivo con ancho maximo legible.
- El layout debe mantener alineacion consistente entre encabezados, formularios, acciones, resultados e historico.
- Ningun elemento debe sobrelaparse con otro en mobile, tablet o desktop.
- El texto no debe cortarse, salirse de botones o tarjetas, ni invadir contenido vecino.
- La tipografia debe tener jerarquia clara para titulo de pantalla, secciones, labels, texto de ayuda, errores, valores de score y datos tabulares.
- Los formularios deben mostrar labels visibles, texto de ayuda cuando aplique, errores cerca del campo afectado y foco automatico al primer error despues de intentar enviar.
- Las acciones principales deben ser evidentes, con una sola accion primaria por pantalla o seccion critica.
- Estados obligatorios de UI: carga, exito, error, vacio, datos invalidos, revision manual y resultado evaluado.
- La pantalla de resultado debe destacar score, banda y recomendacion sin tapar los factores explicativos ni perder legibilidad.
- El historico debe ser facil de escanear, con columnas o tarjetas adaptadas al tamano de pantalla y sin scroll horizontal accidental.
- La interfaz debe cumplir contraste minimo WCAG AA, navegacion por teclado y foco visible.

Alcance incluido:
- Captura manual de datos alternativos.
- Validacion de datos antes de calcular score.
- Score deterministico para datos equivalentes.
- Resultado explicable.
- Persistencia de solicitudes y evaluaciones.
- Historico consultable.
- Estados minimos: borrador, evaluada, revision_manual, error.

Fuera de alcance para el MVP:
- Integracion real con burós de credito, operadores moviles, bancos o empresas de servicios publicos.
- Modelo de machine learning entrenado con datos reales.
- Firma electronica avanzada.
- Aprobacion automatica final de credito.
- Gestion completa de usuarios, roles empresariales complejos o workflow de desembolso.

Reglas de negocio iniciales:
- El score debe expresarse en una escala clara, por ejemplo 0 a 1000.
- Las bandas minimas deben distinguir riesgo bajo, medio y alto.
- El sistema debe explicar al menos 3 factores cuando existan datos suficientes.
- Datos incompletos o contradictorios deben producir revision manual, no una recomendacion definitiva.
- Cada evaluacion debe conservar la version de criterios usada para calcularla.

Requisitos de privacidad y seguridad:
- Registrar consentimiento antes de evaluar.
- No mostrar secretos ni datos sensibles en mensajes de error.
- Minimizar datos visibles en historico, mostrando detalle solo al abrir una evaluacion.
- Permitir trazabilidad por identificador de evaluacion sin depender de datos personales como clave principal visible.

Criterios de exito esperados:
- Un analista puede registrar y evaluar una solicitud completa en menos de 5 minutos.
- El 100% de las evaluaciones produce score, banda, recomendacion o estado de revision manual con motivo.
- El historico permite encontrar una evaluacion existente en menos de 30 segundos usando identificador, fecha o estado.
- Los casos de datos invalidos bloquean la evaluacion con mensajes accionables.
- Los resultados son entendibles por un usuario no tecnico durante revision operativa.

Instrucciones para la especificacion:
- Describe QUE debe lograr el producto y POR QUE, no COMO implementarlo.
- No menciones frameworks, lenguajes, bases de datos, APIs internas ni estructura de carpetas.
- Haz suposiciones razonables y registralas en la seccion de supuestos.
- Usa como maximo 3 marcadores [NEEDS CLARIFICATION] y solo para decisiones que cambien alcance, seguridad o experiencia de usuario.
- Genera requisitos funcionales testables y criterios de aceptacion claros.
- Incluye escenarios felices, datos invalidos, datos incompletos, error al calcular score y consulta de historico vacio.

Nivel de detalle requerido:
- La especificacion debe quedar tan completa que el plan tecnico y las tareas se puedan generar sin tener que hacer muchas rondas de refinamiento.
- Para cada flujo principal, incluye:
  - precondiciones;
  - datos de entrada visibles para el usuario;
  - validaciones de negocio;
  - resultado esperado;
  - estados afectados;
  - errores recuperables;
  - casos limite;
  - criterios de aceptacion verificables.
- Para cada requisito funcional, usa lenguaje obligatorio y testeable: "El sistema debe..." o "El usuario debe poder...".
- Evita requisitos genericos como "manejar errores correctamente"; reemplazalos por errores concretos, mensajes esperados y comportamiento observable.
- Incluye una matriz de validaciones funcionales con campo, regla, mensaje para usuario y efecto sobre la evaluacion.
- Incluye una matriz de estados con estado, significado, quien lo dispara y transiciones permitidas.
- Incluye una matriz UI/UX por pantalla con objetivo de usuario, contenido principal, accion primaria, estados requeridos, comportamiento responsive y criterios visuales de aceptacion.
- Incluye reglas explicitas para evitar problemas visuales: centrado, alineacion, ancho maximo, jerarquia tipografica, no solapamiento, no texto truncado sin alternativa, no scroll horizontal y contraste accesible.
- Incluye una lista de eventos o acciones auditables, aunque el detalle tecnico se defina luego en el plan.
- Incluye datos de ejemplo realistas para al menos 3 perfiles: riesgo bajo, riesgo medio y riesgo alto.
- No dejes secciones con frases pendientes como "definir despues", salvo en los maximo 3 marcadores [NEEDS CLARIFICATION] permitidos.

---

Bloque variable para entrega automatizada en Red Hat OpenShift

Este bloque se agrega al final para que la parte funcional del producto permanezca independiente de la plataforma. La especificacion debe registrar QUE resultado operativo necesita el cliente y los datos variables que condicionan alcance, seguridad o experiencia. No debe decidir aqui la implementacion de pipelines o manifiestos.

Informacion que se debe solicitar al cliente

1. Identidad y propiedad del proyecto
   - Nombre visible y slug tecnico deseado para la aplicacion.
   - Equipo propietario, contacto operativo y contacto que aprueba promociones.
   - URL del repositorio de aplicacion y proveedor Git.
   - Ambientes requeridos: desarrollo, staging y/o produccion.
   - Repositorio GitOps existente o autorizacion para que la plataforma cree uno.

2. Destino OpenShift, sin secretos
   - URL de la API del cluster o nombre del contexto autorizado.
   - Namespace existente por ambiente o patron de nombres permitido.
   - Dominio base o hostname requerido para Routes.
   - Registro de imagenes permitido: registro interno, Red Hat Quay u otro compatible.
   - Region, zona, requisitos de residencia de datos y restricciones de red relevantes.
   - Operadores o servicios ya disponibles: OpenShift Pipelines, Pipelines as Code, OpenShift GitOps, Developer Hub, Quay, gestor de secretos y observabilidad.

3. Acceso y entrega segura de credenciales
   - Metodo autorizado: ServiceAccount, workload identity, GitHub App, kubeconfig dedicado o token temporal.
   - Identidad responsable de crear namespaces, RBAC, webhooks y aplicaciones GitOps durante el bootstrap.
   - Nombre o referencia del secreto en el gestor de CI/CD; nunca solicitar el valor del token en este documento.
   - Duracion y mecanismo de renovacion de credenciales temporales.
   - Confirmacion de si el cliente permite acceso MCP de solo lectura para descubrir el cluster.
   - Confirmacion separada para cualquier escritura asistida por un agente en desarrollo. La ausencia de esta confirmacion implica solo lectura.

4. Exposicion, datos y operacion
   - Componentes que deben ser publicos y componentes que deben permanecer internos.
   - Requisitos de TLS, certificado, DNS, SSO/OIDC y origenes CORS permitidos.
   - Persistencia requerida, capacidad inicial, clase de almacenamiento aprobada, backups y retencion.
   - Perfil esperado de uso, disponibilidad, ventana de mantenimiento, recursos o cuotas conocidas.
   - Health checks funcionales y smoke test que demuestren que el despliegue quedo utilizable.
   - Requisitos de logging, metricas, alertas y datos que deben excluirse de observabilidad.

5. Promocion y gobierno
   - Ambientes que pueden recibir despliegue automatico despues de merge.
   - Ambientes que requieren aprobacion manual y rol autorizado para aprobar.
   - Politicas obligatorias: firmas, SBOM, escaneo de imagen, severidad maxima admitida y excepciones.
   - Estrategia de rollback y objetivo de recuperacion esperado.
   - Politica de eliminacion de ambientes efimeros y conservacion de evidencia de despliegue.

Reglas para generar la especificacion

- La especificacion debe incluir requisitos testables de desplegabilidad: un commit aceptado produce una imagen trazable, un cambio declarativo, un rollout saludable y evidencia consultable.
- Debe definir por ambiente quien puede promover, que controles bloquean y que comportamiento observa el usuario cuando un despliegue falla.
- Debe distinguir bootstrap inicial de operacion continua. El bootstrap puede requerir participacion de plataforma; los despliegues ordinarios no deben requerir intervencion manual del cliente.
- Si el cliente desconoce un valor descubrible, debe registrarse como `DESCUBRIBLE_CON_MCP` y resolverse en el plan usando acceso de solo lectura.
- Si faltan URL de cluster, namespace o capacidad para crearlo, repositorio GitOps, metodo de autenticacion o propietario de aprobaciones, usar un unico marcador `[NEEDS CLARIFICATION: PLATFORM_PROFILE]` con la lista concreta de datos faltantes. No inventar estos valores.
- La especificacion nunca debe almacenar la credencial. Para una conexion externa puede mencionar nombres como `OPENSHIFT_API_URL`, `OPENSHIFT_TOKEN` o `KUBECONFIG`, pero el valor se entrega por el gestor seguro acordado.

Criterios de aceptacion de plataforma que deben quedar en la especificacion

- Un cambio aprobado debe poder llegar al ambiente objetivo sin ejecutar pasos manuales no documentados.
- Cada despliegue debe identificar commit, digest de imagen, ambiente, fecha, resultado y enlace o referencia a la ejecucion.
- Un fallo de build, prueba, politica, autenticacion, reconciliacion o health check debe detener la promocion y producir un mensaje accionable sin exponer secretos.
- Una credencial expirada debe producir un estado de autenticacion identificable y un procedimiento de renovacion, sin degradar a una credencial de mayor privilegio.
- El cliente debe poder recuperar la ultima version saludable mediante el procedimiento de rollback acordado.
- La ausencia del MCP no debe impedir CI/CD si el perfil de plataforma y las credenciales de pipeline ya estan configurados.
