# Feature Specification: Aceptación obligatoria de términos y condiciones

**Feature Branch**: `main`

**Created**: 2026-08-12

**Status**: Draft

**Input**: Agregar un nuevo microservicio de términos y condiciones al inicio de la
aplicación, cuya versión vigente debe ser aceptada obligatoriamente antes de usarla.

## Scope *(mandatory)*

### In Scope

- Presentar a toda persona autenticada la versión vigente y publicada de los términos
  y condiciones antes de permitirle acceder a cualquier función de negocio.
- Permitir leer el documento completo, aceptar explícitamente o salir de la aplicación.
- Registrar una evidencia auditable de la aceptación vinculada con la persona, su
  ámbito organizacional y la versión exacta aceptada.
- Volver a solicitar aceptación cuando se publique una nueva versión obligatoria.
- Incorporar un servicio lógico independiente que publique la versión vigente,
  determine si una identidad ya la aceptó y registre la aceptación.
- Proveer una interfaz gráfica propia del servicio, construida y desplegada de forma
  independiente del frontend principal, pero visualmente consistente con la aplicación.
- Permitir que personal autorizado publique, consulte y retire versiones futuras sin
  alterar versiones ya aceptadas ni su evidencia histórica.
- Bloquear de forma segura el uso de la aplicación cuando el estado de aceptación no
  pueda verificarse, mostrando una recuperación accionable.
- Exponer estado operativo, auditoría no sensible y evidencia de recuperación del nuevo
  flujo sin revelar el contenido de credenciales ni tokens.

### Out of Scope

- Redactar o aprobar jurídicamente el contenido de los términos y condiciones.
- Gestionar identidades, roles empresariales o el ciclo de vida del proveedor de
  autenticación.
- Recabar firmas electrónicas avanzadas, biometría o consentimiento de terceros.
- Permitir aceptación parcial, condicional o delegada.
- Cambiar las reglas, bandas, factores o recomendaciones del scoring crediticio.
- Solicitar una aceptación separada para cada pantalla o cada operación una vez que la
  versión vigente ya fue aceptada.
- Definir recursos concretos de despliegue o productos de plataforma; esas decisiones
  corresponden a la planificación derivada de las señales de la aplicación.

## Observable Operational Outcomes *(mandatory)*

- **OO-001**: Una persona autenticada sin aceptación vigente ve los términos como
  primera experiencia y no puede acceder a datos ni acciones de negocio hasta aceptar.
- **OO-002**: Una persona que ya aceptó la versión vigente entra a la aplicación sin
  repetir el paso, y una nueva versión obligatoria vuelve a bloquear el acceso.
- **OO-003**: Si el estado o el contenido vigente no pueden verificarse, la aplicación
  permanece bloqueada, conserva aceptaciones confirmadas y ofrece reintento o salida.
- **OO-004**: Cada aceptación y publicación queda vinculada con identidad, versión,
  fecha, ámbito y resultado, y puede auditarse sin almacenar tokens ni contenido
  sensible en logs.
- **OO-005**: Una liberación fallida del servicio puede revertirse a la última versión
  saludable sin perder documentos publicados ni evidencias de aceptación.

## Actors & Authorization *(mandatory)*

| Actor / System | Goal | Permitted Actions and Data | Restrictions |
|----------------|------|----------------------------|--------------|
| Persona usuaria autenticada | Leer y aceptar los términos para usar la aplicación | Leer la versión vigente; consultar si su propia aceptación está vigente; aceptar una vez por versión; salir | No puede omitir el bloqueo, aceptar por otra identidad, modificar el documento ni borrar evidencia |
| Administrador de términos | Mantener versiones jurídicamente aprobadas | Crear borradores, consultar versiones, publicar una versión futura y retirar borradores o versiones futuras aún no vigentes | No puede modificar contenido o identificador de una versión publicada ni alterar aceptaciones históricas |
| Supervisor o auditor | Verificar cumplimiento | Consultar versiones publicadas y evidencias de su ámbito en modo lectura | No puede publicar, retirar, aceptar por otra persona ni acceder fuera de su ámbito |
| Aplicación consumidora | Impedir operaciones sin aceptación vigente | Consultar versión y estado de aceptación para la identidad autenticada | No puede declarar aceptación ni sustituir la identidad de la sesión |
| Operador de aplicación | Diagnosticar disponibilidad y recuperar el flujo | Consultar salud, métricas, eventos técnicos no sensibles y procedimientos autorizados | No puede leer tokens, secretos ni modificar evidencia de negocio directamente |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Aceptar antes de ingresar (Priority: P1)

