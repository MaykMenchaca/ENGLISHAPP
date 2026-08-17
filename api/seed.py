"""Carga las 120 palabras en la base de datos.

Lee los archivos Vocabulario-Semana-N.txt que ya existen en la carpeta padre,
con el formato:  term | Español. — English example sentence.

Es idempotente: si una palabra ya existe, la actualiza en vez de duplicarla.
Se corre una sola vez (o cuando cambie el vocabulario):

    python api/seed.py
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))

try:
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
except ImportError:
    pass

from db import Word, get_session, init_db  # noqa: E402

# Los .txt viven en la carpeta que contiene al proyecto (MCP NOTEBOOK LM/)
SOURCE_DIR = ROOT.parent
PATTERN = "Vocabulario-Semana-*.txt"


def parse_line(line: str):
    if "|" not in line or "—" not in line:
        return None
    term, rest = line.split("|", 1)
    spanish, sentence = rest.split("—", 1)
    return term.strip(), spanish.strip(), sentence.strip()


def main():
    files = sorted(SOURCE_DIR.glob(PATTERN))
    if not files:
        print(f"No se encontraron archivos {PATTERN} en {SOURCE_DIR}")
        return 1

    init_db()
    session = get_session()
    created = updated = skipped = 0

    try:
        for path in files:
            match = re.search(r"Semana-(\d)", path.name)
            if not match:
                continue
            week = int(match.group(1))

            for raw in path.read_text(encoding="utf-8").splitlines():
                raw = raw.strip()
                if not raw:
                    continue
                parsed = parse_line(raw)
                if parsed is None:
                    skipped += 1
                    print(f"  linea ignorada en {path.name}: {raw[:50]}")
                    continue

                term, spanish, sentence = parsed
                existing = session.query(Word).filter_by(term=term).one_or_none()
                if existing:
                    existing.week = week
                    existing.spanish = spanish
                    existing.sentence = sentence
                    updated += 1
                else:
                    session.add(Word(week=week, term=term, spanish=spanish, sentence=sentence))
                    created += 1

            print(f"{path.name}: procesado")

        session.commit()
        total = session.query(Word).count()
        print(f"\nNuevas: {created}   Actualizadas: {updated}   Ignoradas: {skipped}")
        print(f"Total de palabras en la base de datos: {total}")
        return 0
    finally:
        session.close()


if __name__ == "__main__":
    raise SystemExit(main())
