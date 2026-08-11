package finance2.network

import rego.v1

deny contains message if {
  input.kind == "Route"
  input.metadata.name != "frontend"
  message := sprintf("Route %s has no external flow", [input.metadata.name])
}

deny contains message if {
  input.kind == "Service"
  input.spec.type in {"NodePort", "LoadBalancer"}
  message := sprintf("Service %s must stay internal", [input.metadata.name])
}

deny contains message if {
  input.kind == "NetworkPolicy"
  some egress in input.spec.egress
  some destination in egress.to
  destination.ipBlock.cidr == "0.0.0.0/0"
  message := sprintf("NetworkPolicy %s contains unrestricted egress", [input.metadata.name])
}
