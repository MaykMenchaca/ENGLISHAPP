"""Abstracción de proveedor de IA.

Gemini y Claude exponen el mismo contrato: reciben (system, user) y devuelven texto.
Cambiar de proveedor es cambiar la variable PROVIDER, no tocar código.
"""
import json
import os
import re
import time
import urllib.error
import urllib.request

# Cadena de respaldo: si el primero está saturado (503) o lo retiraron (404),
# se intenta el siguiente. Medido con el prompt real de práctica libre:
# gemini-2.5-flash 3/3 en 1.2s; gemini-flash-latest 2/3 en 9.7s.
# El alias "latest" queda de red de seguridad para cuando retiren el fijo.
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_FALLBACKS = ["gemini-flash-latest", "gemini-3.1-flash-lite"]
CLAUDE_MODEL = os.environ.get("CLAUDE_MODEL", "claude-haiku-4-5-20251001")
# deepseek-chat (no razona) responde rápido y barato. deepseek-reasoner existe
# pero repetiría el problema que ya tuvimos con Gemini: gasta el presupuesto
# pensando y el JSON llega cortado. No usarlo aquí.
DEEPSEEK_MODEL = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")
TIMEOUT = 30

PROVIDERS = ("gemini", "claude", "deepseek")
DEFAULT_PROVIDER = os.environ.get("PROVIDER", "gemini").strip().lower()

# Errores pasajeros del proveedor: saturación, límite de tasa, fallo interno.
# Reintentar tiene sentido; con un 400 o 401 no.
RETRYABLE = {429, 500, 502, 503, 504}
MAX_ATTEMPTS = 3

# Medido: la corrección de texto libre usa ~105 tokens de salida con el razonamiento
# desactivado; 512 deja 5x de margen para textos más largos del estudiante.
# Pedir mucho más no es gratis: el tier gratuito de Gemini limita TOKENS por minuto,
# así que un presupuesto inflado agota la cuota aunque no se llegue a usar.
MAX_TOKENS = 512


class ProviderError(RuntimeError):
    pass


def _post_json(url: str, payload: dict, headers: dict) -> dict:
    data = json.dumps(payload).encode("utf-8")
    last_error = None

    for attempt in range(MAX_ATTEMPTS):
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:400]
            last_error = ProviderError(f"HTTP {exc.code}: {detail}")
            if exc.code not in RETRYABLE:
                raise last_error from exc
        except urllib.error.URLError as exc:
            last_error = ProviderError(f"No se pudo conectar con el proveedor: {exc.reason}")

        if attempt < MAX_ATTEMPTS - 1:
            time.sleep(1.5 * (2**attempt))  # 1.5s, luego 3s

    raise last_error


def call_gemini(system: str, user: str) -> str:
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise ProviderError("Falta GEMINI_API_KEY en las variables de entorno.")

    payload = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": MAX_TOKENS,
            # Sin esto los modelos nuevos gastan el presupuesto razonando y el JSON
            # llega cortado a media frase. Para corregir texto no hace falta.
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }
    headers = {"Content-Type": "application/json", "x-goog-api-key": key}

    # Modelos a intentar, sin repetir si el usuario fijó uno que ya está en la lista
    candidates = [GEMINI_MODEL] + [m for m in GEMINI_FALLBACKS if m != GEMINI_MODEL]
    last_error = None

    for model in candidates:
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{model}:generateContent"
        )
        try:
            body = _post_json(url, payload, headers)
        except ProviderError as exc:
            last_error = exc
            continue  # saturado o retirado: probamos el siguiente

        try:
            return body["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError) as exc:
            last_error = ProviderError(
                f"Respuesta inesperada de Gemini ({model}): {json.dumps(body)[:300]}"
            )
            continue

    raise last_error


def call_claude(system: str, user: str) -> str:
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise ProviderError("Falta ANTHROPIC_API_KEY en las variables de entorno.")

    payload = {
        "model": CLAUDE_MODEL,
        "max_tokens": MAX_TOKENS,
        "temperature": 0.2,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }
    body = _post_json(
        "https://api.anthropic.com/v1/messages",
        payload,
        {
            "Content-Type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
        },
    )

    try:
        return body["content"][0]["text"]
    except (KeyError, IndexError) as exc:
        raise ProviderError(f"Respuesta inesperada de Claude: {json.dumps(body)[:300]}") from exc


def call_deepseek(system: str, user: str) -> str:
    key = os.environ.get("DEEPSEEK_API_KEY")
    if not key:
        raise ProviderError("Falta DEEPSEEK_API_KEY en las variables de entorno.")

    payload = {
        "model": DEEPSEEK_MODEL,
        "temperature": 0.2,
        "max_tokens": MAX_TOKENS,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        # API compatible con OpenAI: esto obliga la salida a ser JSON válido,
        # así que aquí nos ahorramos el baile de vallas de código de extract_json.
        "response_format": {"type": "json_object"},
    }
    body = _post_json(
        "https://api.deepseek.com/chat/completions",
        payload,
        {"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
    )

    try:
        return body["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as exc:
        raise ProviderError(f"Respuesta inesperada de DeepSeek: {json.dumps(body)[:300]}") from exc


def call_llm(system: str, user: str, provider: str | None = None) -> str:
    """provider, si se da, gana sobre PROVIDER (env). Así el frontend puede
    elegir el motor por petición sin tener que redesplegar nada."""
    provider = (provider or DEFAULT_PROVIDER).strip().lower()
    if provider == "gemini":
        return call_gemini(system, user)
    if provider in ("claude", "anthropic"):
        return call_claude(system, user)
    if provider == "deepseek":
        return call_deepseek(system, user)
    raise ProviderError(f"Proveedor desconocido: {provider!r}. Usa gemini, claude o deepseek.")


def configured_providers() -> dict:
    """Qué proveedores tienen clave puesta, sin revelar el valor de la clave."""
    return {
        "gemini": bool(os.environ.get("GEMINI_API_KEY")),
        "claude": bool(os.environ.get("ANTHROPIC_API_KEY")),
        "deepseek": bool(os.environ.get("DEEPSEEK_API_KEY")),
    }


def extract_json(raw: str) -> dict:
    """Los modelos a veces envuelven el JSON en ```json ... ``` o texto suelto."""
    text = raw.strip()

    # Quitamos la valla de apertura y la de cierre por separado: si la respuesta
    # llegó cortada, la de cierre puede no existir y exigir ambas fallaría.
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text).strip()

    # Del primer { al último }, por si sobra texto alrededor.
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        text = text[start : end + 1]

    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        # El mensaje incluye bastante contexto: recortar demasiado esconde si el
        # problema fue truncamiento o formato.
        raise ProviderError(
            f"El modelo no devolvió JSON válido (largo {len(raw)}): {raw[:600]}"
        ) from exc