Como persona usuaria autenticada, quiero leer y aceptar los términos vigentes al inicio
para poder usar la aplicación con conocimiento de las condiciones aplicables.

**Primary Actor**: Persona usuaria autenticada.

**Entry Conditions**: La identidad y su ámbito ya fueron autenticados; existe una única
versión vigente publicada; no existe una aceptación válida de esa identidad para esa
versión; el documento y el servicio están disponibles.

**Inputs & Validation**: Acción explícita de aceptación y la versión mostrada. La
acción solo es válida si se mostró el contenido completo de la misma versión vigente,
la identidad procede de la sesión autenticada y la versión no cambió durante el flujo.

**State Transitions**: aceptación pendiente → documento mostrado → aceptación en
proceso → aceptación confirmada → acceso habilitado. Si la persona sale, el estado
permanece pendiente y la sesión finaliza.

**Outputs**: Confirmación visible, evidencia durable con identidad, ámbito, versión y
fecha, evento auditable seguro y navegación a la pantalla inicial autorizada.

**Authorization**: Toda identidad autenticada puede aceptar únicamente por sí misma.
Una identidad no autenticada o fuera de ámbito recibe denegación sin crear evidencia.

**Errors & Edge Conditions**: Doble clic o reintento no duplica evidencia; cambio de
versión durante la lectura obliga a mostrar la nueva; un fallo antes de la confirmación
mantiene el bloqueo y permite reintentar sin afirmar aceptación.

**Why this priority**: Es la barrera obligatoria que habilita de forma válida cualquier
otro uso de la aplicación.

**Independent Test**: Se autentica una identidad sin aceptación, se verifica que las
funciones de negocio están bloqueadas, se acepta el documento y se comprueba acceso y
una sola evidencia durable.

**Acceptance Scenarios**:

1. **Given** una identidad autenticada sin aceptación vigente, **When** inicia la
   aplicación, **Then** ve los términos y ninguna función de negocio es accesible.
2. **Given** que la misma versión completa está visible, **When** la persona selecciona
   aceptar, **Then** se registra una única evidencia y se habilita la aplicación.
3. **Given** una identidad con aceptación vigente, **When** inicia una sesión posterior,
   **Then** entra directamente a la pantalla inicial autorizada.
4. **Given** una persona que no desea aceptar, **When** selecciona salir, **Then** no se
   registra aceptación y la sesión termina sin acceso a la aplicación.

---

### User Story 2 - Exigir una nueva versión (Priority: P2)

Como administrador de términos, quiero publicar una nueva versión con vigencia
controlada para que todas las personas acepten exactamente el texto aprobado desde su
fecha efectiva.

**Primary Actor**: Administrador de términos.

**Entry Conditions**: El actor está autenticado y autorizado; existe un documento
jurídicamente aprobado con identificador único, título, contenido, fecha de publicación
y fecha de vigencia; no hay otra versión con vigencia solapada.

**Inputs & Validation**: Identificador inmutable y único, título de 1 a 200 caracteres,
contenido no vacío, fecha de vigencia igual o posterior al momento de publicación y
confirmación explícita. Se rechazan campos faltantes, contenido idéntico con versión
distinta, fechas inválidas y solapamientos.

**State Transitions**: borrador → programada → vigente → reemplazada. Un borrador o una
programada aún no vigente puede retirarse; una versión publicada no puede editarse.

**Outputs**: Versión programada o vigente, historial inmutable, evento auditable y, al
iniciar su vigencia, estado pendiente para quienes solo aceptaron versiones anteriores.

