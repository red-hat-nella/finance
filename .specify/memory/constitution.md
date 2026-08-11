<!--
Sync Impact Report
- Version change: 1.0.0 -> 2.0.0
- Modified principles:
  - I. Valor de decisión explicable -> I. La aplicación determina la topología
  - II. Contratos antes que implementación -> II. Autonomía con mínima interacción
  - III. Calidad verificable por defecto -> III. Plataforma declarativa y operación sin pasos manuales
  - IV. Seguridad, privacidad y trazabilidad -> IV. Seguridad nativa de OpenShift
  - V. Operabilidad en plataforma Red Hat -> V. Persistencia y servicios de datos según necesidad
  - VI. UI/UX profesional y verificable -> VI. Operabilidad verificable
- Added principles:
  - VII. Adaptación a las capacidades reales
  - VIII. Documentación operativa como parte de la entrega
- Added sections:
  - Reglas de gobierno para el flujo SDD
- Removed sections:
  - Flujo de entrega y puertas de calidad (sus obligaciones se integran en los principios y el gobierno SDD)
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md
  - ✅ .specify/templates/spec-template.md
  - ✅ .specify/templates/tasks-template.md
  - ✅ .specify/templates/checklist-template.md
- Command templates: no existe .specify/templates/commands/; no se requiere actualización
- Runtime guidance:
  - ✅ README.md
  - ⚠ .agents/skills/speckit-specify/SKILL.md (fuera del alcance de escritura disponible)
  - ⚠ .agents/skills/speckit-plan/SKILL.md (fuera del alcance de escritura disponible)
  - ⚠ .agents/skills/speckit-tasks/SKILL.md (fuera del alcance de escritura disponible)
  - ⚠ .agents/skills/speckit-implement/SKILL.md (fuera del alcance de escritura disponible)
  - ⚠ .agents/skills/speckit-clarify/SKILL.md (fuera del alcance de escritura disponible)
- Repository tracking:
  - ⚠ `.specify/` está ignorado por `.gitignore`; se requiere decidir su política de versionado antes del commit
- Follow-up TODOs:
  - sincronizar las guías de agente pendientes cuando exista permiso de escritura
  - versionar la constitución y las plantillas o trasladarlas al origen canónico rastreado por el repositorio
-->
# Constitución de la Aplicación de Scoring Crediticio Alternativo

Esta constitución gobierna cómo los artefactos SDD se transforman en una solución
desplegable, segura y operable en OpenShift. Sus obligaciones aplican a cualquier
topología que se derive de la aplicación y prevalecen sobre defaults, ejemplos o
preferencias de implementación incompatibles.

## Core Principles

### I. La aplicación determina la topología

El despliegue DEBE derivarse de `spec.md`, los contratos, el modelo de datos y, cuando
exista, el código fuente. El análisis DEBE identificar todos los componentes
ejecutables y sus relaciones, incluidos frontends, APIs, servicios internos, workers,
procesos batch, tareas programadas, migraciones, bases de datos, caches, colas,
almacenamiento de objetos y dependencias externas. Cada componente DEBE mapearse al
recurso OpenShift que corresponda a su comportamiento; Deployments, StatefulSets,
Jobs, CronJobs, Services, Routes y almacenamiento persistente solo PUEDEN utilizarse
cuando exista evidencia de su necesidad. Ninguna plantilla PUEDE imponer un único
servicio web ni otra estructura fija. La solución DEBE admitir monolitos,
microservicios y aplicaciones con o sin uno o varios servicios de datos.

**Fundamento**: la plataforma representa el comportamiento real de la aplicación; una
topología prefabricada introduce recursos innecesarios y omite procesos críticos.

### II. Autonomía con mínima interacción

El agente DEBE inferir decisiones primero desde los artefactos del proyecto, aplicar
después defaults conservadores y finalmente descubrir capacidades del cluster mediante
acceso de solo lectura cuando esté disponible. NO DEBE solicitar nombres internos,
probes básicas, puertos detectables, organización de manifiestos, estrategia de build
compatible, recursos iniciales prudentes ni separación entre componentes cuando pueda
resolverlos con evidencia. Solo PUEDE solicitar datos externos al proyecto que no sean
descubribles y resulten imprescindibles: destino autorizado, acceso seguro,
restricciones corporativas, dominios controlados, datos regulatorios o aprobaciones.
Todas las entradas de plataforma imprescindibles DEBEN agruparse en una única solicitud
corta. La falta de acceso al cluster NO PUEDE impedir generar, renderizar y validar
estáticamente los artefactos independientes de ese acceso.

