# One-time GitOps bootstrap

Bootstrap is limited to the authorized project `rh-ee-mpolo-dev`. It verifies
capabilities and `oc auth can-i`, creates namespace-scoped identities/RBAC, registers
repository and Secret references through the approved secure channel, and connects an
approved reconciler. It does not create projects, install operators, read Secrets, or
apply ordinary application releases.

The observed cluster does not expose `argoproj.io/Application`. The Application files
are therefore `DECLARED` and must not be submitted until an administrator enables
OpenShift GitOps or identifies an equivalent approved reconciler.
