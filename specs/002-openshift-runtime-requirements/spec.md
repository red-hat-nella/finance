# Feature Specification: Ejecución operativa en OpenShift

**Feature Branch**: `main`

**Created**: 2026-08-09

**Status**: Draft

**Input**: Requisitos para que la especificación funcional describa resultados
operativos observables en Red Hat OpenShift sin trasladar al cliente decisiones de
diseño de plataforma.

## Scope *(mandatory)*

### In Scope

- Derivar de los flujos, contratos, datos y código existentes el inventario lógico
  completo de capacidades que deben operar juntas.
- Especificar consumidores, exposición, estado, dependencias, ciclo de vida y señales
  funcionales de salud de cada capacidad sin elegir recursos concretos de plataforma.
- Definir comportamiento observable para primera instalación, despliegue ordinario,
  escalado, reinicio, fallo de dependencias, migración, rollback y restauración.
- Definir resultados verificables de build, promoción declarativa, disponibilidad,
  conectividad, persistencia, seguridad, recuperación y trazabilidad.
- Establecer la documentación operativa que debe acompañar cada entrega.
- Registrar inferencias conservadoras y restricciones externas sin bloquear el trabajo
  que pueda completarse sin acceso al cluster.

### Out of Scope

- Elegir nombres de namespaces, workloads, cuentas de servicio u otros recursos.
- Diseñar YAML, overlays, charts, pipelines, repositorios GitOps o políticas concretas.
- Seleccionar operadores, clases de almacenamiento, registros, gestores de secretos o
  productos de observabilidad antes de comprobar que están aprobados y disponibles.
- Solicitar o almacenar tokens, contraseñas, kubeconfigs, llaves o contenido de
  secretos.
- Cambiar las reglas de scoring, autorizaciones, retención, experiencia visual o
  contratos funcionales definidos para el MVP.
- Afirmar que un recurso existe en un cluster cuando solo se ha definido como estado
  deseado.

## Observable Operational Outcomes *(mandatory)*

- **OO-001**: Una persona planificadora puede identificar todas las capacidades de la
  aplicación, sus relaciones y ciclos de vida sin pedir al cliente que las traduzca a
  recursos de OpenShift.
- **OO-002**: Una versión aceptada se construye una sola vez, queda identificada de
  forma inmutable y actualiza declarativamente el ambiente autorizado con evidencia
  trazable.
- **OO-003**: Un fallo de build, política, migración, despliegue o smoke test detiene la
  promoción, conserva el último estado saludable y produce un diagnóstico accionable
  sin datos sensibles.
- **OO-004**: Los flujos de registrar, evaluar, consultar y auditar permanecen
  disponibles según su dependencia real; una dependencia degradada no se presenta como
  saludable ni causa pérdida silenciosa de datos confirmados.
- **OO-005**: Los datos durables sobreviven a la recreación de procesos y cuentan con
  evidencia verificable de backup y restauración.
- **OO-006**: La entrega documenta estado deseado, estado confirmado y valores
  pendientes sin revelar secretos.

## Actors & Authorization *(mandatory)*

| Actor / System | Goal | Permitted Actions and Data | Restrictions |
|----------------|------|----------------------------|--------------|
| Equipo de producto | Entregar requisitos, reglas de negocio y restricciones externas | Confirmar resultados funcionales, criticidad y obligaciones organizacionales conocidas | No necesita diseñar topología, recursos ni automatización de plataforma |
| Automatización de entrega | Validar, construir, promover y registrar evidencia de una versión | Leer código y configuración no sensible; publicar artefactos; actualizar estado deseado dentro de su alcance | No puede leer secretos de aplicación ni promover cuando falla un control obligatorio |
| Reconciliador del ambiente | Hacer converger el ambiente autorizado con el estado versionado | Leer estado deseado y observado; aplicar únicamente cambios autorizados | No puede convertir cambios manuales fuera de Git en fuente de verdad ni ampliar su alcance |
| Operador de aplicación | Verificar salud, diagnosticar y recuperar la solución | Consultar recursos, señales, documentación y referencias sensibles por nombre | No debe recibir contenido de secretos ni depender de despliegues manuales ordinarios |
| Analista de crédito | Ejecutar el flujo principal como consumidor autorizado | Registrar, evaluar y consultar solicitudes de su ámbito | No obtiene acceso directo a capacidades internas ni a datos de otros ámbitos |
| Supervisor o auditor | Verificar resultados y trazabilidad | Consultar evaluaciones y eventos autorizados en modo lectura | No modifica evaluaciones ni configuración operativa |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Liberar una versión completa (Priority: P1)

