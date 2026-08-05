Genera el plan de implementacion para el MVP de scoring crediticio alternativo definido en la especificacion activa.

Stack objetivo:
- Frontend: Angular 18 con Angular Material.
- API publica de ingestion: Node.js, TypeScript y Express.
- Motor interno de scoring: Python 3.12 y FastAPI.
- Persistencia: PostgreSQL.
- Ejecucion local: Docker Compose o Podman Compose.
- Despliegue: contenedores y manifiestos para Red Hat OpenShift.

Arquitectura esperada:
- `frontend/`: formulario de solicitud, vista de resultado e historico.
- `services/ingestion/`: API publica, validacion de entrada, persistencia, historico y orquestacion del scoring.
- `services/scoring/`: API interna con calculo deterministico del score.
- `db/migrations/`: esquema inicial de PostgreSQL.
- `deploy/openshift/`: Deployments, Services, Routes, ConfigMaps, Secrets de ejemplo y health checks.
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
   - Como desplegar una ruta basica en OpenShift usando manifiestos del repo.
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
- Validacion estatica de manifiestos OpenShift.
- Al menos una prueba end-to-end del flujo registro -> evaluacion -> resultado -> historico.

Nivel de detalle requerido:
- El plan debe ser casi replicable como codigo: no solo elegir tecnologias, sino definir modulos, responsabilidades, fronteras, contratos, modelos, comandos, variables de entorno, errores, health checks y pruebas esperadas.
- Incluye estructura de carpetas propuesta con archivos principales y proposito de cada uno.
- Incluye estructura de carpetas frontend para componentes reutilizables, layout, tema, tokens, formularios, vistas y pruebas visuales.
- Incluye pseudocodigo o algoritmo detallado para el calculo deterministico del score, con pesos, umbrales, bandas, motivos de revision manual y factores explicables. No dejes el algoritmo como "pendiente".
- Define la estrategia de validacion de entrada en frontend y API, incluyendo reglas compartidas, diferencias y mensajes esperados.
- Define la estrategia UI con Angular Material: tema centralizado, componentes consistentes, densidad apropiada, formularios accesibles, tablas responsivas y estilos sin valores hardcodeados dispersos.
- Define migraciones iniciales de base de datos a nivel de tablas, columnas, constraints e indices.
- Define variables de entorno requeridas para local y OpenShift, con valores de ejemplo no secretos.
- Define manifiestos OpenShift esperados por componente: Deployment, Service, Route cuando aplique, ConfigMap, Secret de ejemplo, probes y recursos minimos.
- Incluye una matriz de pruebas con nombre de prueba, capa, datos usados, resultado esperado y criterio de exito.
- Incluye pruebas visuales/responsive con capturas o validaciones equivalentes para formulario, resultado e historico en mobile, tablet y desktop.
- Incluye criterios UI de "done": contenido centrado, alineacion consistente, tipografia coherente, contraste AA, foco visible, sin overlap, sin scroll horizontal, sin texto cortado y estados completos.
- Incluye una secuencia de implementacion recomendada que pueda convertirse en `tasks.md` con minimo retrabajo.
- Si una decision queda abierta, marca ERROR solo si bloquea implementacion; en los demas casos toma una decision conservadora y documenta la razon.

Resultado esperado:
- El plan debe quedar listo para generar tareas de implementacion sin volver a discutir arquitectura base.
- Los artefactos deben usar rutas relativas del proyecto y comandos ejecutables.
- El plan debe favorecer simplicidad, trazabilidad y despliegue reproducible.
