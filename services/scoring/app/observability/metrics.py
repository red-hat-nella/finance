from threading import Lock
from time import perf_counter

_lock = Lock()
_request_counts: dict[tuple[str, str], int] = {}
_duration_sum = 0.0
_duration_count = 0


def timer() -> float:
    return perf_counter()


def record_request(method: str, status_code: int, started: float) -> None:
    global _duration_count, _duration_sum
    status_class = f"{status_code // 100}xx"
    with _lock:
        key = (method, status_class)
        _request_counts[key] = _request_counts.get(key, 0) + 1
        _duration_sum += perf_counter() - started
        _duration_count += 1


def render_metrics() -> str:
    with _lock:
        lines = [
            "# HELP finance2_http_requests_total HTTP requests by method and status class.",
            "# TYPE finance2_http_requests_total counter",
        ]
        for (method, status_class), count in sorted(_request_counts.items()):
            labels = (
                f'service="scoring",method="{method}",'
                f'status_class="{status_class}"'
            )
            lines.append(
                f"finance2_http_requests_total{{{labels}}} {count}"
            )
        lines.extend(
            [
                "# HELP finance2_http_request_duration_seconds Aggregate HTTP request duration.",
                "# TYPE finance2_http_request_duration_seconds summary",
                f'finance2_http_request_duration_seconds_sum{{service="scoring"}} {_duration_sum}',
                "finance2_http_request_duration_seconds_count"
                f'{{service="scoring"}} {_duration_count}',
                'finance2_dependency_up{service="scoring",dependency="criteria"} 1',
            ]
        )
    return "\n".join(lines) + "\n"
