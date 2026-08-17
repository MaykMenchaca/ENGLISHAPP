"""Autenticación de un solo usuario.

Diseño:
  - La contraseña nunca se guarda: solo su hash scrypt (biblioteca estándar, sin
    dependencias nuevas).
  - La sesión es un token firmado con HMAC, sin estado en el servidor. En Vercel cada
    petición puede caer en una instancia distinta, así que guardar sesiones en memoria
    no funcionaría.
  - Todo falla cerrado: si falta configuración, se niega el acceso.
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time

from fastapi import Cookie, HTTPException

COOKIE_NAME = "tutor_session"
SESSION_MAX_AGE = 60 * 60 * 24  # 1 día

# Parámetros de scrypt. n=2^14 es el mínimo recomendado por OWASP para este uso;
# mantiene el login por debajo de ~100ms en el runtime de Vercel.
SCRYPT_N = 2**14
SCRYPT_R = 8
SCRYPT_P = 1
DKLEN = 32


def _b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _b64d(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


# ---------------------------------------------------------------- contraseña


def hash_password(password: str, salt: bytes | None = None) -> str:
    """Devuelve `scrypt$n$r$p$sal$hash`, listo para guardar en una variable de entorno."""
    salt = salt or secrets.token_bytes(16)
    dk = hashlib.scrypt(
        password.encode("utf-8"), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P, dklen=DKLEN
    )
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${_b64e(salt)}${_b64e(dk)}"


def verify_password(password: str, stored: str) -> bool:
    """Compara en tiempo constante: una comparación normal filtraría, por su duración,
    cuántos caracteres del hash coinciden."""
    try:
        algo, n, r, p, salt_b64, hash_b64 = stored.split("$")
        if algo != "scrypt":
            return False
        dk = hashlib.scrypt(
            password.encode("utf-8"),
            salt=_b64d(salt_b64),
            n=int(n),
            r=int(r),
            p=int(p),
            dklen=len(_b64d(hash_b64)),
        )
        return hmac.compare_digest(dk, _b64d(hash_b64))
    except (ValueError, TypeError):
        # Hash mal formado en el entorno: se trata como fallo, no como pase libre.
        return False


# ---------------------------------------------------------------- sesión


def _secret() -> bytes | None:
    value = os.environ.get("SESSION_SECRET")
    return value.encode("utf-8") if value else None


def create_session_token(username: str, max_age: int = SESSION_MAX_AGE) -> str:
    secret = _secret()
    if not secret:
        raise RuntimeError("Falta SESSION_SECRET")

    payload = _b64e(json.dumps({"u": username, "exp": int(time.time()) + max_age}).encode())
    signature = _b64e(hmac.new(secret, payload.encode(), hashlib.sha256).digest())
    return f"{payload}.{signature}"


def verify_session_token(token: str) -> str | None:
    """Devuelve el usuario si el token es válido y no expiró; si no, None."""
    secret = _secret()
    if not secret or not token or "." not in token:
        return None

    payload, _, signature = token.partition(".")
    expected = _b64e(hmac.new(secret, payload.encode(), hashlib.sha256).digest())
    if not hmac.compare_digest(signature, expected):
        return None  # firma inválida: token manipulado

    try:
        data = json.loads(_b64d(payload))
    except (ValueError, TypeError):
        return None

    if int(data.get("exp", 0)) < time.time():
        return None  # expirado
    return data.get("u")


# ---------------------------------------------------------------- configuración


def auth_configured() -> bool:
    return bool(
        os.environ.get("AUTH_USERNAME")
        and os.environ.get("AUTH_PASSWORD_HASH")
        and os.environ.get("SESSION_SECRET")
    )


def check_credentials(username: str, password: str) -> bool:
    if not auth_configured():
        return False
    expected_user = os.environ.get("AUTH_USERNAME", "")
    stored_hash = os.environ.get("AUTH_PASSWORD_HASH", "")

    # Se verifica la contraseña SIEMPRE, incluso si el usuario no coincide, para que el
    # tiempo de respuesta no revele si el nombre de usuario existe.
    user_ok = hmac.compare_digest(username.strip(), expected_user)
    password_ok = verify_password(password, stored_hash)
    return user_ok and password_ok


def cookie_is_secure() -> bool:
    """En Vercel siempre hay HTTPS; en local es http://localhost y una cookie `secure`
    no se enviaría, dejando el login inservible."""
    if os.environ.get("COOKIE_SECURE"):
        return os.environ["COOKIE_SECURE"].lower() in ("1", "true", "yes")
    return bool(os.environ.get("VERCEL"))


# ---------------------------------------------------------------- dependencia


def require_auth(tutor_session: str | None = Cookie(default=None)) -> str:
    """Dependencia de FastAPI. Se aplica a nivel de router para que ninguna ruta futura
    quede desprotegida por olvido."""
    if not auth_configured():
        # Configuración incompleta: se cierra la puerta, no se abre.
        raise HTTPException(
            status_code=401,
            detail="La autenticación no está configurada en el servidor.",
        )

    username = verify_session_token(tutor_session or "")
    if not username:
        raise HTTPException(status_code=401, detail="Necesitas iniciar sesión.")
    return username