**Fundamento**: la automatización debe reducir decisiones trasladadas al cliente sin
inventar autoridad, políticas corporativas ni información externa.

### III. Plataforma declarativa y operación sin pasos manuales

El estado deseado de cada ambiente DEBE versionarse como código y reconciliarse con
OpenShift GitOps o una capacidad GitOps equivalente aprobada. La integración continua
DEBE probar, analizar, construir una sola vez, publicar una imagen inmutable, actualizar
su referencia por digest y producir evidencia trazable. Los despliegues ordinarios NO
PUEDEN depender de comandos manuales del cliente; las acciones manuales se limitan al
bootstrap y a aprobaciones organizacionales expresamente requeridas. Todo cambio DEBE
permitir promoción controlada, detección de fallos, rollback a una versión saludable y
trazabilidad entre commit, imagen, configuración y ambiente.

**Fundamento**: GitOps y los artefactos inmutables convierten el despliegue en un proceso
repetible, auditable y recuperable.

### IV. Seguridad nativa de OpenShift

Las cargas DEBEN ejecutarse sin privilegios, aceptar un UID arbitrario, usar filesystem
de solo lectura cuando sea viable y declarar capacidades, ServiceAccounts y permisos
mínimos. Toda excepción DEBE incluir evidencia técnica, riesgo y mitigación. La
configuración y los secretos DEBEN permanecer separados. Credenciales reales NO PUEDEN
aparecer en prompts, especificaciones, planes, repositorios, manifiestos de ejemplo ni
logs. Los secretos DEBEN inyectarse en runtime desde mecanismos aprobados; el repositorio
solo PUEDE contener referencias, esquemas o ejemplos inequívocamente falsos.

La exposición de red DEBE limitar Routes a entradas externas, Services a comunicación
interna y NetworkPolicies a los flujos reales entre componentes. Las imágenes DEBEN
escanearse, identificarse por digest y cumplir las políticas de seguridad del cluster.

**Fundamento**: el modelo de seguridad debe ser compatible con OpenShift y verificable
sin distribuir material sensible ni privilegios innecesarios.

### V. Persistencia y servicios de datos según necesidad

La persistencia DEBE derivarse de requisitos de consistencia, durabilidad, concurrencia,
recuperación y retención; NO PUEDE presumirse ni omitirse. Antes de autogestionar una
base de datos, cache, cola u otro servicio con estado, el plan DEBE preferir un operador
soportado o un servicio administrado aprobado cuya disponibilidad haya sido confirmada.
Si el servicio se ejecuta en OpenShift, el diseño DEBE definir almacenamiento, backups,
restauración, actualizaciones, disponibilidad y límites operativos; un PVC aislado NO
constituye una estrategia de datos. Las migraciones de esquema DEBEN ser automatizadas,
observables, idempotentes cuando corresponda y estar desacopladas del arranque
concurrente de réplicas.

**Fundamento**: los servicios con estado requieren una estrategia de ciclo de vida y
recuperación, no solo asignación de volumen.

### VI. Operabilidad verificable

Cada workload DEBE declarar recursos, health checks pertinentes, estrategia de rollout
y comportamiento de terminación. Los probes DEBEN corresponder al protocolo y ciclo de
vida real del componente. La solución DEBE producir logs estructurados sin datos
sensibles, métricas y alertas mínimas derivadas de objetivos funcionales y dependencias
críticas. La validación DEBE incluir renderizado, esquemas, políticas, rollout y smoke
tests representativos del flujo principal. La automatización NO PUEDE considerarse
terminada hasta demostrar build, publicación, reconciliación, disponibilidad,
conectividad necesaria, persistencia cuando aplique y rollback.

**Fundamento**: una configuración declarativa solo es entregable cuando existe evidencia
de que puede operar, fallar y recuperarse de forma observable.

### VII. Adaptación a las capacidades reales