Como equipo de producto, quiero que una versión aceptada despliegue toda la arquitectura
funcional mediante un flujo declarativo para obtener un ambiente verificable sin
traducir componentes a decisiones de OpenShift ni ejecutar pasos manuales ordinarios.

**Primary Actor**: Equipo de producto, asistido por la automatización de entrega.

**Entry Conditions**: Existe un cambio aceptado con código, contratos, configuración no
sensible y criterios de validación; el destino está autorizado o puede permanecer como
valor externo pendiente sin impedir la generación estática.

**Inputs & Validation**: Commit aceptado, artefactos de aplicación, inventario lógico,
restricciones externas conocidas y referencias de configuración. Se rechazan
credenciales, referencias mutables y componentes sin evidencia.

**State Transitions**: Cambio aceptado → validado → versión inmutable publicada → estado
deseado actualizado → reconciliando → saludable, o detenido con evidencia en el primer
control fallido.

**Outputs**: Versión trazable, actualización declarativa, evidencia de controles,
estado de reconciliación y documentación actualizada.

**Authorization**: Solo identidades de automatización autorizadas pueden publicar o
actualizar el estado deseado; la promoción a ambientes de mayor criticidad respeta las
aprobaciones externas registradas.

**Errors & Edge Conditions**: Fallo de build, análisis, política, migración, rollout o
smoke test; destino temporalmente inaccesible; despliegue parcial; reintento del mismo
commit; dependencia opcional no disponible.

**Why this priority**: Sin una liberación completa y repetible no existe una operación
ordinaria segura de la aplicación.

**Independent Test**: Un cambio sintético que no altera datos se promueve hasta un
ambiente de desarrollo, mantiene una única identidad de versión y deja evidencia de
cada control; un control fallido impide avanzar.

**Acceptance Scenarios**:

1. **Given** un cambio aceptado, **When** supera todos los controles, **Then** la misma
   versión inmutable queda reconciliada y trazable desde commit hasta ambiente.
2. **Given** una migración o smoke test fallido, **When** la automatización evalúa la
   promoción, **Then** la detiene, mantiene o recupera la última versión saludable y
   publica un diagnóstico sin secretos.
3. **Given** que no hay acceso al cluster, **When** se ejecuta esta fase SDD, **Then** se
   completa la especificación y se registran como pendientes solo las validaciones que
   requieren estado real.

---

### User Story 2 - Operar y recuperar los flujos críticos (Priority: P1)

Como operador de aplicación, quiero señales funcionales y procedimientos verificables
para distinguir salud, degradación y fallo y recuperar el servicio sin perder datos ni
repetir manualmente el despliegue.

**Primary Actor**: Operador de aplicación.

**Entry Conditions**: Existe una versión reconciliada, documentación de entrega y
acceso de solo lectura al alcance autorizado; los mecanismos sensibles se referencian
por nombre y canal seguro.

**Inputs & Validation**: Estado observado, señales funcionales, métricas, logs
estructurados y evidencia de la versión. Toda observación debe tener fuente y excluir
contenido de secretos.

**State Transitions**: Saludable → degradado o no disponible → diagnóstico →
reconciliación, rollback o restauración → saludable; cada transición queda registrada.

**Outputs**: Diagnóstico accionable, estado por flujo, acción de recuperación trazable
y evidencia posterior de disponibilidad, conectividad y consistencia.

**Authorization**: La inspección comienza en solo lectura. Las acciones de recuperación
solo se ejecutan mediante la automatización y aprobaciones correspondientes.

**Errors & Edge Conditions**: Reinicio durante una evaluación, pérdida de una réplica,
motor de scoring no disponible, servicio de identidad no disponible, almacenamiento no
accesible, migración parcial, rollback con esquema compatible y restauración de backup.

**Why this priority**: La aplicación procesa información sensible y decisiones de
riesgo; una recuperación ambigua puede producir pérdida, duplicación o resultados
inconsistentes.

**Independent Test**: Se simula un fallo de una dependencia en un ambiente controlado;
las señales identifican el flujo afectado, no exponen secretos y permiten volver a un
estado saludable con la integridad esperada.

**Acceptance Scenarios**:

1. **Given** que el cálculo de scoring no está disponible, **When** un analista intenta
   evaluar, **Then** el intento queda en estado recuperable, no publica resultado
   parcial y los flujos no dependientes reflejan su salud real.
2. **Given** la recreación de procesos de aplicación, **When** finaliza la
   reconciliación, **Then** solicitudes, evaluaciones y auditoría confirmadas permanecen
   accesibles para actores autorizados.
3. **Given** una versión defectuosa, **When** se activa rollback, **Then** el sistema
   vuelve a una versión saludable sin repetir manualmente la secuencia de despliegue.