**Authorization**: Solo el administrador de términos puede publicar o retirar. Lectura
administrativa fuera del ámbito o cambios por otros roles son denegados y auditados.

**Errors & Edge Conditions**: Publicaciones concurrentes conservan una única versión
vigente; una solicitud repetida con los mismos datos devuelve el mismo resultado; un
fallo no deja una versión parcialmente publicada.

**Why this priority**: Permite actualizar las condiciones sin perder trazabilidad ni
aceptar de forma implícita una versión nueva.

**Independent Test**: Se programa una nueva versión, se alcanza su vigencia y se
comprueba que una identidad que aceptó la anterior queda bloqueada hasta aceptar la
nueva, mientras la evidencia anterior permanece intacta.

**Acceptance Scenarios**:

1. **Given** un documento aprobado y un administrador autorizado, **When** publica una
   versión futura válida, **Then** queda programada e inmutable sin afectar aún el acceso.
2. **Given** que llega la fecha efectiva, **When** una identidad con aceptación anterior
   inicia o reanuda la aplicación, **Then** debe aceptar la nueva versión antes de continuar.
3. **Given** una versión ya publicada, **When** se intenta editar su contenido, **Then**
   el cambio se rechaza y la versión original permanece intacta.

---

### User Story 3 - Auditar aceptación y recuperarse de fallos (Priority: P3)

Como supervisor, auditor u operador autorizado, quiero comprobar qué versión aplica y
si una aceptación quedó confirmada, y distinguir un fallo técnico de un rechazo, para
resolver incidentes sin alterar evidencia.

**Primary Actor**: Supervisor o auditor; operador de aplicación para señales técnicas.

**Entry Conditions**: El actor está autenticado y autorizado para el ámbito solicitado;
existen versiones o evidencias, o el servicio presenta una condición degradada.

**Inputs & Validation**: Filtros opcionales de identidad pública autorizada, versión y
rango de fechas válido; no se admiten búsquedas fuera del ámbito ni rangos invertidos.

**State Transitions**: consulta solicitada → autorizada y validada → resultados o vacío;
para incidentes, saludable → degradado/no disponible → recuperación → saludable.

**Outputs**: Versión, estado, fecha, identidad pseudonimizada cuando corresponda y
resultado de aceptación; para operación, diagnóstico y evidencia de recuperación sin
contenido sensible.

**Authorization**: Auditoría es lectura acotada por ámbito. El operador ve señales
técnicas, no el documento de identidad ni tokens. Toda denegación conserva el estado.

**Errors & Edge Conditions**: Una consulta sin coincidencias devuelve estado vacío; una
dependencia caída devuelve error seguro y reintentable; resultados parciales nunca se
presentan como evidencia completa.

**Why this priority**: Aporta cumplimiento y soporte, pero depende del flujo primario de
publicación y aceptación.

**Independent Test**: Se consulta una aceptación conocida con rol y ámbito correctos,
se deniega la misma consulta fuera de ámbito y se simula indisponibilidad verificando
que el acceso de negocio continúa bloqueado hasta la recuperación.

**Acceptance Scenarios**:

1. **Given** una aceptación confirmada y un auditor del mismo ámbito, **When** consulta
   por versión e identidad autorizada, **Then** obtiene la evidencia exacta en modo lectura.
2. **Given** un auditor de otro ámbito, **When** intenta la misma consulta, **Then** no
   recibe datos y la denegación queda registrada de forma segura.
3. **Given** que el servicio no puede verificar aceptación, **When** una persona intenta
   entrar, **Then** permanece bloqueada con mensaje reintentable y no pierde evidencia previa.

### Cross-Flow Edge Cases

- Si no existe versión vigente publicada, ninguna función de negocio se habilita; se
  muestra una indisponibilidad administrada y se alerta al responsable operativo.
- Si dos aceptaciones idénticas llegan simultáneamente, se confirma una sola evidencia
  lógica y ambas respuestas reflejan el mismo estado aceptado.
- Si cambia la versión entre la carga del documento y la acción de aceptar, se rechaza
  la versión obsoleta y se presenta completa la nueva versión vigente.
