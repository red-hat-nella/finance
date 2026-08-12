# Investigación: microservicio independiente de términos y condiciones

## Contexto y fuentes

La investigación contrastó `spec.md`, el código de frontend y servicios, la topología
local/OpenShift, la entrega GitOps y la evidencia del cluster. No quedan marcadores
`NEEDS CLARIFICATION`. Las decisiones son defaults reversibles derivados del proyecto.

## Decisión 1: bounded context y workloads independientes

**Decision**: implementar `terms` como bounded context autónomo con `terms-web`, una SPA
con interfaz gráfica propia, y `terms-api`, dueño exclusivo de reglas y datos. Cada uno
tiene código, build, imagen, configuración, salud y Deployment independientes. Se
versionan y prueban juntos por contrato, sin importación runtime del frontend principal.

**Rationale**: el usuario exige microservicio independiente e interfaz propia. Separar
web y API conserva el patrón ya usado por `frontend`/`ingestion` y permite liberar o
recuperar la UI legal sin acoplarla al frontend de scoring. La evidencia está en
`frontend/`, `services/ingestion/`, sus Dockerfiles y Deployments.

**Alternatives considered**: integrar pantallas en `frontend` contradice independencia;
iframe o module federation añade acoplamiento runtime, problemas de OIDC, foco y CSP;
servir SPA y API en un único proceso reduce recursos pero une ciclos de seguridad y
rollout. Esta última opción sigue siendo una consolidación futura reversible.

**Consequences and validation evidence**: se agregan dos imágenes, dos Services y dos
PDB. Las pruebas deben demostrar que `terms-web` funciona sin el bundle principal y que
solo depende del contrato público v1 de `terms-api`.

## Decisión 2: una sola entrada pública, enrutada por prefijo

**Decision**: conservar la Route y host públicos actuales. El gateway web existente
enruta `/terms/**` a `terms-web` y `/terms-api/**` a `terms-api`; `/api/**` permanece en
`ingestion`. No se crea otra Route ni dominio.

**Rationale**: `frontend/nginx.conf` ya es la entrada same-origin y la política de red
solo permite Route hacia frontend. Esto evita CORS y múltiples sesiones OIDC sin negar
la independencia de build y ejecución.

**Alternatives considered**: Route/host propio aumenta configuración DNS/TLS/CORS y no
está exigido; path-specific Routes bajo el mismo host dependen de política del router.

**Consequences and validation evidence**: el proxy no contiene lógica de negocio. Se
prueban precedencia de locations, fallback SPA, cabeceras de correlación y ausencia de
acceso directo externo a Services internos.

## Decisión 3: control obligatorio en UI y backend

**Decision**: `terms-web` resuelve el gate de experiencia, pero `ingestion` consulta
sincrónicamente `terms-api` después de autenticar y antes de cualquier ruta de negocio.
Una aceptación ausente retorna 428 con URL same-origin; timeout, respuesta inválida o
indisponibilidad retorna 503. Ambos resultados son fail-closed.

**Rationale**: un guard de navegador puede omitirse. `services/ingestion/src/app.ts`
ofrece el punto común para controlar todas las operaciones. La verificación interna no
devuelve contenido legal y deriva identidad/ámbito del JWT validado.

**Alternatives considered**: confiar solo en el frontend es inseguro; duplicar tablas en
ingestion rompe ownership; cache positivo puede permitir acceso tras nueva vigencia y se
descarta inicialmente.

**Consequences and validation evidence**: timeout inicial de 500 ms, sin reintento inline,
circuito ante 5 fallos en 10 s y correlación. Pruebas de acceso directo, sesión antigua,
version change, timeout y recuperación deben dar decisiones deterministas.

## Decisión 4: contratos y autenticación

**Decision**: publicar OpenAPI 3.1 `terms-public-v1` para la UI y administración, y
`terms-access-internal-v1` para ingestion. JWT OIDC valida issuer, audience y algoritmo;
el actor y `org_id` nunca proceden del body. El contrato interno exige además identidad
de servicio independiente y NetworkPolicy. Problemas usan RFC 9457.

**Rationale**: replica los patrones de contrato, generación y autenticación existentes.
`terms_admin` se limita al contexto terms; analista, supervisor y auditor conservan sus
roles actuales.

**Alternatives considered**: compartir credencial de ingestion o confiar solo en red
viola mínimo privilegio; incluir identidad en query/body facilita suplantación.

**Consequences and validation evidence**: lint, bundle, generación y pruebas consumidor-
productor son gate de CI. `ingestion-public-v1` añade respuestas 428/503 sin filtrar el
contrato interno al navegador.

## Decisión 5: modelo y aislamiento de persistencia

**Decision**: `terms-api` es dueño exclusivo del esquema lógico `terms`, con roles
`terms_app`, `terms_migrator`, `terms_retention` y `terms_backup`. Dev puede compartir
la instancia PostgreSQL 16 existente; producción prefiere una base lógica administrada
separada. Ingestion nunca consulta tablas directamente.

**Rationale**: versiones y aceptaciones son durables, transaccionales y auditables. El
proyecto ya opera PostgreSQL, migraciones checksum/advisory lock y expand/contract.

