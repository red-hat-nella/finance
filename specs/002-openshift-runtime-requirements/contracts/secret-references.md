# Contrato de referencias sensibles v1

Los valores se crean o sincronizan por un canal seguro durante bootstrap. El repositorio
solo declara nombres y keys. La implementación debe dividirlos para que cada pod monte
exclusivamente sus keys.

| Referencia lógica | Consumidor | Keys requeridas | Propósito |
|-------------------|------------|-----------------|-----------|
| `ingestion-runtime` | ingestion | `database-password`, `scoring-service-token` | Runtime de API y autenticación interna |
| `scoring-runtime` | scoring | `scoring-service-token` | Autenticación interna |
| `database-migrator` | migrations | `database-migrator-password` | DDL acotado; la provisión de roles pertenece al bootstrap DBA |
| `database-retention` | retention | `database-retention-password` | Disposición programada |
| `database-runtime` | reconciler | `database-password` | Recuperación de intentos |
| `database-tls` | ingestion y jobs | `ca.crt` | Verificación de PostgreSQL externo |
| `pii-keyring` | ingestion | `encryption-key-v1`, `hmac-key-v1`; versiones posteriores siguen el mismo patrón | Lectura/rotación de PII histórica; retirar una versión requiere re-encryption verificada |
| `database-backup` | backup/restore | `database-backup-password` | Rol de lectura acotado para recuperación |
| `registry-push` | identidad de build | referencia gestionada por plataforma | Publicar imágenes; nunca se monta en workloads |
| `gitops-repository` | bot/reconciliador | referencia de GitHub App o robot revocable | Proponer/leer estado deseado |
| `backup-target` | backup/restore | `upload-curl.conf`, `restore-curl.conf`, `encryption-passphrase` | Transferencia HTTPS y cifrado fuera del PVC; los archivos config se crean por canal seguro |

Reglas:

1. Ningún Secret se incluye en Kustomize base ni en salida renderizada.
2. `stringData` solo puede aparecer en fixtures inequívocamente falsos que no se
   rendericen; la opción preferida es un esquema sin objeto Secret.
3. Todos los mounts usan `items` o volúmenes proyectados con `defaultMode: 0400`.
4. ServiceAccount tokens están deshabilitados salvo que una tarea invoque la API.
5. Rotar un valor no cambia el nombre lógico del contrato; las claves PII versionadas
   no se retiran hasta demostrar re-encryption o disposición.
6. Cambiar la clave HMAC activa requiere reindexar blind indexes antes del switch; la
   verificación de rotación bloquea la promoción si existen filas con una versión de
   cifrado ausente del keyring.