- Si una pestaña conserva una sesión antigua después de entrar en vigor una versión
  nueva, la siguiente navegación o acción protegida vuelve al bloqueo de términos.
- Si la evidencia existe pero no puede leerse temporalmente, no se presume aceptación;
  se bloquea y se permite reintentar sin crear evidencia nueva.
- Si el contenido supera el espacio visible, debe poder recorrerse completo sin que el
  botón de aceptación quede oculto o inaccesible por teclado.
- Si la sesión expira durante la lectura, se solicita autenticación nuevamente y no se
  registra una aceptación con identidad incierta.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE identificar exactamente una versión vigente publicada en
  cada instante; ninguna o más de una se considera un estado operativo inválido.
- **FR-002**: La aplicación DEBE verificar, después de autenticar y antes de cargar
  cualquier dato o función de negocio, que la identidad aceptó la versión vigente.
- **FR-003**: La aplicación DEBE impedir también las acciones protegidas cuando la
  aceptación falte, sea obsoleta o no pueda verificarse, incluso si se intenta omitir
  la pantalla inicial o usar una sesión ya abierta.
- **FR-004**: La persona DEBE poder leer el título, identificador, fecha efectiva y
  contenido completo de la versión que se le solicita aceptar.
- **FR-005**: La aceptación DEBE requerir una acción afirmativa explícita; silencio,
  navegación, desplazamiento, sesión previa o uso de una versión anterior no cuentan.
- **FR-006**: El sistema DEBE derivar la identidad y el ámbito de la sesión autenticada
  y DEBE rechazar identificadores de identidad proporcionados por el cliente.
- **FR-007**: Una aceptación confirmada DEBE registrar identidad, ámbito, versión
  inmutable, instante y correlación auditable, sin copiar tokens ni secretos.
- **FR-008**: Reintentos o solicitudes concurrentes de la misma identidad y versión
  DEBEN producir una única aceptación lógica y una respuesta consistente.
- **FR-009**: La persona DEBE poder rechazar de hecho los términos saliendo; el sistema
  no registra aceptación y no habilita la aplicación.
- **FR-010**: Una nueva versión DEBE requerir nueva aceptación desde su fecha efectiva,
  conservando sin modificación la evidencia de versiones anteriores.
- **FR-011**: Solo un administrador autorizado DEBE poder crear, programar, publicar o
  retirar versiones no vigentes; una versión publicada no puede modificarse ni borrarse.
- **FR-012**: El sistema DEBE evitar vigencias solapadas y publicación parcial, y debe
  conservar la última versión válida ante un intento fallido.
- **FR-013**: Supervisores y auditores DEBEN poder consultar versiones y aceptaciones de
  su ámbito sin capacidad de modificación.
- **FR-014**: Si el documento o el estado no están disponibles, el sistema DEBE bloquear
  el acceso, presentar un mensaje seguro y permitir reintento o salida.
- **FR-015**: El sistema DEBE producir eventos auditables para publicación, retiro,
  aceptación, denegación autorizativa y fallos relevantes, excluyendo contenido del
  documento, tokens, secretos y datos personales innecesarios de los logs.
- **FR-016**: Documentos y aceptaciones DEBEN sobrevivir reinicios, recreación de
  procesos, actualizaciones y rollback de la aplicación.
- **FR-017**: La evidencia de aceptación DEBE conservarse cinco años y después debe
  eliminar o anonimizar identificadores personales conforme a la política existente.
- **FR-018**: El servicio DEBE distinguir disponibilidad para ejecutar el proceso de
  capacidad básica de estar listo para leer la versión y confirmar aceptaciones.
- **FR-019**: La documentación operativa DEBE identificar el servicio, dependencias,
  datos durables, estados saludables/degradados, recuperación y evidencia de rollback,
  diferenciando estado deseado de estado confirmado.
- **FR-020**: El servicio de términos DEBE ofrecer su propia interfaz gráfica y ciclo de
  liberación, sin incrustarse en el código ni en el proceso del frontend principal.