El diseño NO PUEDE asumir operadores, StorageClasses, registros, ingress, gestores de
secretos ni productos opcionales instalados. Cada capacidad DEBE descubrirse o tratarse
como configuración explícita. Las APIs DEBEN ser estables y soportadas por la versión
objetivo de OpenShift. Toda dependencia opcional DEBE declarar prerrequisitos y una
alternativa razonable cuando exista. El acceso MCP o equivalente DEBE comenzar en modo
de solo lectura, limitarse al alcance autorizado y excluir la lectura de Secrets. La
inspección sirve para descubrir y verificar; NO PUEDE sustituir GitOps como fuente de
verdad.

**Fundamento**: el diseño debe ser portable y honesto respecto de las capacidades que
han sido confirmadas y las que siguen pendientes.

### VIII. Documentación operativa como parte de la entrega

La entrega DEBE incluir documentación versionada y actualizada de la arquitectura
desplegada y los recursos creados, suficiente para operar, diagnosticar y transferir la
aplicación. DEBE cubrir contexto o cluster utilizado, ambientes, namespaces, workloads,
pods esperados, Services, Routes y URLs, recursos de datos, almacenamiento, Jobs,
CronJobs, identidades, configuración, dependencias y flujo GitOps. DEBE diferenciar
recursos deseados, recursos confirmados en el cluster y valores pendientes de
validación; un recurso generado declarativamente NO PUEDE documentarse como existente.
Tokens, contraseñas, contenido de Secrets, kubeconfigs y URLs con credenciales NO PUEDEN
incluirse. Las referencias sensibles solo DEBEN mostrar nombre y ubicación segura. La
documentación DEBE actualizarse automáticamente o como parte obligatoria del mismo
cambio que modifica la plataforma.

**Fundamento**: la operación y el traspaso dependen de documentación verificable que no
confunda intención declarativa con estado observado.

## Reglas de gobierno para el flujo SDD

`spec.md` DEBE definir resultados operativos observables y restricciones de negocio,
sin exigir que el cliente diseñe la plataforma. `plan.md` DEBE derivar la arquitectura
concreta de OpenShift desde la aplicación y justificar cada componente adicional de
plataforma. `tasks.md` DEBE incluir generación, validación y prueba de todos los
artefactos necesarios para despliegues ordinarios sin pasos manuales, además de generar
y verificar la documentación operativa desde manifiestos renderizados y, cuando exista
acceso autorizado, desde el estado real del cluster.

Cada decisión inferida DEBE registrar evidencia y default aplicado. Cada dato descubierto
DEBE registrar su fuente sin copiar información sensible. Si falta un dato externo
realmente bloqueante, el agente DEBE completar todo trabajo independiente y emitir
`PLATFORM_INPUT_REQUIRED` con únicamente los campos imprescindibles, el motivo y el canal
seguro esperado. Una preferencia no expresada NO PUEDE convertirse en pregunta
bloqueante. Ante alternativas equivalentes, el agente DEBE elegir la opción más simple,
soportada, reversible y coherente con el proyecto.

Los chequeos constitucionales previos a investigación y posteriores al diseño DEBEN
confirmar los ocho principios. Cualquier excepción temporal DEBE registrar alcance,
evidencia, riesgo, mitigación, responsable y fecha de resolución; una contradicción
directa con un principio BLOQUEA la implementación y exige una enmienda aprobada.

## Governance

Esta constitución prevalece sobre especificaciones, planes, contratos, tareas,
manifiestos y prácticas locales incompatibles. Toda revisión de especificación, plan,
cambio de plataforma y entrega DEBE comprobar cumplimiento y trazabilidad hasta su
evidencia de validación. Los revisores DEBEN rechazar afirmaciones de estado del cluster
sin fuente, despliegues ordinarios manuales, secretos expuestos o trabajo marcado como
terminado sin las demostraciones exigidas.

Una enmienda DEBE actualizar este documento, describir el impacto en el Sync Impact
Report, sincronizar plantillas y guías dependientes, proporcionar una estrategia de
migración cuando cambien obligaciones existentes y recibir aprobación explícita del
responsable del proyecto. La versión sigue SemVer: MAJOR para eliminaciones o
redefiniciones incompatibles de principios o gobierno; MINOR para principios, secciones
u obligaciones nuevas compatibles; PATCH para aclaraciones sin cambio de obligación.
La fecha de última enmienda DEBE actualizarse con cada cambio aprobado; la fecha de
ratificación original NO DEBE modificarse.

**Version**: 2.0.0 | **Ratified**: 2026-08-03 | **Last Amended**: 2026-08-09
