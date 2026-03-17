from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import get_settings


settings = get_settings()

FALLBACK_DATABASE_URL = "sqlite:///./grid.fallback.db"


def _build_engine(database_url: str):
    engine_kwargs = {"future": True, "pool_pre_ping": True}
    if database_url.startswith("sqlite"):
        engine_kwargs["connect_args"] = {"check_same_thread": False}
    return create_engine(database_url, **engine_kwargs)


ACTIVE_DATABASE_URL = settings.database_url
engine = _build_engine(ACTIVE_DATABASE_URL)

if not ACTIVE_DATABASE_URL.startswith("sqlite"):
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except OperationalError:
        print(
            f"[Database] Unable to connect to {ACTIVE_DATABASE_URL}. "
            f"Falling back to {FALLBACK_DATABASE_URL}."
        )
        ACTIVE_DATABASE_URL = FALLBACK_DATABASE_URL
        engine = _build_engine(ACTIVE_DATABASE_URL)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
