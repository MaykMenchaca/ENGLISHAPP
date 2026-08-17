# Tutor de inglés

Web app para practicar vocabulario de inglés con feedback de IA **en español**.
Complementa el mazo de Anki: Anki fija las palabras, esto te hace producirlas y te corrige.

- **Frontend:** React + Vite
- **Backend:** FastAPI (Python)
- **Base de datos:** Postgres (Vercel Storage)
- **IA:** Gemini por defecto, intercambiable a Claude con una variable

## Cómo funciona

Eliges un bloque (semana 1-4). Cada sesión son 5 palabras, priorizando las que peor
dominas. De cada palabra:

1. **Significado** — ¿qué significa `bottleneck`? Escribes libremente, la IA acepta paráfrasis.
2. **Completar** — `The packaging station is the ______ of the line.` Escribes la palabra.

Al terminar las 5, escribes 2-3 frases usando todas, y la IA te devuelve el texto
corregido más una explicación en español.

Todo se guarda en Postgres, así que el progreso es el mismo en la compu y en el celular.

---

## Puesta en marcha

### 1. Crear la base de datos

En [vercel.com](https://vercel.com) → tu cuenta → pestaña **Storage** → **Create Database**
→ **Postgres** → dale un nombre (ej. `tutor-ingles-db`) → **Create**.

Ya creada, entra a la base de datos → pestaña **`.env.local`** → copia el valor de
`POSTGRES_URL`.

### 2. Configurar variables locales

```bash
cp .env.example .env
```

Abre `.env` y pega:

- `POSTGRES_URL` — el que acabas de copiar de Vercel
- `GEMINI_API_KEY` — sácala en [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (empieza con `AIzaSy...`)

> `.env` está en `.gitignore`. Nunca se sube a GitHub.

### 3. Instalar dependencias

```bash
pip install -r requirements.txt
cd frontend && npm install && cd ..
```

### 4. Cargar las 120 palabras

```bash
python api/seed.py
```

Lee los archivos `Vocabulario-Semana-*.txt` de la carpeta padre. Es idempotente:
si lo corres dos veces no duplica nada.

### 5. Correr en local

Dos terminales:

```bash
uvicorn api.index:app --reload --port 8000
```

```bash
cd frontend && npm run dev
```

Abre `http://localhost:5173`.

---

## Desplegar en Vercel

1. Sube el proyecto a un repositorio de GitHub (privado está bien).
2. En Vercel: **Add New** → **Project** → **Import Git Repository** → elige el repo.
3. En **Environment Variables** agrega:

   | Variable | Valor |
   |---|---|
   | `POSTGRES_URL` | se autocompleta si conectas la base de datos al proyecto |
   | `GEMINI_API_KEY` | tu clave de Google AI Studio |
   | `PROVIDER` | `gemini` |

4. **Deploy**.

Vercel lee `vercel.json`: compila el frontend a `frontend/dist` y publica `api/index.py`
como función serverless.

---

## Cambiar de Gemini a Claude

Cambia dos variables, sin tocar código:

```
PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-...
```

El modelo por defecto es `claude-haiku-4-5-20251001` (rápido y barato para llamadas
repetidas). Se puede cambiar con `CLAUDE_MODEL`.

---

## Estructura

```
api/
  index.py       rutas FastAPI (/lessons, /progress, /evaluate, /free-practice)
  db.py          modelos SQLAlchemy: Word, Attempt
  providers.py   call_gemini() / call_claude() con el mismo contrato
  seed.py        carga los .txt de vocabulario a la base de datos
frontend/
  src/App.jsx    orquesta la sesión: 5 palabras x 2 modos + práctica libre
  src/api.js     llamadas al backend
  src/components/
```

## Notas

- El router se monta con y sin el prefijo `/api` porque el runtime de Python en Vercel
  puede entregar la ruta de las dos formas. Evita 404 que solo aparecen en producción.
- `pool_pre_ping` está activo: en serverless las conexiones se mueren entre invocaciones.
- No hay autenticación. Es de un solo usuario. Si algún día lo compartes, hay que agregarla.