- **FR-021**: La interfaz propia DEBE consumir el mismo contrato visual versionado de la
  aplicación y demostrar paridad de tokens, tipografía, geometría, estados y accesibilidad.

### Deployment-Relevant Application Signals *(mandatory)*

| Component / Process | Trigger or Protocol | Stateful Behavior | External Exposure | Dependency / Schedule |
|---------------------|---------------------|-------------------|-------------------|-----------------------|
| Interfaz web propia de términos | Inicio o reanudación de sesión, administración y auditoría | Sin estado durable; configuración de runtime | Se publica bajo el mismo host y un prefijo exclusivo | Proveedor de identidad y API de términos |
| Servicio de términos y condiciones | Solicitudes síncronas de versión, estado, aceptación y administración | Documentos versionados y aceptaciones durables | Solo a través de la entrada existente de la aplicación; no requiere entrada pública independiente | Proveedor de identidad y almacén durable |
| Verificación de acceso de negocio | Cada operación protegida | Lee estado vigente; no crea aceptación | No añade exposición | Servicio de términos; falla de forma cerrada |
| Migración de datos | Liberación que cambia el modelo | Esquema versionado, compatible y recuperable | Ninguna | Se ejecuta antes de habilitar la versión dependiente |
| Retención de aceptaciones | Ejecución programada | Anonimiza o elimina evidencia vencida de forma auditable | Ninguna | Política de cinco años; reintentos idempotentes |

### External Platform Constraints *(mandatory)*

- **Authorized destination**: Se reutilizan los ambientes y ámbitos autorizados de la
  aplicación; la especificación no afirma un destino adicional.
- **Corporate constraints**: Aplican GitOps, imágenes inmutables, mínimos privilegios,
  separación de secretos y las políticas de OpenShift definidas por la constitución.
- **Required approvals**: El contenido jurídico y la fecha efectiva requieren aprobación
  organizacional antes de su publicación; no se conoce otra aprobación adicional.
- **Sensitive input channel**: Las credenciales y referencias sensibles se suministran
  únicamente por el canal seguro aprobado existente; nunca se incluyen en este artefacto.

### Business Rules *(mandatory)*

- **BR-001**: La versión aplicable es la versión publicada con la fecha efectiva más
  reciente que no sea posterior al instante de evaluación. Si no hay exactamente una
  versión aplicable por reglas de vigencia, prevalece el bloqueo seguro.
- **BR-002**: Una identidad tiene acceso solo cuando existe evidencia confirmada para
  su mismo ámbito y para el identificador exacto de la versión vigente. Aceptaciones
  faltantes, duplicadas, inconsistentes, de otro ámbito o de versión anterior no habilitan acceso.
- **BR-003**: La publicación de una nueva versión no invalida ni modifica evidencia
  histórica; solo cambia cuál aceptación se exige desde la fecha efectiva.
- **BR-004**: Las operaciones administrativas prevalecen solo sobre borradores o
  versiones futuras. Una versión ya publicada es inmutable y cualquier corrección se
  expresa como una versión nueva.
- **BR-005**: Este feature no cambia score, escala, bandas, factores explicables,
  recomendación, versión de criterios ni revisión manual; el servicio de scoring no
  puede recibir el contenido de términos ni usar la aceptación como factor crediticio.
- **BR-006**: Ante datos insuficientes o dependencia no verificable, nunca se infiere
  aceptación ni se crea evidencia; el resultado determinista es acceso bloqueado y reintento.

### Validation Matrix *(mandatory)*

