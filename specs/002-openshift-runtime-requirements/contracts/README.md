# Contratos de plataforma v1

Esta feature no modifica los contratos HTTP de la aplicación:

- `specs/001-alternative-credit-scoring/contracts/ingestion-public-v1.openapi.yaml`
- `specs/001-alternative-credit-scoring/contracts/scoring-internal-v1.openapi.yaml`

Añade contratos para intercambiar entradas no sensibles y evidencia entre
descubrimiento, CI, GitOps y documentación:

| Contrato | Productor | Consumidores | Compatibilidad | Validación |
|----------|-----------|--------------|----------------|------------|
| `platform-profile.schema.json` | `scripts/platform/discover` y bootstrap | render, pipeline, GitOps, documentación | Nuevos campos opcionales son compatibles; eliminar/renombrar requiere v2 | JSON Schema + prueba de ausencia de secretos |
| `deployment-evidence.schema.json` | pipeline y verificación | promoción, rollback, documentación, auditoría | Enum/campos requeridos solo cambian con nueva versión | JSON Schema + vínculo a commit/digests |
| `secret-references.md` | equipo de plataforma por canal seguro | workloads, jobs y pipeline | Las keys son contrato estable; rotación no cambia nombres | Render sin Secret values + mounts mínimos |

Los documentos de instancia no pueden contener tokens, kubeconfigs, passwords,
private keys ni contenido de Secrets. `SECRET_REFERENCE` admite nombre y ruta segura,
nunca valor.

