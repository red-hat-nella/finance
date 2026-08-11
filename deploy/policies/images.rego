package finance2.images

import rego.v1

pod_spec := input.spec.template.spec if input.kind in {"Deployment", "StatefulSet", "Job"}
pod_spec := input.spec.jobTemplate.spec.template.spec if input.kind == "CronJob"

deny contains message if {
  some container in pod_spec.containers
  not contains(container.image, "@sha256:")
  message := sprintf("%s/%s must use an immutable digest", [input.metadata.name, container.name])
}

deny contains message if {
  some container in pod_spec.containers
  endswith(container.image, ":latest")
  message := sprintf("%s/%s uses latest", [input.metadata.name, container.name])
}
