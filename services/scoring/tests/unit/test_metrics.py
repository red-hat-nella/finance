from app.observability.metrics import record_request, render_metrics, timer


def test_metrics_use_bounded_labels_and_include_criteria_dependency() -> None:
    started = timer()
    record_request("POST", 503, started)
    rendered = render_metrics()
    assert 'service="scoring",method="POST",status_class="5xx"' in rendered
    assert 'dependency="criteria"' in rendered
    assert "503" not in rendered