| ID | Flow / Field / State | Input or Condition | Rule and Boundary | Failure Behavior | Error / Message |
|----|----------------------|--------------------|-------------------|------------------|-----------------|
| VAL-001 | Inicio | Identidad autenticada | Debe existir una versión vigente y una aceptación exacta | Bloquea negocio y muestra términos o indisponibilidad | “Debes aceptar los términos vigentes para continuar” |
| VAL-002 | Aceptación | Versión mostrada | Debe coincidir con la vigente al confirmar | No registra; recarga versión | “Los términos cambiaron; revisa la nueva versión” |
| VAL-003 | Aceptación | Identidad/ámbito | Solo los derivados de la sesión son válidos | Deniega y no registra | “No fue posible validar tu sesión” |
| VAL-004 | Aceptación | Repetida o concurrente | Una evidencia lógica por identidad, ámbito y versión | Devuelve la aceptación existente | “Términos aceptados” |
| VAL-005 | Publicación | Identificador | Requerido, único e inmutable | Mantiene borrador o versión previa | “El identificador de versión ya existe” |
| VAL-006 | Publicación | Título/contenido | Título 1–200 caracteres; contenido no vacío | Rechaza publicación | “Completa el título y el contenido” |
| VAL-007 | Publicación | Fecha efectiva | Igual o posterior a publicación y sin vigencia solapada | Rechaza atómicamente | “La vigencia entra en conflicto con otra versión” |
| VAL-008 | Auditoría | Rango de fechas | Inicio no posterior a fin; máximo según política de consulta existente | Rechaza consulta | “Revisa el rango de fechas” |
| VAL-009 | Dependencia | Estado no verificable o timeout | Nunca presume aceptación | Bloquea y permite reintento/salida | “No podemos verificar los términos en este momento” |
| VAL-010 | Retención | Aceptación con cinco años cumplidos | Anonimiza o elimina identificadores sin cambiar métricas agregadas seguras | Reintenta de forma idempotente | No se muestra a usuarios; alerta operativa segura |

### Error Scenarios *(mandatory)*

| ID | Trigger | Expected State | User/API Response | Logging & Recovery |
|----|---------|----------------|-------------------|--------------------|
| ERR-001 | Servicio de términos no disponible | Acceso bloqueado; evidencia existente intacta | Mensaje reintentable y opción de salir | Correlación, dependencia y clase de error sin token; recuperación automática o rollback |
| ERR-002 | Almacén durable no disponible al aceptar | Aceptación pendiente, nunca confirmada | “No pudimos guardar tu aceptación; inténtalo de nuevo” | No registra éxito; reintento idempotente tras recuperar dependencia |
| ERR-003 | Versión cambia durante lectura | Sin aceptación para la nueva versión | Muestra aviso y carga el nuevo documento | Registra conflicto de versión sin contenido; no requiere intervención manual |
| ERR-004 | Sesión expirada o identidad inválida | Sesión no autorizada; sin evidencia nueva | Solicita autenticación nuevamente | Evento de autenticación seguro; retoma lectura tras sesión válida |
| ERR-005 | Publicación concurrente incompatible | Última versión válida permanece vigente | Conflicto accionable al administrador | Registra versiones implicadas y actor, sin secretos; administrador revisa |
| ERR-006 | Consulta de auditoría fuera de ámbito | Estado sin cambios y sin datos filtrados | Acceso denegado | Evento de denegación con actor, ámbito y correlación autorizados |
| ERR-007 | Fallo de retención | Evidencia no se elimina parcialmente | Sin impacto visible inmediato | Alerta, reintento idempotente y evidencia de disposición posterior |

### UI/UX Requirements *(mandatory)*

- **Visual System**: La pantalla usa el sistema visual existente de la aplicación:
  tipografía, colores, espaciado, controles y mensajes coherentes. El documento aparece
  en una superficie de lectura clara con título, versión y vigencia visibles.
- **Responsive Layout**: Contenedor centrado con ancho de lectura cómodo, gutters
  adaptativos y acciones visibles en 320, 375, 768, 1024 y 1440 píxeles; en móvil las
  acciones se apilan sin reducir el área táctil.
- **Accessibility**: Cumplimiento WCAG 2.2 AA en contraste, estructura semántica,
  encabezados, orden de lectura, zoom, etiquetas, foco visible y navegación completa por
  teclado. El foco inicial identifica el título y los errores se anuncian sin depender del color.
- **Complete States**: Deben existir estados de carga, documento visible, aceptación en
  proceso, éxito, versión cambiada, sesión expirada, servicio no disponible y acción
  deshabilitada. “Aceptar” solo está disponible con contenido cargado y sesión válida;
  “Salir” permanece accesible.
