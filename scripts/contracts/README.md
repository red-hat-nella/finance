# Contratos

Los OpenAPI bajo `specs/001-alternative-credit-scoring/contracts/` son la fuente
única. Ejecute `./scripts/contracts/validate.sh` antes de generar consumidores y
`./scripts/contracts/generate-public.sh && ./scripts/contracts/generate-scoring.sh`
después de cada cambio compatible. `check-breaking.sh` compara contra un directorio
de baseline cuando se proporciona como primer argumento.

