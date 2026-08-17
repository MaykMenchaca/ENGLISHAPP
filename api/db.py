"""Modelos y conexión a Postgres."""
import os

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
    func,
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

Base = declarative_base()


class Word(Base):
    __tablename__ = "words"

    id = Column(Integer, primary_key=True)
    week = Column(Integer, nullable=False, index=True)
    term = Column(String(120), nullable=False, unique=True)
    spanish = Column(String(255), nullable=False)
    sentence = Column(Text, nullable=False)

    attempts = relationship("Attempt", back_populates="word", cascade="all, delete-orphan")

    def as_dict(self):
        return {
            "id": self.id,
            "week": self.week,
            "term": self.term,
            "spanish": self.spanish,
            "sentence": self.sentence,
        }


class Attempt(Base):
    __tablename__ = "attempts"

    id = Column(Integer, primary_key=True)
    # free_practice no apunta a una palabra concreta, por eso es nullable
    word_id = Column(Integer, ForeignKey("words.id", ondelete="CASCADE"), nullable=True, index=True)
    mode = Column(String(20), nullable=False)  # meaning | completion | free_practice
    user_answer = Column(Text, nullable=False)
    correct = Column(Boolean, nullable=False, default=False)
    feedback = Column(Text, nullable=False, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    word = relationship("Word", back_populates="attempts")


def _normalize_url(url: str) -> str:
    """Vercel entrega postgres://; SQLAlchemy 2 espera postgresql://."""
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    if url.startswith("postgresql://") and "+psycopg2" not in url:
        url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return url


def get_database_url() -> str:
    for key in ("POSTGRES_URL", "DATABASE_URL", "POSTGRES_PRISMA_URL"):
        value = os.environ.get(key)
        if value:
            return _normalize_url(value)
    raise RuntimeError(
        "Falta la variable de entorno POSTGRES_URL. "
        "Cópiala del dashboard de Vercel (Storage -> tu base de datos -> .env.local) "
        "y ponla en tutor-ingles/.env"
    )


_engine = None
_SessionLocal = None


def get_engine():
    """Engine perezoso: en serverless conviene crearlo al primer uso, no al importar."""
    global _engine
    if _engine is None:
        _engine = create_engine(
            get_database_url(),
            pool_pre_ping=True,  # evita conexiones muertas entre invocaciones serverless
            pool_size=1,
            max_overflow=2,
        )
    return _engine


def get_session():
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)
    return _SessionLocal()


def init_db():
    Base.metadata.create_all(get_engine())
