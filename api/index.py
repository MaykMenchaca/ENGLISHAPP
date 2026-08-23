"""Tutor de inglés — API FastAPI.

Entrypoint tanto para uvicorn en local como para la función serverless de Vercel.
"""
import os
import re
import unicodedata
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Cookie, Depends, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import func, select

# Carga .env en desarrollo local. En Vercel las variables ya vienen del entorno.
try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass

try:  # ejecutado como paquete (uvicorn api.index:app)
    from .db import (
        TRACK_ACADEMIC,
        TRACK_BASIC,
        TRACK_ENGINEERING,
        Attempt,
        DictionaryEntry,
        Word,
        get_session,
        init_db,
    )
    from .providers import (
        DEFAULT_PROVIDER,
        PROVIDERS,
        ProviderError,
        call_llm,
        configured_providers,
        extract_json,
    )
    from .auth import (
        COOKIE_NAME,
        SESSION_MAX_AGE,
        auth_configured,
        check_credentials,
        cookie_is_secure,
        create_session_token,
        require_auth,
        verify_session_token,
    )
except ImportError:  # ejecutado como script suelto (Vercel)
    from db import (
        TRACK_ACADEMIC,
        TRACK_BASIC,
        TRACK_ENGINEERING,
        Attempt,
        DictionaryEntry,
        Word,
        get_session,
        init_db,
    )
    from providers import (
        DEFAULT_PROVIDER,
        PROVIDERS,
        ProviderError,
        call_llm,
        configured_providers,
        extract_json,
    )
    from auth import (
        COOKIE_NAME,
        SESSION_MAX_AGE,
        auth_configured,
        check_credentials,
        cookie_is_secure,
        create_session_token,
        require_auth,
        verify_session_token,
    )

app = FastAPI(title="Tutor de inglés")

# Dos routers: lo público (login, salud) y lo protegido. La dependencia se aplica a
# nivel de router, no ruta por ruta, para que una ruta nueva no nazca desprotegida.
public_router = APIRouter()
router = APIRouter(dependencies=[Depends(require_auth)])

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
    # Necesario para que el navegador mande la cookie de sesión en desarrollo,
    # donde el frontend (5173) y la API (8000) son orígenes distintos.
    allow_credentials=True,
)

SYSTEM_PROMPT = (
    "Eres un tutor de inglés para un estudiante hispanohablante mexicano, ingeniero "
    "industrial, que se prepara para el TOEFL iBT y está en nivel principiante-intermedio.\n"
    "Reglas que nunca rompes:\n"
    "1. Explicas SIEMPRE en español, aunque el estudiante escriba en inglés.\n"
    "2. Aceptas paráfrasis y sinónimos: si entendió la idea, es correcto. No exiges "
    "la traducción literal del diccionario.\n"
    "3. En 'completion' aceptas variaciones menores de forma (plural, conjugación) "
    "si la palabra es la correcta.\n"
    "4. Eres breve: máximo 2 o 3 frases de feedback.\n"
    "5. Nunca eres punitivo. Si se equivoca, explicas la diferencia con un ejemplo corto.\n"
    "6. Devuelves EXCLUSIVAMENTE un objeto JSON, sin texto adicional ni markdown."
)


class EvaluateRequest(BaseModel):
    word_id: int
    mode: str = Field(pattern="^(meaning|completion)$")
    user_answer: str
    # "choice" se resuelve aquí mismo comparando contra la respuesta conocida:
    # instantáneo, sin gastar cuota y sin depender de que el LLM esté arriba.
    format: str = Field(default="text", pattern="^(text|choice)$")
    # Si no se manda, call_llm() cae en PROVIDER (env). Nunca es la clave en sí,
    # solo el nombre del proveedor — la clave nunca sale del servidor.
    # Validado aquí (422 si no es uno de estos) para no gastar un round-trip
    # al proveedor con un nombre que sabemos que va a fallar.
    provider: Optional[str] = Field(default=None, pattern="^(gemini|claude|anthropic|deepseek)$")


def _normalize(value: str) -> str:
    """Para comparar opciones: sin mayúsculas, acentos ni puntuación de sobra."""
    lowered = unicodedata.normalize("NFD", value.strip().lower())
    stripped = "".join(c for c in lowered if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9\s]", "", stripped).strip()


class FreePracticeRequest(BaseModel):
    word_ids: List[int] = []
    user_answer: str
    provider: Optional[str] = Field(default=None, pattern="^(gemini|claude|anthropic|deepseek)$")


