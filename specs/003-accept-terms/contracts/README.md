# Contratos v1 de términos y condiciones

| Contrato | Productor | Consumidores | Propósito |
|----------|-----------|--------------|-----------|
| `terms-public-v1.openapi.yaml` | `terms-api` | `terms-web`; clientes administrativos autorizados | Documento vigente, aceptación propia, versiones y auditoría |
| `terms-access-internal-v1.openapi.yaml` | `terms-api` | `ingestion` | Decisión fail-closed sin contenido legal |
| `terms-persistence-v1.md` | `terms-api`/migraciones | DB, backup, retención, pruebas | Ownership, roles, transacciones y ciclo de datos |

Los contratos OpenAPI usan 3.1.0 y errores `application/problem+json` compatibles con
RFC 9457. Campos nuevos opcionales son compatibles; eliminar/renombrar campos, cambiar
semántica o endurecer validación requiere una versión mayor. Todo cambio pasa lint,
bundle, generación de tipos, prueba productor/consumidor y comparación breaking.

