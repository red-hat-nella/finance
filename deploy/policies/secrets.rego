package finance2.secrets

import rego.v1

deny contains "rendered Secret objects are forbidden" if input.kind == "Secret"

deny contains message if {
  input.kind == "ConfigMap"
  some key, _ in input.data
  regex.match("(?i)(password|token|private.?key)", key)
  message := sprintf("ConfigMap %s contains sensitive-looking key %s", [input.metadata.name, key])
}
