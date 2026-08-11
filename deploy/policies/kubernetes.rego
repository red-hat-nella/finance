package finance2.kubernetes

import rego.v1

workload contains input if input.kind in {"Deployment", "StatefulSet", "Job"}
workload contains input.spec.jobTemplate if input.kind == "CronJob"

deny contains message if {
  some resource in workload
  spec := resource.spec.template.spec
  spec.automountServiceAccountToken != false
  message := sprintf("%s must disable ServiceAccount token automount", [input.metadata.name])
}

deny contains message if {
  some resource in workload
  spec := resource.spec.template.spec
  spec.securityContext.runAsNonRoot != true
  message := sprintf("%s must run non-root", [input.metadata.name])
}