**Alternatives considered**: una instancia nueva en dev añade costo sin aumentar el
aislamiento lógico necesario; reutilizar tablas/roles de ingestion rompe autonomía.

**Consequences and validation evidence**: migraciones propias, locks propios, backup y
restore que incluyan explícitamente terms. No se considera cubierto por el `pg_dump` de
`alternative_scoring` actual hasta ampliar la evidencia.

## Decisión 6: versionado, publicación e idempotencia

**Decision**: versiones publicadas son append-only. Una transacción serializa la
programación/publicación y garantiza exactamente una aplicable. Aceptación usa
`Idempotency-Key`, digest del contenido y unicidad por ámbito+actor+versión. Cambio de
versión devuelve conflicto sin confirmar aceptación obsoleta.

**Rationale**: satisface inmutabilidad legal, concurrencia y trazabilidad de FR-001,
FR-007, FR-008 y FR-012.

**Alternatives considered**: actualizar contenido publicado destruye evidencia;
timestamps sin digest no prueban el texto aceptado.

**Consequences and validation evidence**: pruebas concurrentes, replay igual/diferente,
lock de publicación, transición de vigencia y contenido alterado.

## Decisión 7: retención, backup y recuperación

**Decision**: anonimizar irreversiblemente actor y ámbito al cumplir cinco años,
conservando métricas agregadas y versión. Un CronJob diario idempotente registra la
disposición. RPO inicial 24 h y RTO 4 h; backup cifrado fuera del PVC y restore aislado
son obligatorios antes de producción.

**Rationale**: alinea la política existente y evita inventar una nueva. Anonimización
preserva evidencia estadística sin identificadores.

**Alternatives considered**: borrado total pierde métricas; retención indefinida no está
autorizada; PVC o snapshot sin restore probado no es backup.

**Consequences and validation evidence**: el rollback de aplicación revierte digest y
config, nunca ejecuta down migration. Restore verifica esquema, documentos, aceptación,
autorización y smoke.

## Decisión 8: sistema visual compartido en build

**Decision**: extraer un paquete foundation versionado con los tokens canónicos de la
app y consumirlo en ambos frontends durante build. `terms-web` replica Roboto, paleta
teal, escala 4/8, radios, foco, contenedor y estados; sus componentes y rutas son propios.

**Rationale**: `frontend/src/styles/_tokens.scss`, `_typography.scss`, `_a11y.scss` y el
shell vigente son la fuente de verdad. La recomendación genérica de UI/UX se limita a
content-first, minimalismo, foco visible y accesibilidad; no sustituye colores o fuentes.

**Alternatives considered**: copiar SCSS deriva con el tiempo; biblioteca runtime o
iframe reduce autonomía; adoptar otra paleta contradice consistencia solicitada.

**Consequences and validation evidence**: prueba de paridad de tokens, snapshots en
cinco viewports, geometría, teclado, zoom 200 %, reduced motion y Axe WCAG 2.2 AA.

## Decisión 9: topología OpenShift y delivery

**Decision**: dos Deployments stateless con dos réplicas, Services ClusterIP, PDB y SA
sin token; Job de migración anterior al rollout y CronJob de retención. Default-deny
permite solo gateway→web/API, ingestion→API, API/jobs→DB, API/web→JWKS y DNS. CI agrega
build/SBOM/scan/publish/digest de ambos componentes y GitOps los promueve por waves.

**Rationale**: deriva de ciclos reales y conserva los controles OpenShift existentes.
No se justifican StatefulSet, PVC, cache, cola, broker ni Route adicional.

**Alternatives considered**: Deployment único reduce independencia; exposición directa
amplía superficie; recursos con estado fuera de DB carecen de evidencia.

**Consequences and validation evidence**: render/esquema/policy, conectividad negativa,
rollout, smoke, persistencia, restore y rollback deben producir evidencia versionada.

## Descubrimiento y entradas externas

| Capacidad | Estado | Fuente no sensible | Consecuencia |
|-----------|--------|--------------------|--------------|
| OpenShift 4.21.21 dev | Observado | `build/platform/dev-profile.json` | APIs estables y validación server-side |
| Pipelines 1.23.1 | Observado | perfil dev | Extender pipeline existente |
| Storage `gp3` | Observado | perfil dev | Solo PostgreSQL dev; terms no recibe PVC |
| External Secrets | Observado en perfil más reciente | `build/platform/dev-profile.json` | Puede usarse si lo aprueba plataforma; Secret refs siguen siendo contrato |
| GitOps | No observado | bootstrap y perfil dev | Artefactos declarados; reconciliación dinámica pendiente |
| Producción/DB/backup | Externo pendiente | overlay production | No bloquea diseño; sí promoción |

`PLATFORM_INPUT_REQUIRED`: reconciliador y repositorio GitOps aprobados; perfil productivo
(namespace, registry, dominio/TLS); DB lógica administrada y hostname/CA/CIDR; destino y
política de backup/PITR; destino JWKS; monitoreo corporativo. IDs no sensibles via ticket
de plataforma y referencias/credenciales solo mediante vault o gestor aprobado.
