Crea la constitucion inicial del proyecto para una aplicacion llamada "Aplicacion de Scoring Crediticio Alternativo".

Contexto del producto:
- Aplicacion web para evaluar riesgo crediticio alternativo.
- Usa datos declarados o cargados por el solicitante sobre servicios publicos, telefonia movil e ingresos estimados.
- El sistema produce un score, una banda de riesgo, factores explicables y una recomendacion operativa.
- El sistema ayuda a analistas de credito, pero no reemplaza la decision humana ni debe presentarse como aprobacion crediticia automatica definitiva.
- Debe poder ejecutarse localmente con contenedores y cumplir el bloque permanente de automatizacion OpenShift ubicado al final de este documento.

Define la constitucion con estos principios no negociables:

1. Valor de decision explicable
   - Cada evaluacion debe entregar score, banda de riesgo, factores principales y recomendacion en lenguaje claro.
   - Ningun resultado puede ser una caja negra.
   - Cuando falten datos o haya inconsistencias, el sistema debe indicar revision manual en vez de inventar certeza.

2. Contratos antes que implementacion
   - Toda frontera entre frontend, API publica, motor de scoring y persistencia debe estar descrita por contratos o modelos verificables.
   - Las APIs publicas e internas deben tener contratos versionados antes de implementar codigo consumidor.
   - El frontend no debe depender de detalles internos del motor de scoring.

3. Calidad verificable por defecto
   - Toda funcionalidad nueva debe incluir criterios de aceptacion medibles, pruebas o validaciones automatizadas y guia de ejecucion local.
   - Las especificaciones deben ser completas, precisas y suficientemente detalladas para que el plan y las tareas puedan derivarse con minima reinterpretacion.
   - Cada flujo debe cubrir entradas, validaciones, salidas, estados, autorizaciones, errores, casos limite y criterios de aceptacion.
   - El scoring debe ser deterministico para los mismos datos de entrada.
   - Deben existir casos de prueba para score bajo, medio, alto, datos incompletos, datos invalidos y errores de servicios dependientes.

4. Seguridad, privacidad y trazabilidad
   - Los datos personales y financieros deben minimizarse, validarse y protegerse.
   - Secretos y credenciales nunca deben quedar en codigo, manifiestos reales ni logs.
   - Los logs deben permitir diagnostico operativo sin exponer datos sensibles.
   - Cada evaluacion debe ser trazable por identificador, fecha, estado y version de criterios usada.

5. Operabilidad en plataforma Red Hat
   - El proyecto debe ser contenedorizable y desplegable de forma reproducible.
   - La configuracion debe provenir de variables de entorno, ConfigMaps o Secrets, no de valores hardcodeados.
   - Cada servicio debe exponer health checks, readiness cuando aplique y comportamiento claro ante fallos.
   - El entorno local debe representar razonablemente el despliegue productivo.
   - Las obligaciones comunes de automatizacion, seguridad y GitOps se rigen por el bloque permanente ubicado al final de este documento.

6. UI/UX profesional y verificable
   - La interfaz debe seguir un estilo visual definido y documentado antes de implementar pantallas.
   - Todas las pantallas deben estar visualmente centradas dentro de un contenedor responsivo, con alineacion consistente, ancho maximo controlado y gutters adaptativos por breakpoint.
   - No se permite entregar pantallas con elementos sobrelapados, texto cortado, botones que cambian el layout al interactuar, scroll horizontal accidental ni contenido oculto por headers, footers o barras fijas.
   - La tipografia debe usar una escala consistente, jerarquia clara, line-height legible y contraste WCAG AA como minimo.
   - Formularios, tablas, tarjetas, estados vacios, errores, loading y resultados deben tener estados completos y coherentes.
   - Cada pantalla principal debe verificarse en mobile, tablet y desktop antes de considerarse lista.

Gobernanza requerida:
- Version inicial de constitucion: 1.0.0.
- Usa la fecha actual como fecha de ratificacion y ultima enmienda.
- Todo `spec.md` debe explicar alcance, actores, flujos de usuario, requisitos funcionales, reglas de negocio, matriz de validaciones, escenarios de error, requisitos UI/UX, criterios de exito, entidades clave y supuestos.
- Todo `plan.md` debe incluir chequeo de constitucion, investigacion de decisiones tecnicas, sistema visual, modelo de datos, contratos, quickstart y estrategia de validacion.
- El objetivo de SDD en este proyecto es reducir iteraciones: una persona implementadora debe poder construir el MVP desde `spec.md`, `plan.md`, contratos y tareas sin tener que redescubrir reglas de negocio esenciales.
- Ninguna tarea de implementacion puede comenzar si quedan clarificaciones criticas sin resolver en la especificacion o si el plan viola la constitucion sin una justificacion explicita.
- Las enmiendas se aprueban actualizando la constitucion, registrando impacto en templates y elevando version con semver:
  - MAJOR para cambios incompatibles en principios o gobierno.
  - MINOR para principios, secciones o obligaciones nuevas.
  - PATCH para aclaraciones o correcciones editoriales.

