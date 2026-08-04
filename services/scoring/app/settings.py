from functools import lru_cache
from pathlib import Path

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="", extra="ignore")
    app_env: str = "development"
    scoring_service_token_file: Path | None = None
    scoring_service_token: str | None = Field(
        default="development-token-must-never-be-used-in-production"
    )
    criteria_version: str = "SCORING-MVP-1.0.0"

    @model_validator(mode="after")
    def secure_production(self) -> "Settings":
        if self.scoring_service_token_file:
            self.scoring_service_token = self.scoring_service_token_file.read_text().strip()
        if self.app_env == "production" and (
            not self.scoring_service_token
            or len(self.scoring_service_token) < 32
            or self.scoring_service_token.startswith("development")
        ):
            raise ValueError("a strong scoring service token file is required in production")
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
