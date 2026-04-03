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
        default="postgresql+psycopg2://postgres:postgres@localhost:5432/grid",
        alias="DATABASE_URL",
    )
    weather_api_key: str = Field(default="", alias="WEATHER_API_KEY")
    weather_api_base_url: str = Field(
        default="http://api.weatherapi.com/v1/current.json",
        alias="WEATHER_API_BASE_URL",
    )
    # Comma-separated origins for production: e.g. "https://mygrid.netlify.app,https://api.mygrid.com"
    allowed_origins_extra: str = Field(default="", alias="ALLOWED_ORIGINS")
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

    def get_cors_origins(self) -> list[str]:
        base = list(self.allowed_origins)
        if self.allowed_origins_extra:
            extras = [o.strip() for o in self.allowed_origins_extra.split(",") if o.strip()]
            base.extend(extras)
        return base
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
