# Terms schema migrations

These immutable, forward-only migrations belong exclusively to `terms-api`. Apply them
in filename order using the finite migrator job and the `terms_migrator` credential.
Runtime pods must use `terms_app` and must never execute DDL.

The runner serializes concurrent releases with the advisory lock
`finance2-terms-schema-v1`, records a SHA-256 checksum for every applied file, and fails
closed when an applied file changes. Never edit an applied migration; add a new ordered
file using expand/contract changes compatible with release N and N-1.

Roles are provisioned outside migrations. Secrets for runtime, migration, retention and
backup are distinct and must be mounted from separate secret references. There are no
destructive automatic down migrations.