---

### User Story 3 - Recibir una entrega operable (Priority: P2)

Como equipo receptor, quiero documentación verificable y segura de la arquitectura y
del estado desplegado para operar, diagnosticar y transferir la aplicación sin depender
del equipo que realizó la implementación.

**Primary Actor**: Operador de aplicación y supervisor o auditor.

**Entry Conditions**: Existen artefactos renderizados y, cuando está autorizado, una
inspección de solo lectura del ambiente que excluye secretos.

**Inputs & Validation**: Estado deseado versionado, evidencia de entrega y observaciones
con fuente. La validación debe detectar afirmaciones sin fuente y datos sensibles.

**State Transitions**: Documentación generada → contrastada con fuentes → clasificada
como deseada, confirmada o pendiente → publicada junto con el cambio.

**Outputs**: Arquitectura, ambientes, endpoints, recursos esperados, datos,
dependencias, identidades, flujo de promoción, diagnóstico y recuperación.

**Authorization**: La documentación contiene referencias no sensibles; cualquier
acceso adicional se solicita por el canal seguro aprobado.

**Errors & Edge Conditions**: Cluster inaccesible, URL aún no asignada, recurso solo
renderizado, diferencia entre estado deseado y observado o documentación desactualizada.

**Why this priority**: La entrega no es transferible ni auditable si intención y estado
real se mezclan o dependen de conocimiento tácito.

**Independent Test**: Una persona ajena a la implementación identifica componentes,
accesos, estado, dependencias y procedimientos principales, y puede distinguir todo
valor pendiente sin recibir secretos.

**Acceptance Scenarios**:

1. **Given** manifiestos renderizados sin acceso al cluster, **When** se genera la
   documentación, **Then** los recursos se marcan como deseados y las confirmaciones
   permanecen pendientes.
2. **Given** acceso autorizado de solo lectura, **When** se contrasta el ambiente,
   **Then** cada dato confirmado registra una fuente no sensible y ninguna consulta lee
   secretos.

---

### Cross-Flow Edge Cases

- Un componente aparece en código o contratos pero no en la descripción inicial: se
  incorpora al inventario con su evidencia y no se solicita al cliente que lo nombre.
- Dos capacidades forman un monolito real: permanecen juntas salvo evidencia de ciclos
  de vida, escalado o superficies de seguridad distintos.
- Un proceso programado se solapa con su ejecución anterior: no produce procesamiento
  concurrente inseguro ni resultados duplicados.
- Una migración es compatible con la versión nueva pero no con rollback: la promoción
  se detiene hasta demostrar una ruta reversible o una recuperación aprobada.
- El destino no ofrece una capacidad opcional prevista: el plan debe usar una
  alternativa soportada o dejar el requisito explícitamente pendiente sin inventar su
  existencia.
- El cluster está inaccesible: renderizado, validación estática y documentación de
  estado deseado continúan; solo la evidencia observada permanece pendiente.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La especificación debe inventariar toda interfaz, servicio lógico,
  procesamiento síncrono, tarea programada, migración, dato durable e integración
  externa evidenciada por el proyecto.
- **FR-002**: Cada capacidad debe identificar consumidor, exposición externa o interna,
  estado conservado, dependencias, ciclo de vida y señal funcional de salud.
- **FR-003**: La separación lógica solo debe exigirse cuando cambien responsabilidad,
  política de escalado, superficie de seguridad o ciclo de vida; un monolito real debe
  conservarse como tal.
- **FR-004**: Solo los puntos de entrada requeridos por usuarios o integraciones deben
  ser accesibles externamente; toda capacidad restante debe permanecer interna.
- **FR-005**: Todo tráfico externo debe protegerse en tránsito y la comunicación
  interna debe respetar el aislamiento derivado de los flujos reales.
- **FR-006**: La configuración variable debe diferenciarse por ambiente y los secretos
  deben permanecer fuera de Git, logs, prompts, ejemplos y documentación.
- **FR-007**: Una versión aceptada debe construirse una sola vez, identificarse de
  manera inmutable y conservar trazabilidad entre commit, artefacto, configuración y
  ambiente.
- **FR-008**: Los despliegues ordinarios deben actualizarse declarativamente y poder
  reconciliarse sin una secuencia manual ejecutada por el cliente.
- **FR-009**: Desarrollo debe recibir cambios automáticamente después de controles
  exitosos; ambientes de mayor criticidad deben usar promoción controlada y respetar
  aprobaciones organizacionales registradas.
- **FR-010**: El fallo de cualquier control obligatorio de build, análisis, política,
  migración, rollout o smoke test debe detener la promoción y producir diagnóstico
  accionable sin secretos.
