"""Carga el vocabulario en la base de datos.

Tres orígenes:
  - Ingeniería (semanas 1-4): los Vocabulario-Semana-N.txt de la carpeta padre, con
    formato `term | Español. — English example sentence.` La traducción de cada oración
    se cruza desde Traducciones-de-apoyo.txt (ya existía, no se reescribe).
  - Ingeniería / equipos de planta (semanas 5-10): api/data/equipment_part*.json.
  - Básico: api/data/basic_part*.json.
  Los dos últimos usan el mismo formato JSON y ya traen la traducción incluida, así que
  comparten la misma función de carga — solo cambia a qué track van.

Uso:
    python api/seed.py            # inserta/actualiza sin tocar el resto
    python api/seed.py --reset    # borra y recrea las tablas (pierde los intentos)
"""
import argparse
import json
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

from db import (  # noqa: E402
    TRACK_ACADEMIC,
    TRACK_BASIC,
    TRACK_ENGINEERING,
    Word,
    get_session,
    init_db,
    reset_db,
)

# Los .txt de ingeniería viven en la carpeta que contiene al proyecto
SOURCE_DIR = ROOT.parent
ENGINEERING_GLOB = "Vocabulario-Semana-*.txt"
TRANSLATIONS_FILE = SOURCE_DIR / "Traducciones-de-apoyo.txt"
BASIC_GLOB = "basic_part*.json"
EQUIPMENT_GLOB = "equipment_part*.json"
ACADEMIC_GLOB = "academic_part*.json"

ENGINEERING_SECTIONS = {
    1: "Cimientos",
    2: "Procesos y calidad",
    3: "Datos y conectores",
    4: "Gestión y abstractos",
}


def parse_line(line: str):
    if "|" not in line or "—" not in line:
        return None
    term, rest = line.split("|", 1)
    spanish, sentence = rest.split("—", 1)
    return term.strip(), spanish.strip(), sentence.strip()


def load_translations() -> dict:
    """Traducciones-de-apoyo.txt: cada oración en inglés seguida de su línea indentada
    en español. Devuelve {oración_en: oración_es}."""
    if not TRANSLATIONS_FILE.exists():
        print(f"  aviso: no se encontró {TRANSLATIONS_FILE.name}")
        return {}

    lines = TRANSLATIONS_FILE.read_text(encoding="utf-8").splitlines()
    out = {}
    for i, line in enumerate(lines):
        if not line or line.startswith(" ") or not line.endswith("."):
            continue
        if i + 1 < len(lines) and lines[i + 1].startswith("   "):
            out[line.strip()] = lines[i + 1].strip()
    return out


def upsert(session, track, week, section_name, term, spanish, sentence, sentence_es):
    existing = session.query(Word).filter_by(track=track, term=term).one_or_none()
    if existing:
        existing.week = week
        existing.section_name = section_name
        existing.spanish = spanish
        existing.sentence = sentence
        existing.sentence_es = sentence_es
        return False
    session.add(
        Word(
            track=track,
            week=week,
            section_name=section_name,
            term=term,
            spanish=spanish,
            sentence=sentence,
            sentence_es=sentence_es,
        )
    )
    return True


def seed_engineering(session):
    files = sorted(SOURCE_DIR.glob(ENGINEERING_GLOB))
    if not files:
        print(f"  no se encontraron archivos {ENGINEERING_GLOB} en {SOURCE_DIR}")
        return 0, 0, []

    translations = load_translations()
    created = updated = 0
    missing = []

    for path in files:
        match = re.search(r"Semana-(\d)", path.name)
        if not match:
            continue
        week = int(match.group(1))
        section_name = ENGINEERING_SECTIONS.get(week, f"Semana {week}")

        for raw in path.read_text(encoding="utf-8").splitlines():
            raw = raw.strip()
            if not raw:
                continue
            parsed = parse_line(raw)
            if parsed is None:
                print(f"  linea ignorada en {path.name}: {raw[:50]}")
                continue

            term, spanish, sentence = parsed
            sentence_es = translations.get(sentence)
            if not sentence_es:
                missing.append((path.name, term, sentence))

            if upsert(session, TRACK_ENGINEERING, week, section_name, term, spanish, sentence, sentence_es):
                created += 1
            else:
                updated += 1

    return created, updated, missing


def seed_json_pack(session, glob_pattern: str, track: str):
    """Carga un paquete de JSON con el formato de basic_part*.json (semanas ya
    numeradas, traducción incluida) hacia el track que se le indique. Usado tanto
    para el vocabulario básico como para el de equipos de planta."""
    files = sorted((Path(__file__).resolve().parent / "data").glob(glob_pattern))
    if not files:
        print(f"  no se encontraron archivos {glob_pattern}")
        return 0, 0

    created = updated = 0
    for path in files:
        for section in json.loads(path.read_text(encoding="utf-8")):
            for w in section["words"]:
                if upsert(
                    session,
                    track,
                    section["week"],
                    section["section_name"],
                    w["term"],
                    w["spanish"],
                    w["sentence"],
                    w["sentence_es"],
                ):
                    created += 1
                else:
                    updated += 1
    return created, updated


def main():
    parser = argparse.ArgumentParser(description="Carga el vocabulario en la base de datos")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="borra y recrea las tablas (necesario si cambió el esquema)",
    )
    args = parser.parse_args()

    if args.reset:
        print("Recreando tablas (se pierden los intentos guardados)...")
        reset_db()
    else:
        init_db()

    session = get_session()
    try:
        print("\n== Ingeniería (TOEFL, semanas 1-4) ==")
        eng_created, eng_updated, missing = seed_engineering(session)
        print(f"  nuevas: {eng_created}   actualizadas: {eng_updated}")

        print("\n== Ingeniería (equipos de planta, semanas 5-10) ==")
        equip_created, equip_updated = seed_json_pack(session, EQUIPMENT_GLOB, TRACK_ENGINEERING)
        print(f"  nuevas: {equip_created}   actualizadas: {equip_updated}")

        print("\n== Básico ==")
        basic_created, basic_updated = seed_json_pack(session, BASIC_GLOB, TRACK_BASIC)
        print(f"  nuevas: {basic_created}   actualizadas: {basic_updated}")

        print("\n== Académico (AWL, phrasal verbs, colocaciones) ==")
        acad_created, acad_updated = seed_json_pack(session, ACADEMIC_GLOB, TRACK_ACADEMIC)
        print(f"  nuevas: {acad_created}   actualizadas: {acad_updated}")

        session.commit()

        total = session.query(Word).count()
        eng = session.query(Word).filter_by(track=TRACK_ENGINEERING).count()
        basic = session.query(Word).filter_by(track=TRACK_BASIC).count()
        acad = session.query(Word).filter_by(track=TRACK_ACADEMIC).count()
        print(
            f"\nTotal en la base de datos: {total}  "
            f"({eng} ingeniería + {basic} básico + {acad} académico)"
        )

        if missing:
            print(f"\nSIN traducción al español ({len(missing)}):")
            for fname, term, sentence in missing:
                print(f"  [{fname}] {term}: {sentence}")
            print("  -> revisa que la oración coincida exactamente en Traducciones-de-apoyo.txt")
        else:
            print("Todas las oraciones tienen traducción al español.")
        return 0
    finally:
        session.close()


if __name__ == "__main__":
    raise SystemExit(main())
