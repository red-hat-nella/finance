Crea la constitucion inicial del proyecto para una aplicacion llamada "Aplicacion de Scoring Crediticio Alternativo".

Contexto del producto:
- Aplicacion web para evaluar riesgo crediticio alternativo.
- Usa datos declarados o cargados por el solicitante sobre servicios publicos, telefonia movil e ingresos estimados.
- El sistema produce un score, una banda de riesgo, factores explicables y una recomendacion operativa.
- El sistema ayuda a analistas de credito, pero no reemplaza la decision humana ni debe presentarse como aprobacion crediticia automatica definitiva.
- Debe poder ejecutarse localmente con contenedores y desplegarse en Red Hat OpenShift.

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
   - El proyecto debe ser contenedorizable y desplegable en OpenShift.
   - La configuracion debe provenir de variables de entorno, ConfigMaps o Secrets, no de valores hardcodeados.
   - Cada servicio debe exponer health checks, readiness cuando aplique y comportamiento claro ante fallos.
   - El entorno local debe representar razonablemente el despliegue productivo.

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