- **FR-011**: Cada capacidad de larga duración debe proporcionar una señal que
  diferencie proceso vivo de capacidad lista para cumplir su función.
- **FR-012**: Las señales de salud no deben declarar lista una capacidad cuando una
  dependencia indispensable para su flujo no está disponible.
- **FR-013**: Cada capacidad debe definir comportamiento observable ante reinicio,
  dependencia no disponible y despliegue parcial.
- **FR-014**: Los recursos iniciales, disponibilidad y escalado deben partir de valores
  modestos y conservadores cuando no existan objetivos cuantificados, y permanecer
  ajustables sin bloquear la especificación.
- **FR-015**: Logs, métricas y alertas deben permitir detectar fallos en registro,
  evaluación, histórico, auditoría, migración, retención y recuperación sin copiar PII,
  datos financieros completos ni secretos.
- **FR-016**: El smoke test debe ejecutar una acción real, autorizada, segura y
  reversible del flujo principal y verificar un resultado funcional, no solo la
  existencia de un proceso.
- **FR-017**: Los datos declarados durables deben sobrevivir recreaciones de procesos y
  disponer de objetivos verificables de backup y restauración proporcionales al impacto
  de pérdida.
- **FR-018**: Las migraciones deben ejecutarse de forma observable y separada del
  arranque concurrente de instancias; un fallo debe bloquear la promoción sin dejar el
  esquema presentado como listo.
- **FR-019**: Las versiones anterior y nueva deben mantener compatibilidad suficiente
  durante despliegue y rollback, o la entrega debe demostrar una estrategia de
  recuperación equivalente antes de promover.
- **FR-020**: El sistema debe volver a una versión saludable mediante el flujo
  declarativo sin repetir manualmente el despliegue.
- **FR-021**: La ausencia de acceso al cluster no debe impedir generar una especificación
  completa, renderizable y estáticamente validable.
- **FR-022**: Toda decisión inferida debe registrar evidencia, default conservador y
  carácter ajustable; todo dato descubierto debe registrar fuente no sensible.
- **FR-023**: Solo una restricción externa, no descubrible y material puede originar un
  marcador único de entrada de plataforma; el resto del trabajo debe continuar.
- **FR-024**: La documentación de entrega debe actualizarse con el mismo cambio y
  separar explícitamente recursos deseados, confirmados y pendientes.
- **FR-025**: La inspección del ambiente debe comenzar en modo de solo lectura, limitarse
  al alcance autorizado y excluir cualquier lectura de secretos.

### Deployment-Relevant Application Signals *(mandatory)*

| Component / Process | Trigger or Protocol | Stateful Behavior | External Exposure | Dependency / Schedule |
|---------------------|---------------------|-------------------|-------------------|-----------------------|
| Experiencia web | Interacción de analista o auditor | Sin estado durable local | Único punto de entrada de usuario | Orquestación e identidad disponibles según el flujo |
| Orquestación de solicitudes | Solicitudes síncronas de la experiencia web | Lee y modifica registros durables | Solo a través del punto de entrada de usuario | Registro durable, scoring e identidad |
| Cálculo de scoring | Petición síncrona interna | Criterios versionados; sin sesión del usuario | Interna | Configuración de criterios y autenticación entre capacidades |
| Registro durable | Lectura y escritura transaccional | Conserva solicitudes, evaluaciones y auditoría | Interna | Almacenamiento recuperable |
| Evolución de esquema | Primera instalación o cambio compatible | Cambia estructura durable y registra avance | Sin acceso de usuario | Registro durable; antes de consumidores incompatibles |
| Retención y disposición | Ejecución programada | Elimina o anonimiza datos vencidos | Interna | Registro durable; no debe solaparse de forma insegura |
| Recuperación de evaluaciones | Ejecución programada | Reconcilia intentos incompletos | Interna | Registro durable; recupera trabajo interrumpido |
| Identidad corporativa | Inicio de sesión y validación de identidad | Estado administrado externamente | Integración externa obligatoria | Servicio corporativo autorizado |

### External Platform Constraints *(mandatory)*

- **Authorized destination**: No fue proporcionado y no bloquea esta especificación;
  debe descubrirse con acceso autorizado o registrarse antes de la primera promoción.
- **Corporate constraints**: No se han confirmado productos obligatorios de registro,
  GitOps, secretos, identidad operativa, observabilidad ni dominios. El plan debe
  tratarlos como capacidades configurables hasta descubrirlos.
- **Required approvals**: Desarrollo usa promoción automática después de controles.
  Staging o producción requieren promoción controlada; cualquier aprobación humana
  obligatoria debe provenir de política organizacional explícita.
