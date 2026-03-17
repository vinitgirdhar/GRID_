from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT_DIR = Path(__file__).resolve().parent.parent
GRID_ML_DIR = ROOT_DIR / "grid_ml"


class Settings(BaseSettings):
    app_name: str = "GRID ML API"
    api_prefix: str = "/api"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    database_url: str = Field(
        default="sqlite:///./grid.db",
        alias="DATABASE_URL",
    )
    jwt_secret: str = Field(default="grid-dev-secret-change-me", alias="JWT_SECRET")
    jwt_issuer: str = Field(default="grid-api", alias="JWT_ISSUER")
    access_token_exp_minutes: int = Field(default=30, alias="ACCESS_TOKEN_EXP_MINUTES")
    refresh_token_exp_days: int = Field(default=14, alias="REFRESH_TOKEN_EXP_DAYS")
    weather_api_key: str = Field(default="", alias="WEATHER_API_KEY")
    weather_api_base_url: str = Field(
        default="http://api.weatherapi.com/v1/current.json",
        alias="WEATHER_API_BASE_URL",
    )
    allowed_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:4173",
            "http://127.0.0.1:4173",
        ]
    )
    grid_ml_root: Path = GRID_ML_DIR

    model_config = SettingsConfigDict(
        env_file=str(ROOT_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    @property
    def models_dir(self) -> Path:
        return self.grid_ml_root / "models"

    @property
    def outputs_dir(self) -> Path:
        return self.grid_ml_root / "outputs" / "reports"


@lru_cache
def get_settings() -> Settings:
    return Settings()
