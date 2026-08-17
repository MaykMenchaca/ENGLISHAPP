# Tutor de inglés

Web app para practicar vocabulario de inglés con feedback de IA **en español**.
Complementa el mazo de Anki: Anki fija las palabras, esto te hace producirlas y te corrige.

- **Frontend:** React + Vite
- **Backend:** FastAPI (Python)
- **Base de datos:** Postgres (Vercel Storage)
- **IA:** Gemini por defecto, intercambiable a Claude con una variable

## Cómo funciona

Dos pistas de vocabulario, en pestañas separadas:

- **Ingeniería** — 120 palabras en 4 bloques (TOEFL + ingeniería industrial)
- **Inglés básico** — 200 palabras en 10 secciones temáticas: saludos, despedidas,
  números y hora, comida, direcciones, compras, familia, verbos del día a día,
  adjetivos y conectores

Cada sesión son 5 palabras, elegidas al azar dentro de tres niveles de prioridad
(primero las que nunca has visto, luego las que fallas, al final las dominadas). De cada
palabra:

1. **Significado** — ¿qué significa `bottleneck`?
2. **Completar** — `The packaging station is the ______ of the line.`

Puedes responder de dos formas, con el interruptor de arriba:

- **Opciones** — eliges entre 4. Se corrige en el servidor sin llamar a la IA: instantáneo,
  gratis, y funciona aunque la API esté caída o sin cuota.
- **Escribir** — escribes tu respuesta y la IA te corrige en español, aceptando paráfrasis.

Después de responder aparece la **oración de ejemplo traducida al español**, para que
puedas juzgar el resultado. Antes de responder no se muestra, porque regalaría la respuesta.

Al terminar las 5, escribes 2-3 frases usando todas y la IA devuelve el texto corregido
más la explicación.

También hay un **diccionario personal** para guardar palabras que encuentres por tu cuenta.

Todo se guarda en Postgres, así que el progreso es el mismo en la compu y en el celular.

## Seguridad

La app pide usuario y contraseña. **Toda la API está protegida**; solo `/health`, `/me`,
`/login` y `/logout` son públicas.

Lo que esto protege es la API, que es donde están los activos reales: la **cuota de tus
claves de IA**, tu progreso y tu diccionario. Los archivos del frontend son públicos por
naturaleza en cualquier hosting estático, pero no contienen nada secreto.

Detalles de la implementación:

- La contraseña **nunca se guarda**: solo su hash **scrypt** con sal aleatoria.
- La sesión es una cookie **HttpOnly** (el JavaScript de la página no puede leerla, así
  que un XSS no podría robarla), **SameSite=Lax** (protege contra CSRF) y **Secure** en
  producción. Dura 1 día.
- El token va firmado con HMAC-SHA256: si alguien altera un solo byte, se rechaza.
- Las comparaciones de contraseña y firma usan `hmac.compare_digest`, en tiempo constante.
- **Falla cerrada**: si faltan `AUTH_USERNAME`, `AUTH_PASSWORD_HASH` o `SESSION_SECRET`,
  la API responde 401 a todo. Una configuración incompleta nunca deja la puerta abierta.

### Cambiar la contraseña

```bash
python api/make_password_hash.py
```

Te la pide sin mostrarla en pantalla y te devuelve el hash para pegar en `.env` y en las
variables de Vercel. La contraseña en texto plano no toca ningún archivo.

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
- `DEEPSEEK_API_KEY` — opcional, en [platform.deepseek.com](https://platform.deepseek.com/api_keys)

Puedes poner las dos claves: la app muestra un selector para cambiar de motor sobre la
marcha, útil cuando uno se queda sin cuota.

> `.env` está en `.gitignore`. Nunca se sube a GitHub.

### 3. Instalar dependencias

```bash
pip install -r requirements.txt
cd frontend && npm install && cd ..
```

### 4. Cargar las 320 palabras

```bash
python api/seed.py --reset
```

Carga dos orígenes: los `Vocabulario-Semana-*.txt` de la carpeta padre (ingeniería, con
las traducciones cruzadas desde `Traducciones-de-apoyo.txt`) y `api/data/basic_part*.json`
(inglés básico). Reporta si alguna oración quedó sin traducción.

`--reset` borra y recrea las tablas; hace falta cuando cambia el esquema. Sin ese flag
solo inserta y actualiza, sin tocar tu progreso.

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
   | `DEEPSEEK_API_KEY` | opcional, para tener el segundo motor |
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
  index.py       rutas FastAPI (/lessons, /progress, /evaluate,
                 /free-practice, /providers, /dictionary)
  db.py          modelos SQLAlchemy: Word, Attempt, DictionaryEntry
  providers.py   call_gemini() / call_claude() / call_deepseek(), mismo contrato
  seed.py        carga ambos orígenes de vocabulario
  data/          basic_part1.json, basic_part2.json (200 palabras básicas)
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