- **Sensitive input channel**: Cuando se necesite acceso posterior, solo se documentará
  el tipo de identidad y la referencia al canal seguro aprobado; nunca sus valores.

### Business Rules *(mandatory)*

- **BR-001**: La evidencia del proyecto prevalece sobre defaults; los defaults
  conservadores prevalecen sobre preguntas; el descubrimiento autorizado confirma o
  sustituye el default sin copiar datos sensibles.
- **BR-002**: La exposición externa se concede únicamente a un punto de entrada exigido
  por un flujo; toda ambigüedad se resuelve a favor de comunicación interna.
- **BR-003**: La persistencia se exige únicamente para datos cuya pérdida contradiga
  durabilidad, auditoría, recuperación o retención; los datos temporales no deben
  promover almacenamiento durable sin evidencia.
- **BR-004**: Un estado generado declarativamente se clasifica como deseado. Solo una
  observación autorizada con fuente puede clasificarlo como confirmado.
- **BR-005**: Una restricción externa bloquea únicamente la actividad que requiere su
  valor; no bloquea inventario, requisitos, renderizado ni validación estática.
- **BR-006**: Esta feature no modifica reglas de scoring, bandas, factores,
  autorizaciones ni retención del MVP; cualquier diferencia conserva como fuente la
  especificación funcional vigente.

### Validation Matrix *(mandatory)*

| ID | Flow / Field / State | Input or Condition | Rule and Boundary | Failure Behavior | Error / Message |
|----|----------------------|--------------------|-------------------|------------------|-----------------|
| VAL-001 | Inventario lógico | Especificación, contratos, datos y código disponibles | Toda capacidad ejecutable o externa aparece una vez con evidencia | Bloquea aprobación del plan, no solicita nombres técnicos al cliente | "Falta una capacidad lógica o su evidencia" |
| VAL-002 | Exposición | Capacidad sin consumidor externo demostrado | Debe permanecer interna | Bloquea exposición | "La exposición externa no está justificada por un flujo" |
| VAL-003 | Versión | Cambio aceptado | Una identidad inmutable enlaza commit, configuración y ambiente | Detiene publicación o promoción | "La versión no es trazable o es mutable" |
| VAL-004 | Control de promoción | Falla build, análisis, política, migración, rollout o smoke | Ninguna falla obligatoria puede promoverse | Conserva o recupera última versión saludable | "Promoción detenida en el control indicado" |
| VAL-005 | Dato durable | Recreación de procesos | El dato confirmado sigue disponible e íntegro | Declara recuperación fallida y detiene aceptación | "No se demostró durabilidad" |
| VAL-006 | Backup y restauración | Conjunto durable | Existe evidencia de copia y restauración utilizable | Bloquea aceptación productiva del dato | "Restauración no verificada" |
| VAL-007 | Salud | Dependencia indispensable caída | La capacidad afectada no puede declararse lista | Marca degradado/no disponible con causa segura | "La capacidad no está lista" |
| VAL-008 | Documentación | Recurso solo renderizado | Debe figurar como deseado, no confirmado | Falla validación documental | "Estado documentado sin fuente de confirmación" |
| VAL-009 | Inspección | Acceso de solo lectura autorizado | No consulta secretos ni excede alcance | Cancela inspección y registra incumplimiento sin valores | "Inspección fuera del alcance seguro" |
| VAL-010 | Entrada externa | Falta destino, dominio o política obligatoria | Agrupa solo campos materiales y continúa trabajo independiente | Bloquea únicamente promoción afectada | "Se requiere entrada externa por canal seguro" |

### Error Scenarios *(mandatory)*

| ID | Trigger | Expected State | User/API Response | Logging & Recovery |
|----|---------|----------------|-------------------|--------------------|
| ERR-001 | Build o análisis fallido | Cambio no publicado | Control fallido con acción correctiva | Evidencia vinculada al commit, sin secretos; corregir y repetir |
| ERR-002 | Política de seguridad fallida | Promoción detenida | Regla incumplida y recurso lógico afectado | Registrar regla, no contenido sensible; corregir estado deseado |
| ERR-003 | Migración fallida | Esquema no listo y workloads dependientes sin promover | Fase y diagnóstico seguros | Reintento idempotente o recuperación documentada |
| ERR-004 | Despliegue parcial | Ambiente degradado, no aceptado | Capacidades listas y no listas claramente diferenciadas | Reconciliar o volver a última versión saludable |
| ERR-005 | Smoke test fallido | Promoción detenida | Paso funcional y resultado esperado | Correlación segura; rollback cuando el ambiente cambió |
| ERR-006 | Motor de scoring no disponible | Evaluaciones nuevas recuperables; histórico no se declara caído si sigue funcional | Error accionable sin resultado parcial | Métrica y alerta; reintento o reconciliación de intentos |
| ERR-007 | Registro durable no disponible | Escrituras bloqueadas; ninguna confirmación falsa | Operación no confirmada y reintentable | Alerta crítica; recuperación del servicio o restauración |
| ERR-008 | Identidad externa no disponible | Nuevas sesiones bloqueadas; sesiones se comportan según política vigente | Mensaje seguro sin detalle del proveedor | Métrica de dependencia; reintento después de recuperación |
| ERR-009 | Cluster inaccesible | Estado observado pendiente | La especificación y validación estática continúan | Registrar ausencia de fuente, no inventar estado |
| ERR-010 | Restauración inválida | Ambiente de recuperación no aceptado | Verificación de integridad fallida | Conservar evidencia, corregir backup/proceso y repetir |

