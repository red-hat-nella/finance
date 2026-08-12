.PHONY: install contracts validate-spec validate-foundation validate-us1 validate-us2 validate-us3 validate-us4 validate-terms-us1 validate-terms-us2 validate-terms-us3 validate-terms-ui validate-terms-security validate-terms-platform validate-terms-recovery validate-terms-quickstart validate-scoring-regression validate acceptance smoke visual manifests images push-images openshift-deploy platform-discover platform-render platform-validate platform-smoke platform-docs

install:
	npm ci
	npm run contracts:generate
	npm --prefix frontend ci
	npm --prefix services/ingestion ci
	uv sync --project services/scoring --frozen --group dev

contracts:
	npm run contracts:lint
	npm run contracts:test

validate-spec:
	bash scripts/test/spec-artifacts.sh

validate-foundation: validate-spec contracts
	npm run terms:lint
	npm run terms:typecheck
	npm run terms:build
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
	bash scripts/test/validate-us1.sh

validate-us2: validate-us1
	bash scripts/test/validate-us2.sh

validate-us3: validate-us2
	bash scripts/test/validate-us3.sh

validate-us4: validate-us3
	bash scripts/test/validate-us4.sh

validate-terms-us1:
	bash scripts/test/validate-terms-us1.sh

validate-terms-us2: validate-terms-us1
	bash scripts/test/validate-terms-us2.sh

validate-terms-us3: validate-terms-us2
	bash scripts/test/validate-terms-us3.sh

validate-terms-ui:
	npm run lint --workspace @finance2/terms-web
	npm run test --workspace @finance2/terms-web -- --watch=false --browsers=ChromeHeadless
	cd apps/terms-web && npx playwright test tests/e2e tests/visual tests/accessibility tests/performance --workers=1

validate-terms-security:
	node --test tests/security/terms-data-minimization.test.mjs

validate-terms-platform:
	node --test tests/platform/terms-*.test.mjs

validate-terms-recovery:
	node --test tests/platform/terms-backup-restore.test.mjs tests/platform/terms-release.test.mjs
	bash scripts/platform/verify-backup-restore --scope terms --evidence build/validation/terms/restore-evidence.json
	bash scripts/platform/verify-terms-release --environment dev --evidence build/validation/terms/release-evidence.json

validate-terms-quickstart:
	bash scripts/test/validate-terms-quickstart.sh

validate-scoring-regression:
	bash scripts/test/validate-scoring-regression.sh

validate:
	bash scripts/test/validate-all.sh

acceptance:
	bash scripts/test/usability-acceptance.sh

smoke:
	bash scripts/smoke/compose-e2e.sh "$${CONTAINER_ENGINE:-podman}"

visual:
	PLAYWRIGHT_BASE_URL=http://127.0.0.1:8080 npm --prefix frontend run test:visual

manifests:
	bash scripts/test/manifests-policy.sh

images:
	bash scripts/images/build.sh
	bash scripts/images/scan.sh

push-images:
	bash scripts/images/build.sh
	bash scripts/images/scan.sh
	bash scripts/images/publish.sh

openshift-deploy:
	bash scripts/openshift/deploy.sh apply "$${OPENSHIFT_OVERLAY:-dev}"

platform-discover:
	bash scripts/platform/discover --context current --namespace "$${OPENSHIFT_NAMESPACE:-rh-ee-mpolo-dev}" --output "$${PLATFORM_PROFILE_OUTPUT:-build/platform/dev-profile.json}"

platform-render:
	bash scripts/platform/render --all --output-dir "$${PLATFORM_RENDER_DIR:-build/rendered}"

platform-validate:
	bash scripts/platform/validate --all --cluster-version "$${OPENSHIFT_VERSION:-4.21.21}" --evidence-dir "$${PLATFORM_EVIDENCE_DIR:-build/platform/evidence/static}"

platform-smoke:
	bash scripts/platform/smoke --environment "$${OPENSHIFT_ENVIRONMENT:-dev}" --namespace "$${OPENSHIFT_NAMESPACE:-rh-ee-mpolo-dev}" --fixture tests/fixtures/medium-risk-application.json --evidence "$${PLATFORM_SMOKE_EVIDENCE:-build/platform/evidence/dev/smoke.json}"

platform-docs:
	scripts/platform/generate-operations-doc --render-root "$${PLATFORM_RENDER_DIR:-build/rendered}" --cluster-profile "$${PLATFORM_PROFILE_OUTPUT:-build/platform/dev-profile.json}" --output docs/operations/openshift-deployment.md
	scripts/platform/validate-operations-doc docs/operations/openshift-deployment.md