@app.on_event("startup")
def _startup():
    # Crea las tablas si no existen. Es idempotente.
    try:
        init_db()
    except Exception as exc:  # noqa: BLE001 - no queremos tumbar el arranque en frío
        print(f"[startup] No se pudo inicializar la DB: {exc}")


# ---------------------------------------------------------------- rutas públicas


class LoginRequest(BaseModel):
    username: str
    password: str


@public_router.get("/health")
def health():
    # Diagnóstico TEMPORAL del despliegue: solo dice qué nombres de variable
    # llegaron al servidor, nunca su contenido. Quitar cuando la app funcione.
    expected = (
        "POSTGRES_URL",
        "PROVIDER",
        "GEMINI_API_KEY",
        "DEEPSEEK_API_KEY",
        "ANTHROPIC_API_KEY",
        "AUTH_USERNAME",
        "AUTH_PASSWORD_HASH",
        "SESSION_SECRET",
    )
    # Las que inyecta Vercel sola: si estas tampoco llegan, el problema no son
    # nuestras variables sino cómo se está ejecutando la función.
    de_vercel = ("VERCEL", "VERCEL_ENV", "VERCEL_REGION", "VERCEL_URL")
    return {
        "ok": True,
        "auth_configured": auth_configured(),
        "env_presentes": sorted(k for k in expected if os.environ.get(k)),
        "env_faltantes": sorted(k for k in expected if not os.environ.get(k)),
        # Distingue "la clave existe pero viene vacía" de "la clave no llegó".
        "claves_definidas": sorted(k for k in expected if k in os.environ),
        "vercel_env": {k: os.environ.get(k) for k in de_vercel},
        "total_variables": len(os.environ),
    }


@public_router.get("/me")
def me(tutor_session: Optional[str] = Cookie(default=None)):
    """El frontend pregunta esto al cargar para saber si mostrar el login."""
    username = verify_session_token(tutor_session or "") if auth_configured() else None
    return {"authenticated": bool(username), "username": username}


@public_router.post("/login")
def login(payload: LoginRequest, response: Response):
    if not auth_configured():
        raise HTTPException(
            status_code=503,
            detail="La autenticación no está configurada en el servidor.",
        )

    if not check_credentials(payload.username, payload.password):
        # Mismo mensaje para usuario y contraseña incorrectos: decir cuál de los dos
        # falló le confirmaría a un atacante que el usuario existe.
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos.")

    response.set_cookie(
        key=COOKIE_NAME,
        value=create_session_token(payload.username.strip()),
        max_age=SESSION_MAX_AGE,
        httponly=True,  # el JavaScript de la página no puede leerla
        samesite="lax",  # un POST desde otro sitio no la envía (CSRF)
        secure=cookie_is_secure(),
        path="/",
    )
    return {"ok": True, "username": payload.username.strip()}


@public_router.post("/logout")
def logout(response: Response):
    response.delete_cookie(key=COOKIE_NAME, path="/")
    return {"ok": True}


# ---------------------------------------------------------------- rutas protegidas


@router.get("/providers")
def providers():
    """Qué motores de IA puede ofrecer el selector del frontend. Solo booleanos:
    la existencia de la clave nunca implica exponer su valor."""
    available = configured_providers()
    return {
        "default": DEFAULT_PROVIDER if available.get(DEFAULT_PROVIDER) else None,
        "options": [p for p in PROVIDERS if available.get(p)],
    }


@router.get("/lessons")
def lessons(track: str = TRACK_ENGINEERING):
    session = get_session()
    try:
        rows = (
            session.execute(
                select(Word).where(Word.track == track).order_by(Word.week, Word.id)
            )
            .scalars()
            .all()
        )
        weeks = {}
        names = {}
        for word in rows:
            weeks.setdefault(word.week, []).append(word.as_dict())
            names[word.week] = word.section_name
        return {
            "track": track,
            "weeks": [
                {
                    "week": w,
                    "section_name": names.get(w, f"Sección {w}"),
                    "count": len(words),
                    "words": words,
                }
                for w, words in sorted(weeks.items())
            ],
        }
    finally:
        session.close()


