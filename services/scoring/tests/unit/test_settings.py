from pathlib import Path

import pytest

from app.settings import Settings


def test_production_requires_a_strong_mounted_token(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SCORING_SERVICE_TOKEN_FILE", raising=False)
    with pytest.raises(ValueError, match="strong scoring service token"):
        Settings(app_env="production", scoring_service_token="development-token")


def test_reads_token_from_secret_file(tmp_path: Path) -> None:
    token_file = tmp_path / "token"
    token_file.write_text("x" * 48)
    settings = Settings(app_env="production", scoring_service_token_file=token_file)
    assert settings.scoring_service_token == "x" * 48


def test_rejects_missing_secret_file(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        Settings(app_env="production", scoring_service_token_file=tmp_path / "absent")