Al finalizar, no dejes placeholders sin explicar y actualiza cualquier template dependiente que quede inconsistente con la constitucion.

---

Bloque permanente para entrega automatizada en Red Hat OpenShift

Este bloque es constante y reutilizable en cualquier proyecto. No debe contener nombres de cliente, URLs de cluster, namespaces, tokens ni valores propios de un ambiente. Los datos variables se recopilan durante `specify` y se convierten en decisiones y artefactos durante `plan`.

7. Despliegue declarativo y automatizado
   - El estado deseado de la aplicacion y de cada ambiente debe quedar versionado en Git mediante manifiestos declarativos, overlays o artefactos equivalentes.
   - El despliegue continuo debe ser realizado por un reconciliador GitOps. El modelo puede generar y actualizar configuracion, pero no debe convertir cambios manuales e irrepetibles sobre el cluster en la fuente de verdad.
   - Las imagenes promovidas deben ser inmutables e identificables por digest. No se permite promover a produccion usando etiquetas mutables como `latest`.
   - Todo ambiente debe tener estrategia de rollback documentada y verificable mediante reversion del cambio Git o promocion de un digest anterior conocido.
   - Desarrollo puede desplegarse automaticamente despues de superar controles. Staging y produccion deben respetar las aprobaciones definidas por el propietario de la plataforma.

8. Identidades, credenciales y minimo privilegio
   - Nunca se debe pedir al cliente que pegue tokens, kubeconfigs, contrasenas, llaves privadas o pull secrets dentro de prompts, `spec.md`, `plan.md`, tareas, commits, logs o manifiestos de ejemplo.
   - Al cliente se le debe solicitar el metodo de autenticacion y la referencia al gestor seguro donde la credencial sera entregada. El valor real se inyecta solamente en tiempo de ejecucion.
   - Deben existir identidades separadas para descubrimiento, integracion continua y despliegue. Ninguna identidad automatizada debe usar `cluster-admin` salvo un bootstrap excepcional, temporal, auditado y aprobado.
   - La identidad de despliegue debe estar limitada a los namespaces y recursos necesarios. Antes de aplicar cambios se deben verificar permisos efectivos con controles equivalentes a `oc auth can-i`.
   - Los secretos de aplicacion deben proceder de un Secret, un operador de secretos o un gestor aprobado por la plataforma. Git solo puede contener nombres de claves, referencias y ejemplos sin valores reales.
   - Los tokens personales son aceptables unicamente para una prueba manual temporal. La automatizacion estable debe usar ServiceAccount, workload identity, GitHub App u otra identidad no humana administrable y revocable.

9. Controles obligatorios antes y despues del despliegue
   - Antes de construir: especificacion, plan, contratos y tareas deben estar consistentes y sin aclaraciones criticas pendientes.
   - Antes de publicar una imagen: deben aprobar pruebas, validacion de contratos, lint, analisis de dependencias, busqueda de secretos y escaneo de imagen.
   - Antes de reconciliar un ambiente: deben aprobar renderizado, validacion de esquema, politicas de seguridad, diff del cambio y verificacion de que no se incluyen secretos reales.
   - Despues del despliegue: deben verificarse rollout, health/readiness, Route o punto de acceso, logs sin datos sensibles y al menos un smoke test funcional.
   - La evidencia debe asociar commit, ejecucion de pipeline, digest de imagen, ambiente, usuario o identidad, fecha y resultado del despliegue.

10. Uso seguro de agentes y del OpenShift MCP Server
   - El OpenShift MCP Server puede utilizarse para descubrir capacidades, inspeccionar recursos, validar permisos, observar rollouts y diagnosticar fallos del cluster; no sustituye los contratos declarativos ni la fuente de verdad GitOps.
   - El acceso inicial del MCP debe ser de solo lectura, restringido a un unico contexto y sin acceso a recursos `Secret`. Las operaciones destructivas deben permanecer deshabilitadas.
   - Un agente no debe recibir una credencial permanente de administrador ni aplicar cambios de produccion fuera del flujo GitOps aprobado.
   - Cuando se habilite escritura para un entorno de desarrollo, debe usarse una identidad dedicada, namespace-scoped, auditable y revocable. Staging y produccion deben seguir el flujo de promocion y aprobacion.
   - La informacion normativa debe contrastarse con documentacion oficial de Red Hat. El MCP se usa para consultar el estado real del cluster, no como sustituto de la documentacion del producto.

11. Regla de preparacion de plataforma
   - La implementacion puede iniciar sin credenciales reales, usando ejemplos y validaciones estaticas.
   - La automatizacion de despliegue no puede declararse terminada hasta que exista un perfil de plataforma completo, una identidad valida inyectada por canal seguro, permisos comprobados, repositorio GitOps accesible y criterios de promocion definidos.
   - Si falta un dato de plataforma bloqueante, el modelo debe marcar `ERROR: PLATFORM_INPUT_REQUIRED`, enumerar solamente los campos faltantes y continuar con todo artefacto que pueda validarse sin acceso al cluster.