### UI/UX Requirements *(mandatory)*

Esta feature no agrega ni modifica pantallas del producto. La experiencia web existente
de registro, resultado, histórico y auditoría debe conservar sus estados, accesibilidad
y comportamiento responsivo. El smoke test debe usar un flujo seguro ya definido y no
puede introducir controles de administración de plataforma en la interfaz de negocio.
Los diagnósticos operativos pertenecen a los canales autorizados del equipo operador y
no deben exponer nombres internos, PII ni secretos a analistas o auditores.

### Key Entities *(mandatory)*

- **Capacidad lógica**: Unidad funcional con consumidor, exposición, estado, ciclo de
  vida, dependencias y condición de salud; no equivale todavía a un recurso OpenShift.
- **Conjunto de datos**: Información temporal o durable con propietario, sensibilidad,
  retención, recuperación y compatibilidad de versión.
- **Versión de aplicación**: Resultado inmutable de un cambio aceptado, trazable a
  commit, configuración y ambientes promovidos.
- **Ambiente**: Destino lógico con criticidad, configuración variable, controles de
  promoción y estado deseado, confirmado o pendiente.
- **Evidencia operativa**: Resultado no sensible de build, validación, reconciliación,
  smoke, backup, restauración o rollback.
- **Restricción externa**: Dato o aprobación controlado por la organización y no
  deducible desde el proyecto; incluye motivo, alcance bloqueado y canal seguro.

## Requisitos operativos en OpenShift

### Perfil de ejecución

La aplicación ofrece una experiencia web a analistas y auditores, orquesta solicitudes
y evaluaciones de forma síncrona, delega el cálculo a una capacidad interna sin PII y
conserva solicitudes, consentimientos, instantáneas, resultados y auditoría. Su ciclo de
vida incluye evolución de esquema antes de versiones incompatibles, disposición
programada de datos vencidos y recuperación programada de evaluaciones interrumpidas.
La identidad es una dependencia corporativa externa. Solo la experiencia web requiere
entrada externa; las demás comunicaciones son internas.

### Matriz de componentes lógicos

| Capacidad | Tipo de trabajo | Dependencias | Persistencia | Acceso | Condición de salud observable |
|-----------|-----------------|--------------|--------------|--------|-------------------------------|
| Experiencia web | Interactivo, larga duración | Orquestación e identidad | Ninguna local | Externo para usuarios autorizados | Sirve aplicación y configuración válida; el flujo principal alcanza la orquestación |
| Orquestación de solicitudes | Síncrono, larga duración | Registro durable, scoring e identidad | Solicitudes y evaluaciones mediante el registro durable | Interno desde experiencia web | Puede validar identidad, leer/escribir el registro y atender rutas no dependientes de scoring |
| Cálculo de scoring | Síncrono, larga duración | Criterios versionados y autenticación interna | Configuración versionada, sin sesión ni PII | Interno desde orquestación | Acepta una evaluación sintética permitida y devuelve resultado coherente con la versión |
| Registro durable | Servicio de datos | Almacenamiento recuperable | Todos los datos transaccionales durables | Interno | Acepta lectura/escritura autorizada y conserva integridad |
| Evolución de esquema | Inicialización/cambio finito | Registro durable y migraciones versionadas | Historial de migración | Interno, sin usuario | Completa una vez, registra versión y no deja cambios parciales presentados como listos |
| Retención y disposición | Programado, finito | Registro durable y reglas de retención | Registro de ejecución y auditoría segura | Interno | Procesa un lote elegible, evita solapamiento inseguro y registra resultado |
| Recuperación de evaluaciones | Programado, finito | Registro durable | Actualiza intentos incompletos de forma controlada | Interno | Detecta un intento vencido, lo recupera una vez y registra transición |
| Identidad corporativa | Integración externa | Servicio organizacional | Administrada fuera de la aplicación | Externo controlado | La aplicación puede validar una identidad autorizada sin almacenar credenciales del proveedor |

