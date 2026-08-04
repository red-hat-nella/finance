import hashlib
import json
from functools import lru_cache
from pathlib import Path
from typing import Any

CRITERIA_VERSION = "SCORING-MVP-1.0.0"


@lru_cache(maxsize=1)
def load_criteria() -> tuple[dict[str, Any], str]:
    path = Path(__file__).with_name(f"{CRITERIA_VERSION}.json")
    raw = path.read_bytes()
    criteria: dict[str, Any] = json.loads(raw)
    if criteria["version"] != CRITERIA_VERSION:
        raise RuntimeError("criteria version mismatch")
    canonical = json.dumps(criteria, sort_keys=True, separators=(",", ":")).encode()
    return criteria, hashlib.sha256(canonical).hexdigest()