- **Layout Integrity**: No hay superposición, recorte, salto inesperado, scroll horizontal
  accidental ni acciones ocultas por barras fijas. El contenido largo conserva lectura
  y foco sin bloquear las acciones.
- **Responsive Evidence**: Antes de aceptación se requieren capturas o pruebas visuales
  reproducibles y recorrido automatizado de teclado y contraste en 320×568, 375×667,
  768×1024, 1024×768 y 1440×900, incluidos carga, error y contenido largo.

### Key Entities *(mandatory)*

- **Versión de términos**: Documento inmutable identificado por versión, título,
  contenido aprobado, estado, fechas de publicación y vigencia, actor publicador y
  correlación auditable. Se relaciona con cero o más aceptaciones.
- **Aceptación de términos**: Evidencia inmutable de que una identidad autenticada de un
  ámbito aceptó una versión exacta en un instante; su unicidad lógica es identidad,
  ámbito y versión, y sigue la política de retención de cinco años.
- **Identidad y ámbito existentes**: Se leen del contexto autenticado para autorización
  y relación con la aceptación; este feature no administra ni modifica su ciclo de vida.
- **Evento de auditoría existente**: Registra publicación, aceptación, denegación y
  disposición con metadatos mínimos; no almacena el contenido del documento ni tokens.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En el 100 % de los recorridos de aceptación, una identidad sin aceptación
  vigente no puede ver ni ejecutar funciones de negocio antes de confirmar.
- **SC-002**: Al menos el 95 % de las personas puede leer y aceptar los términos en menos
  de 2 minutos en pruebas de usabilidad, sin asistencia y en el primer intento.
- **SC-003**: El 100 % de las aceptaciones confirmadas puede rastrearse a identidad,
  ámbito, versión e instante, y ninguna aceptación fallida aparece como confirmada.
- **SC-004**: El 99 % de los inicios con servicio saludable determina y muestra el estado
  correcto de términos en menos de 2 segundos desde que concluye la autenticación.
- **SC-005**: El 100 % de los usuarios que aceptaron la versión vigente evita solicitudes
  repetidas hasta que una nueva versión entra en vigor.
- **SC-006**: En pruebas de cambio de versión, sesión antigua, acceso directo y dependencia
  caída, el 100 % de intentos permanece bloqueado sin pérdida ni duplicación de evidencia.
- **SC-007**: Las cinco resoluciones representativas pasan las verificaciones visuales,
  de teclado y WCAG AA sin defectos críticos de acceso o layout.
- **SC-008**: Una prueba de rollback y recuperación restaura el flujo saludable y conserva
  el 100 % de documentos publicados y aceptaciones confirmadas.

## Assumptions *(mandatory)*

- La autenticación ocurre antes del control de términos y aporta una identidad estable,
  rol y ámbito; se reutiliza el proveedor existente sin ampliar su responsabilidad.
- “Al inicio” significa después de autenticar y antes de cargar datos de negocio, con
  nueva verificación en navegación o acciones protegidas para impedir evasión.
- Todas las personas que usan funciones de negocio —analistas, supervisores y auditores—
  deben aceptar; las identidades puramente técnicas no usan la interfaz y se autorizan
  por contratos de servicio separados.
- El equipo jurídico entrega contenido aprobado y fechas efectivas; el sistema conserva
  y presenta ese contenido sin interpretarlo.
- Solo una versión es obligatoria a la vez. Las correcciones se publican como una nueva
  versión, lo que hace reversible la programación antes de su vigencia sin mutar historia.
- La política existente de cinco años para consentimiento y auditoría se extiende a la
  evidencia de aceptación por coherencia regulatoria y operativa.
- El servicio de términos usa persistencia durable porque documentos y aceptaciones
  deben sobrevivir reinicios y rollbacks; la tecnología concreta se decide en el plan.
- La única entrada pública continúa siendo la interfaz existente; el nuevo servicio no
  necesita un host adicional. Su interfaz propia se entrega bajo un prefijo del mismo
  host y permanece independiente en código, build, imagen, salud y despliegue.