### Matriz de datos

| Dato | Propietario | Durabilidad | Sensibilidad | Retención | Recuperación | Migración requerida |
|------|-------------|-------------|--------------|-----------|--------------|---------------------|
| Borradores de solicitud | Orquestación | Durable hasta disposición | PII y financiera restringida | 90 días desde última modificación si no existe evaluación | Backup y restauración hasta vencimiento | Sí, compatible con borradores vigentes |
| Consentimiento | Orquestación | Durable e inmutable por versión | PII/restringida | Vinculado a evaluación durante 5 años | Backup y restauración con vínculo íntegro | Sí, preservando evidencia y versión |
| Datos alternativos e instantánea | Orquestación | Durable | Financiera restringida; snapshot de scoring sin PII | Según borrador o evaluación asociada | Backup y restauración transaccional | Sí, preservando interpretación de versiones |
| Evaluaciones, factores y criterios | Orquestación y scoring | Durable e inmutable al finalizar | Resultado de decisión | 5 años identificable; luego anonimización irreversible según spec vigente | Backup, restauración y verificación de consistencia | Sí, con compatibilidad de lectura y rollback |
| Eventos de auditoría | Orquestación | Durable y append-only salvo anonimización | Operativa confidencial | Alineada con la evaluación asociada | Backup y restauración conservando orden e integridad | Sí, sin perder trazabilidad |
| Estado de migraciones | Evolución de esquema | Durable | Operativa interna | Mientras exista el esquema | Incluido en recuperación del registro | Es el control de migración |
| Configuración no sensible | Cada capacidad | Reproducible por ambiente | Interna, no secreta | Historial de versiones | Restaurada desde estado deseado | Compatible entre versión anterior y nueva |
| Credenciales y llaves | Plataforma autorizada | Disponible en runtime, fuera de Git | Secreto | Según política corporativa | Rotación y recuperación por mecanismo aprobado | Referencias compatibles; valores nunca migran en artefactos SDD |
| Logs, métricas y evidencia | Operación | Según necesidad de diagnóstico/auditoría | Sin PII ni secretos | Política operativa por confirmar | No sustituye backup de datos de negocio | Esquema de señales compatible o versionado |

### Escenarios operativos

1. **Primera instalación**: validar prerrequisitos no sensibles, preparar datos
   durables, ejecutar evolución inicial, publicar capacidades internas y habilitar el
   punto de entrada solo cuando el smoke test sea satisfactorio.
2. **Despliegue ordinario**: validar, construir una vez, identificar inmutablemente,
   actualizar estado deseado, reconciliar, comprobar rollout y ejecutar smoke test.
3. **Escalado**: aumentar capacidades stateless de forma independiente cuando su carga
   lo justifique, sin duplicar jobs ni violar consistencia del registro durable.
4. **Reinicio**: recrear procesos sin perder datos confirmados; una evaluación
   interrumpida queda recuperable y no genera dos resultados terminales.
5. **Fallo de dependencia**: declarar degradado solo el flujo afectado, conservar
   diagnósticos seguros y recuperar automáticamente cuando sea posible.
6. **Migración**: ejecutar antes de consumidores incompatibles, registrar avance,
   detener promoción al fallar y demostrar compatibilidad o recuperación.
7. **Rollback**: seleccionar una versión saludable ya publicada, reconciliarla y
   verificar el flujo principal sin reconstruir ni repetir pasos manuales.
8. **Restauración**: recuperar datos durables en un entorno controlado, verificar
   integridad, retención, autorización y flujo principal antes de aceptar el resultado.

### Requisitos testables

- **OR-001 Build**: un commit aceptado produce exactamente una identidad inmutable de
  versión y evidencia de análisis sin secretos.
- **OR-002 Despliegue**: la actualización declarativa converge o termina con causa
  explícita; ningún paso manual ordinario es necesario.
- **OR-003 Disponibilidad**: cada capacidad de larga duración demuestra su señal de
  vida y su condición funcional de lista.
- **OR-004 Conectividad**: el único acceso externo corresponde a la experiencia web y
  cada comunicación interna coincide con una dependencia de la matriz.
- **OR-005 Persistencia**: solicitudes y evaluaciones confirmadas sobreviven recreación;
  backup y restauración reproducen una muestra íntegra autorizada.
- **OR-006 Seguridad**: ninguna evidencia contiene secretos o PII; las identidades y
  accesos respetan mínimo privilegio y aislamiento funcional.
- **OR-007 Migración**: una instalación vacía y una actualización desde la versión
  anterior completan de forma observable; un fallo detiene promoción.
