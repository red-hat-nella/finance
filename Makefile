.PHONY: install contracts validate-spec validate-foundation validate-us1 validate-us2 validate-us3 validate-us4 validate smoke visual manifests

install:
	npm ci
	npm --prefix frontend ci
	npm --prefix services/ingestion ci
	uv sync --project services/scoring --frozen --group dev

contracts:
	npm run contracts:lint
	npm run contracts:test

validate-spec:
	bash scripts/test/spec-artifacts.sh

validate-foundation: validate-spec contracts
	bash scripts/contracts/generate-public.sh --check
	bash scripts/contracts/generate-scoring.sh --check
	bash scripts/test/migrations.sh
	npm --prefix services/ingestion run lint
	npm --prefix services/ingestion run typecheck
	npm --prefix services/ingestion run test
	npm --prefix services/ingestion run test:authorization
	npm --prefix services/ingestion run test:integration
	cd services/scoring && uv run ruff check .
	cd services/scoring && uv run mypy app
	cd services/scoring && uv run pytest -q
	npm --prefix frontend run lint
	cd frontend && npx tsc --noEmit -p tsconfig.app.json && npx tsc --noEmit -p tsconfig.spec.json
	CHROME_BIN="$${CHROME_BIN:-$${HOME}/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome}" npm --prefix frontend run test -- --watch=false --browsers=ChromeHeadless

validate-us1:
	npm --prefix services/ingestion run test
	cd services/scoring && uv run pytest -q
	npm --prefix frontend run test -- --watch=false

validate-us2: validate-us1

validate-us3: validate-us2

validate-us4: validate-us3

validate: validate-foundation validate-us4
	npm --prefix frontend run build -- --configuration production

smoke:
	bash scripts/smoke/local-health.sh
	bash scripts/smoke/compose-e2e.sh

visual:
	PLAYWRIGHT_BASE_URL=http://127.0.0.1:8080 npm --prefix frontend run test:visual

manifests:
	bash scripts/test/manifests-policy.sh
