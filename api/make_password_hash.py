"""Genera el hash de una contraseña nueva, para rotarla sin que pase por ningún chat.

    python api/make_password_hash.py

Pide la contraseña sin mostrarla en pantalla e imprime la línea lista para pegar en
`.env` y en las variables de entorno de Vercel. La contraseña en texto plano nunca se
guarda en ningún archivo.
"""
import getpass
import secrets
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from auth import hash_password  # noqa: E402


def main():
    print("Rotación de contraseña — no se escribe en pantalla ni se guarda en disco.\n")

    password = getpass.getpass("Contraseña nueva: ")
    if len(password) < 12:
        print("\nDemasiado corta: usa al menos 12 caracteres.")
        return 1

    if password != getpass.getpass("Repítela: "):
        print("\nNo coinciden.")
        return 1

    print("\nPega estas líneas en tutor-ingles/.env y en las variables de Vercel:\n")
    print(f"AUTH_PASSWORD_HASH={hash_password(password)}")
    print()
    print("Si además quieres cerrar todas las sesiones abiertas, cambia también:")
    print(f"SESSION_SECRET={secrets.token_urlsafe(32)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
