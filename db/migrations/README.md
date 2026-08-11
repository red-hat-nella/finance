# Release migration contract

Migration files are immutable after release. The release Job runs them in filename
order while holding the session-level advisory lock
`finance2-schema-migrations-v1`. Each applied filename stores a SHA-256 checksum;
reuse with different content fails before rollout.

Database role provisioning is a bootstrap responsibility. Before the ordinary
migration Job runs, the approved provider or DBA creates `scoring_app`,
`scoring_migrator`, and the retention identities described in
`deploy/gitops/bootstrap/repository-contract.yaml`. Historical migrations contain
conditional role creation for local bootstrap compatibility, but the production
schema owner must not receive routine role-administration or superuser privileges.

Schema evolution follows expand/contract:

1. Release N adds compatible structures and supports application N-1.
2. Release N migrates/backfills data observably.
3. A later release removes obsolete structures only after rollback to N-1 is no longer
   required and a verified recovery path exists.

Automatic destructive down migrations are forbidden. A checksum mismatch, concurrent
attempt, failed transaction, or missing pre-provisioned role blocks promotion.
