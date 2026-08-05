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

La aceptación MVP enmendada para SC-001, SC-005 y SC-006 se ejecuta contra el
stack local saludable y comprueba tiempos de referencia, presupuestos de
interacción y semántica explicable sin registrar PII:

```bash
make acceptance
```

`bash scripts/test/us1-postgres.sh` levanta una instancia PostgreSQL efímera,
aplica todas las migraciones y verifica el ciclo de borradores, idempotencia,
ETag, cifrado, auditoría, evaluación determinística y scopes de autorización sin
reutilizar datos locales.

`bash scripts/test/validate-us1.sh` (o `make validate-us1`) conecta contratos,
lint y tipado, unidades, PostgreSQL efímero, scoring, frontend, smoke del stack,
E2E bajo/alto y las matrices visual y Axe en 320/375/768/1024/1440. Requiere el
stack local saludable en `US1_BASE_URL` (por defecto `http://127.0.0.1:8080`):

```bash
podman-compose -f deploy/local/compose.yaml -f deploy/local/compose.podman.yaml up -d
bash scripts/test/validate-us1.sh
```