@router.get("/progress")
def progress(week: Optional[int] = None, track: str = TRACK_ENGINEERING):
    """Aciertos y fallos por palabra, para priorizar lo que peor domina."""
    session = get_session()
    try:
        query = select(Word).where(Word.track == track)
        if week is not None:
            query = query.where(Word.week == week)
        words = session.execute(query.order_by(Word.id)).scalars().all()

        stats = dict(
            session.execute(
                select(
                    Attempt.word_id,
                    func.count(Attempt.id),
                ).group_by(Attempt.word_id)
            ).all()
        )
        correct_stats = dict(
            session.execute(
                select(
                    Attempt.word_id,
                    func.count(Attempt.id),
                )
                .where(Attempt.correct.is_(True))
                .group_by(Attempt.word_id)
            ).all()
        )

        items = []
        for word in words:
            total = stats.get(word.id, 0)
            ok = correct_stats.get(word.id, 0)
            items.append(
                {
                    **word.as_dict(),
                    "attempts": total,
                    "correct": ok,
                    "accuracy": round(ok / total, 2) if total else None,
                }
            )
        return {"items": items}
    finally:
        session.close()


TRACK_LABELS = {
    TRACK_ENGINEERING: "Ingeniería",
    TRACK_BASIC: "Inglés básico",
    TRACK_ACADEMIC: "Académico",
}


@router.get("/stats")
def stats():
    """Resumen de avance por pista y por sección, para la pantalla de progreso.

    Una palabra cuenta como "practicada" en cuanto tiene al menos un intento;
    la precisión se calcula sobre intentos, no sobre palabras.
    """
    session = get_session()
    try:
        # Un solo recorrido: agregamos intentos por palabra y los sumamos por sección.
        per_word = dict(
            session.execute(
                select(Attempt.word_id, func.count(Attempt.id))
                .where(Attempt.word_id.isnot(None))
                .group_by(Attempt.word_id)
            ).all()
        )
        per_word_ok = dict(
            session.execute(
                select(Attempt.word_id, func.count(Attempt.id))
                .where(Attempt.word_id.isnot(None), Attempt.correct.is_(True))
                .group_by(Attempt.word_id)
            ).all()
        )

        words = session.execute(select(Word).order_by(Word.track, Word.week, Word.id)).scalars().all()

        buckets = {}
        for word in words:
            track = buckets.setdefault(
                word.track, {"sections": {}, "total": 0, "practiced": 0, "attempts": 0, "correct": 0}
            )
            section = track["sections"].setdefault(
                word.week,
                {
                    "week": word.week,
                    "section_name": word.section_name,
                    "total": 0,
                    "practiced": 0,
                    "attempts": 0,
                    "correct": 0,
                },
            )

            attempts = per_word.get(word.id, 0)
            correct = per_word_ok.get(word.id, 0)

            for target in (track, section):
                target["total"] += 1
                target["attempts"] += attempts
                target["correct"] += correct
                if attempts:
                    target["practiced"] += 1

        def with_rates(d):
            return {
                **d,
                "coverage": round(d["practiced"] / d["total"], 4) if d["total"] else 0,
                "accuracy": round(d["correct"] / d["attempts"], 4) if d["attempts"] else None,
            }

        out = []
        for track_key in (TRACK_ENGINEERING, TRACK_BASIC, TRACK_ACADEMIC):
            data = buckets.get(track_key)
            if not data:
                continue
            sections = [with_rates(s) for s in data["sections"].values()]
            summary = with_rates({k: v for k, v in data.items() if k != "sections"})
            out.append({"track": track_key, "label": TRACK_LABELS[track_key], **summary, "sections": sections})

        return {"tracks": out}
    finally:
        session.close()


@router.post("/evaluate")
def evaluate(payload: EvaluateRequest):
    session = get_session()
    try:
        word = session.get(Word, payload.word_id)
        if word is None:
            raise HTTPException(status_code=404, detail="Palabra no encontrada")

        answer = payload.user_answer.strip()
        if not answer:
            raise HTTPException(status_code=400, detail="La respuesta está vacía")

        # --- Opción múltiple: se resuelve sin LLM ---
        if payload.format == "choice":
            expected = word.spanish if payload.mode == "meaning" else word.term
            correct = _normalize(answer) == _normalize(expected)

            if correct:
                feedback = f"Correcto. «{word.term}» = {word.spanish.rstrip('.')}."
            else:
                feedback = (
                    f"La correcta era «{expected.rstrip('.')}». "
                    f"Recuerda: {word.term} = {word.spanish.rstrip('.')}."
                )
            feedback += f" Ejemplo: {word.sentence}"

            session.add(
                Attempt(
                    word_id=word.id,
                    mode=payload.mode,
                    user_answer=answer,
                    correct=correct,
                    feedback=feedback,
                )
            )
            session.commit()
            return {
                "correct": correct,
                "feedback": feedback,
                "term": word.term,
                "sentence_es": word.sentence_es,
            }

        # --- Texto libre: aquí sí evalúa el LLM ---
        if payload.mode == "meaning":
            user_prompt = (
                f'Palabra en inglés: "{word.term}"\n'
                f'Significado de referencia: "{word.spanish}"\n'
                f'El estudiante respondió: "{answer}"\n\n'
                "¿Su respuesta demuestra que entiende la palabra? Responde con este JSON:\n"
                '{"correct": true|false, "feedback": "explicación breve en español"}'
            )
        else:
            user_prompt = (
                f'Oración: "{word.sentence}"\n'
                f'La palabra que faltaba era: "{word.term}"\n'
                f'El estudiante escribió: "{answer}"\n\n'
                "¿Escribió la palabra correcta? Acepta variaciones de forma "
                "(plural, conjugación). Responde con este JSON:\n"
                '{"correct": true|false, "feedback": "explicación breve en español"}'
            )

        try:
            raw = call_llm(SYSTEM_PROMPT, user_prompt, provider=payload.provider)
            parsed = extract_json(raw)
        except ProviderError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

        correct = bool(parsed.get("correct", False))
        feedback = str(parsed.get("feedback", "")).strip() or "Sin comentarios."

        session.add(
            Attempt(
                word_id=word.id,
                mode=payload.mode,
                user_answer=answer,
                correct=correct,
                feedback=feedback,
            )
        )
        session.commit()

        return {
            "correct": correct,
            "feedback": feedback,
            "term": word.term,
            "sentence_es": word.sentence_es,
        }
    finally:
        session.close()


