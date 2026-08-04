# Aplicacion de Scoring Crediticio Alternativo

MVP de apoyo a analistas de credito para registrar datos alternativos, calcular un
score determinista y explicable y consultar evaluaciones historicas. La recomendacion
es orientativa y nunca representa una aprobacion crediticia automatica definitiva.

## Componentes

- `frontend/`: Angular 18 y Angular Material.
- `services/ingestion/`: API publica Express y persistencia PostgreSQL.
- `services/scoring/`: motor interno FastAPI sin PII.
- `db/migrations/`: esquema SQL versionado.
- `deploy/local/`: topologia Compose.
- `deploy/openshift/`: recursos Kustomize para OpenShift.
- `specs/001-alternative-credit-scoring/`: especificacion, contratos y evidencia.

Consulte `specs/001-alternative-credit-scoring/quickstart.md` para ejecutar y validar
el sistema.
