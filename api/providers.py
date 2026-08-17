"""Abstracción de proveedor de IA.

Gemini y Claude exponen el mismo contrato: reciben (system, user) y devuelven texto.
Cambiar de proveedor es cambiar la variable PROVIDER, no tocar código.
"""
import json
import os
import re
import urllib.error
import urllib.request

GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
CLAUDE_MODEL = os.environ.get("CLAUDE_MODEL", "claude-haiku-4-5-20251001")
TIMEOUT = 30


class ProviderError(RuntimeError):
    pass


def _post_json(url: str, payload: dict, headers: dict) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:400]
        raise ProviderError(f"HTTP {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise ProviderError(f"No se pudo conectar con el proveedor: {exc.reason}") from exc


def call_gemini(system: str, user: str) -> str:
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise ProviderError("Falta GEMINI_API_KEY en las variables de entorno.")

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
    )
    payload = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 600},
    }
    body = _post_json(url, payload, {"Content-Type": "application/json", "x-goog-api-key": key})

    try:
        return body["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as exc:
        raise ProviderError(f"Respuesta inesperada de Gemini: {json.dumps(body)[:300]}") from exc


def call_claude(system: str, user: str) -> str:
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise ProviderError("Falta ANTHROPIC_API_KEY en las variables de entorno.")

    payload = {
        "model": CLAUDE_MODEL,
        "max_tokens": 600,
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


def call_llm(system: str, user: str) -> str:
    provider = os.environ.get("PROVIDER", "gemini").strip().lower()
    if provider == "gemini":
        return call_gemini(system, user)
    if provider in ("claude", "anthropic"):
        return call_claude(system, user)
    raise ProviderError(f"PROVIDER desconocido: {provider!r}. Usa 'gemini' o 'claude'.")


def extract_json(raw: str) -> dict:
    """Los modelos a veces envuelven el JSON en ```json ... ``` o texto suelto."""
    text = raw.strip()

    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.S)
    if fenced:
        text = fenced.group(1)
    else:
        braces = re.search(r"\{.*\}", text, re.S)
        if braces:
            text = braces.group(0)

    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise ProviderError(f"El modelo no devolvió JSON válido: {raw[:300]}") from exc