@router.post("/free-practice")
def free_practice(payload: FreePracticeRequest):
    session = get_session()
    try:
        answer = payload.user_answer.strip()
        if not answer:
            raise HTTPException(status_code=400, detail="El texto está vacío")

        terms = []
        if payload.word_ids:
            terms = [
                w.term
                for w in session.execute(
                    select(Word).where(Word.id.in_(payload.word_ids))
                ).scalars()
            ]

        user_prompt = (
            f'El estudiante escribió este texto en inglés:\n"{answer}"\n\n'
            + (f"Debía usar estas palabras: {', '.join(terms)}\n\n" if terms else "")
            + "Corrígelo. Responde con este JSON:\n"
            '{"correct": true|false, "corrected": "el texto corregido en inglés", '
            '"feedback": "explicación en español de los 1-3 errores más importantes"}'
        )

        try:
            raw = call_llm(SYSTEM_PROMPT, user_prompt, provider=payload.provider)
            parsed = extract_json(raw)
        except ProviderError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

        corrected = str(parsed.get("corrected", "")).strip()
        feedback = str(parsed.get("feedback", "")).strip() or "Sin comentarios."
        correct = bool(parsed.get("correct", False))

        session.add(
            Attempt(
                word_id=None,
                mode="free_practice",
                user_answer=answer,
                correct=correct,
                feedback=feedback,
            )
        )
        session.commit()

        return {"correct": correct, "corrected": corrected, "feedback": feedback}
    finally:
        session.close()


# ---------------------------------------------------------------- diccionario personal


class DictionaryRequest(BaseModel):
    term: str
    meaning: str
    notes: Optional[str] = None


@router.get("/dictionary")
def dictionary_list():
    session = get_session()
    try:
        rows = (
            session.execute(select(DictionaryEntry).order_by(DictionaryEntry.id.desc()))
            .scalars()
            .all()
        )
        return {"items": [e.as_dict() for e in rows]}
    finally:
        session.close()


@router.post("/dictionary")
def dictionary_add(payload: DictionaryRequest):
    term = payload.term.strip()
    meaning = payload.meaning.strip()
    if not term or not meaning:
        raise HTTPException(status_code=400, detail="La palabra y su significado son obligatorios")

    session = get_session()
    try:
        entry = DictionaryEntry(
            term=term,
            meaning=meaning,
            notes=(payload.notes or "").strip() or None,
        )
        session.add(entry)
        session.commit()
        return entry.as_dict()
    finally:
        session.close()


@router.delete("/dictionary/{entry_id}")
def dictionary_delete(entry_id: int):
    session = get_session()
    try:
        entry = session.get(DictionaryEntry, entry_id)
        if entry is None:
            raise HTTPException(status_code=404, detail="Entrada no encontrada")
        session.delete(entry)
        session.commit()
        return {"deleted": entry_id}
    finally:
        session.close()


# El runtime de Python en Vercel puede entregar la ruta con o sin el prefijo /api
# segun como resuelva el rewrite. Montar el router dos veces hace que ambas
# funcionen y evita 404 solo en produccion.
app.include_router(public_router, prefix="/api")
app.include_router(public_router)
app.include_router(router, prefix="/api")
app.include_router(router)