- **OR-008 Recuperación**: una versión defectuosa vuelve a la última saludable y supera
  el mismo smoke test sin reconstrucción.
- **OR-009 Operabilidad**: logs, métricas y alertas identifican fallos simulados de los
  flujos críticos con correlación y acción recomendada.
- **OR-010 Documentación**: todos los recursos y valores aparecen clasificados como
  deseados, confirmados o pendientes y cada confirmación incluye fuente no sensible.

### Documentación de entrega

La entrega debe incluir arquitectura lógica y desplegada; cluster o contexto utilizado;
ambientes y namespaces; capacidades, workloads y pods esperados; puntos de entrada,
Services, Routes y URLs; recursos de datos y almacenamiento; Jobs y tareas programadas;
identidades y permisos; configuración y referencias de secretos; dependencias externas;
flujo declarativo de build, promoción, reconciliación y rollback; señales de salud;
alertas; backup, restauración y migraciones; smoke tests y estado actual del despliegue.
Debe separar estado deseado, confirmado y pendiente, registrar fuentes no sensibles y
no incluir tokens, contraseñas, kubeconfigs, llaves, contenido de secretos ni URLs con
credenciales.

### Supuestos y restricciones externas

- OpenShift es el destino operativo; su versión y capacidades instaladas se descubrirán
  en `plan` mediante acceso autorizado de solo lectura o se tratarán como configurables.
- Desarrollo se actualiza automáticamente después de controles; ambientes más críticos
  usan promoción controlada.
- Se adopta disponibilidad y escalado modestos y ajustables hasta disponer de objetivos
  cuantificados.
- Los datos durables requieren backup y restauración; `plan` seleccionará una capacidad
  soportada sin presumir operador, almacenamiento o servicio administrado.
- No existe obligación adicional confirmada de residencia, aislamiento o cifrado más
  allá de la especificación vigente; una política organizacional posterior bloqueará
  solo la promoción afectada.
- Destino, dominios, servicios corporativos obligatorios y aprobaciones regulatorias no
  proporcionados permanecen pendientes de validación y no impiden esta especificación.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las capacidades ejecutables, procesos programados, migraciones,
  datos durables e integraciones evidenciadas aparece en el inventario lógico con
  consumidor, dependencia, acceso y condición de salud.
- **SC-002**: El 100% de los cambios aceptados conserva una relación verificable entre
  commit, versión inmutable, configuración y ambiente.
- **SC-003**: El 100% de los fallos simulados de build, política, migración, rollout y
  smoke detiene la promoción y genera un diagnóstico accionable sin secretos.
- **SC-004**: En una recreación controlada, el 100% de la muestra durable confirmada
  permanece accesible e íntegra para sus actores autorizados.
- **SC-005**: Una restauración de prueba recupera el 100% de la muestra seleccionada y
  supera verificaciones de integridad, autorización y flujo principal.
- **SC-006**: Un rollback controlado vuelve a una versión saludable y supera el smoke
  test sin reconstruir artefactos ni ejecutar manualmente el despliegue.
- **SC-007**: El 100% de los puntos de entrada externos corresponde a flujos
  documentados; ninguna capacidad interna es accesible externamente.
- **SC-008**: Una persona operadora ajena a la implementación identifica en menos de 15
  minutos el estado de cada capacidad, versión, dependencia y procedimiento de
  recuperación usando solo la documentación entregada.
- **SC-009**: La especificación permanece completa y lista para planificación aunque no
  exista acceso temporal al cluster; solo las confirmaciones de estado real quedan
  pendientes.
- **SC-010**: Ningún artefacto de especificación, evidencia o documentación contiene
  credenciales, contenido de secretos o PII no necesaria.

## Assumptions *(mandatory)*

- El repositorio actual es evidencia suficiente para identificar experiencia web,
  orquestación, scoring, persistencia, migraciones, retención, reconciliación e
  identidad externa.
- La experiencia web es el único punto de entrada requerido; las demás capacidades son
  internas según contratos y flujos vigentes.
- La carga inicial es modesta y admite valores conservadores ajustables en `plan`; no
  existe un SLO contractual adicional conocido.
- La retención funcional vigente es 90 días para borradores sin evaluación y 5 años
  para evaluaciones identificables antes de anonimización irreversible.
- La identidad y los roles son provistos por el entorno; su aprovisionamiento no forma
  parte de esta feature.
- Las reglas funcionales, de privacidad, autorización y UX del MVP existente permanecen
  sin cambios.
- Cualquier capacidad opcional del cluster debe confirmarse antes de usarla; la falta de
  confirmación conduce a una alternativa soportada o a un prerrequisito explícito, no a
  una afirmación inventada.
