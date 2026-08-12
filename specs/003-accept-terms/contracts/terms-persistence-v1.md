# Límite de persistencia de terms v1

- **Owner**: `terms-api`; ningún otro servicio accede directamente.
- **Boundary**: esquema/base lógica `terms`, migrable a instancia propia sin cambiar los
  contratos HTTP.
- **Roles**: runtime, migrator, retention y backup separados; no se reutilizan usuarios
  de ingestion.
- **Transactions**: publicación serializada; aceptación compara versión+digest e inserta
  aceptación, idempotencia y auditoría atómicamente.
- **Constraints**: versión/digest únicos; una versión aplicable; aceptación única por
  ámbito+actor+versión; eventos append-only.
- **Migrations**: ordenadas, checksum, advisory lock propio, Job previo al rollout,
  expand/contract N/N-1 y sin down destructivo automático.
- **Retention**: cinco años; función acotada anonimiza actor/ámbito/fingerprint por lote
  y deja evento de disposición.
- **Backup/restore**: RPO 24 h, RTO 4 h, backup cifrado fuera del PVC, restore aislado
  con integridad, autorización y smoke. El backup actual de scoring no prueba cobertura.
- **Contract tests**: migración desde vacío y N-1, concurrencia de publicación/aceptación,
  permisos negativos por rol, backup/restore y retención idempotente.

El detalle de entidades está en `../data-model.md`.

