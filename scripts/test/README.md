# Validaciones

Los scripts de este directorio fallan con codigo distinto de cero. `Makefile` los
ejecuta en el orden contratos -> migraciones -> servicios -> UI -> plataforma.

`make validate-foundation` requiere Node.js 22, npm, Python 3.12 con `uv`, Podman y
Chromium. Puede definir `CHROME_BIN`; por defecto se usa el Chromium instalado por
Playwright en el cache local. El target bloquea implementación posterior cuando:

- una especificación OpenAPI no valida o sus tipos generados están desactualizados;
- las migraciones no avanzan en orden sobre PostgreSQL 16 o permiten mutar auditoría;
- lint, tipado estricto o pruebas fundacionales de ingesta y scoring fallan;
- la configuración, autenticación, límites de API o pruebas base del frontend fallan.

Los generadores admiten validación no destructiva:

```bash
bash scripts/contracts/generate-public.sh --check
bash scripts/contracts/generate-scoring.sh --check
```
