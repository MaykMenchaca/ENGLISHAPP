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
    UniqueConstraint,
    create_engine,
    func,
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

Base = declarative_base()

TRACK_ENGINEERING = "engineering"
TRACK_BASIC = "basic"


class Word(Base):
    __tablename__ = "words"
    # Unicidad por track, no global: varios conectores existen en los dos mundos
    # (p.ej. "also" académico vs cotidiano) y una restricción global rompería el seed.
    __table_args__ = (UniqueConstraint("track", "term", name="uq_word_track_term"),)

    id = Column(Integer, primary_key=True)
    track = Column(String(20), nullable=False, default=TRACK_ENGINEERING, index=True)
    week = Column(Integer, nullable=False, index=True)  # nº de sección dentro del track
    section_name = Column(String(80), nullable=False, default="")
    term = Column(String(120), nullable=False)
    spanish = Column(String(255), nullable=False)
    sentence = Column(Text, nullable=False)
    # Se muestra DESPUÉS de responder, para poder juzgar el resultado sin
    # regalar la respuesta durante el ejercicio.
    sentence_es = Column(Text, nullable=True)

    attempts = relationship("Attempt", back_populates="word", cascade="all, delete-orphan")

    def as_dict(self):
        return {
            "id": self.id,
            "track": self.track,
            "week": self.week,
            "section_name": self.section_name,
            "term": self.term,
            "spanish": self.spanish,
            "sentence": self.sentence,
            "sentence_es": self.sentence_es,
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


class DictionaryEntry(Base):
    """Libreta personal: palabras que el usuario encuentra por su cuenta."""

    __tablename__ = "dictionary_entries"

    id = Column(Integer, primary_key=True)
    term = Column(String(120), nullable=False)
    meaning = Column(Text, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def as_dict(self):
        return {
            "id": self.id,
            "term": self.term,
            "meaning": self.meaning,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


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


def reset_db():
    """Borra y recrea las tablas. create_all() no altera tablas existentes, así que
    cuando cambian columnas o constraints hay que pasar por aquí. Solo lo usa
    seed.py --reset; las palabras se regeneran, los intentos se pierden."""
    Base.metadata.drop_all(get_engine())
    Base.metadata.create_all(get_engine())
