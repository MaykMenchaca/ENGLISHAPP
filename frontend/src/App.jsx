import { useEffect, useMemo, useState } from 'react'
import {
  evaluate,
  freePractice,
  getLessons,
  getMe,
  getProgress,
  getProviders,
  logout as apiLogout,
  sayIt,
  setUnauthorizedHandler,
} from './api.js'
import Login from './components/Login.jsx'
import LessonSelector from './components/LessonSelector.jsx'
import ExerciseCard from './components/ExerciseCard.jsx'
import FreePractice from './components/FreePractice.jsx'
import Dictionary from './components/Dictionary.jsx'
import GamePicker from './components/GamePicker.jsx'
import Stats from './components/Stats.jsx'

const WORDS_PER_SESSION = 5
const MODES = ['meaning', 'completion']
const OPTIONS_PER_QUESTION = 4

function shuffle(list) {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** Resume el progreso por sección, para las barras del selector. */
function aggregateByWeek(items) {
  const byWeek = {}
  for (const item of items) {
    const bucket = (byWeek[item.week] ||= { attempted: 0, correct: 0, total: 0 })
    if (item.attempts > 0) bucket.attempted += 1
    bucket.correct += item.correct
    bucket.total += item.attempts
  }
  for (const bucket of Object.values(byWeek)) {
    bucket.accuracy = bucket.total ? bucket.correct / bucket.total : null
  }
  return byWeek
}

/** 1 respuesta correcta + 3 distractores tomados de la misma semana. */
function buildOptions(word, mode, pool) {
  const field = mode === 'meaning' ? 'spanish' : 'term'
  const correct = word[field]
  const distractors = shuffle(
    pool.filter((w) => w.id !== word.id).map((w) => w[field])
  )
    .filter((value, i, arr) => value !== correct && arr.indexOf(value) === i)
    .slice(0, OPTIONS_PER_QUESTION - 1)

  return shuffle([correct, ...distractors])
}

export default function App() {
  const [weeks, setWeeks] = useState([])
  const [progress, setProgress] = useState({})
  const [loading, setLoading] = useState(true)
  const [fatalError, setFatalError] = useState(null)

  // null = todavía no sabemos si hay sesión (evita parpadear el login al cargar)
  const [authenticated, setAuthenticated] = useState(null)

  // Estado de la sesión activa
  const [session, setSession] = useState(null) // { week, words, pool }
  const [step, setStep] = useState(0) // índice sobre words * MODES
  const [finished, setFinished] = useState(false)

  // 'choice' (opciones) o 'text' (escribir). Se recuerda entre sesiones.
  const [format, setFormat] = useState(
    () => localStorage.getItem('tutor-format') || 'choice'
  )

  function changeFormat(next) {
    setFormat(next)
    localStorage.setItem('tutor-format', next)
  }

  // Motores de IA con clave configurada en el servidor. Vacío hasta que
  // responda /api/providers; el switch no se pinta mientras tanto.
  const [providerOptions, setProviderOptions] = useState([])
  const [provider, setProvider] = useState(() => localStorage.getItem('tutor-provider'))

  function changeProvider(next) {
    setProvider(next)
    localStorage.setItem('tutor-provider', next)
  }

  // 'engineering' | 'basic'
  const [track, setTrack] = useState(
    () => localStorage.getItem('tutor-track') || 'engineering'
  )
  const [showDictionary, setShowDictionary] = useState(false)
  const [showGame, setShowGame] = useState(false)
  const [showStats, setShowStats] = useState(false)

  function changeTrack(next) {
    setTrack(next)
    localStorage.setItem('tutor-track', next)
  }

  // Cualquier 401 (sesión expirada a media sesión) devuelve al login.
  useEffect(() => {
    setUnauthorizedHandler(() => setAuthenticated(false))
  }, [])

  // ¿Hay sesión? Se pregunta una vez al cargar.
  useEffect(() => {
    let alive = true
    getMe()
      .then((d) => alive && setAuthenticated(d.authenticated))
      .catch(() => alive && setAuthenticated(false))
    return () => {
      alive = false
    }
  }, [])

  async function handleLogout() {
    try {
      await apiLogout()
    } catch {
      // aunque falle en el servidor, localmente volvemos al login
    }
    setSession(null)
    setShowDictionary(false)
    setAuthenticated(false)
  }

  // Se vuelve a cargar al cambiar de track o al iniciar sesión.
  useEffect(() => {
    if (!authenticated) return
    let alive = true
    setLoading(true)
    ;(async () => {
      try {
        const [lessons, prog, providersRes] = await Promise.all([
          getLessons(track),
          getProgress(null, track),
          getProviders(),
        ])
        if (!alive) return

        setWeeks(lessons.weeks)
        setProviderOptions(providersRes.options)
        // Si lo guardado en localStorage ya no está disponible (o nunca eligió),
        // cae en el proveedor por defecto del servidor.
        setProvider((prev) =>
          prev && providersRes.options.includes(prev) ? prev : providersRes.default
        )
        setProgress(aggregateByWeek(prog.items))
      } catch (err) {
        if (alive) setFatalError(err.message)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [track, authenticated])

  async function startWeek(week) {
    setLoading(true)
    setFatalError(null)
    try {
      const prog = await getProgress(week, track)

      // Tres grupos por prioridad: nunca vistas, falladas, y dominadas.
      // Se baraja DENTRO de cada grupo para que no salgan siempre las mismas
      // palabras, sin perder el criterio de insistir en lo que peor domina.
      const nuevas = prog.items.filter((w) => w.attempts === 0)
      const flojas = prog.items.filter((w) => w.attempts > 0 && (w.accuracy ?? 0) < 1)
      const dominadas = prog.items.filter((w) => w.attempts > 0 && (w.accuracy ?? 0) >= 1)
      const ranked = [...shuffle(nuevas), ...shuffle(flojas), ...shuffle(dominadas)]

      // pool = todas las palabras de la sección, para sacar distractores creíbles
      setSession({ week, words: ranked.slice(0, WORDS_PER_SESSION), pool: prog.items })
      setStep(0)
      setFinished(false)
    } catch (err) {
      setFatalError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const current = useMemo(() => {
    if (!session) return null
    const totalSteps = session.words.length * MODES.length
    if (step >= totalSteps) return null
    const word = session.words[Math.floor(step / MODES.length)]
    const mode = MODES[step % MODES.length]
    return {
      word,
      mode,
      wordIndex: Math.floor(step / MODES.length),
      // Se recalculan solo cuando cambia el ejercicio, no en cada render
      options: format === 'choice' ? buildOptions(word, mode, session.pool) : [],
    }
  }, [session, step, format])

  // "¿Cómo digo esto?" — consulta libre, no ligada al ejercicio en curso.
  function handleSayIt(spanish, attempt) {
    return sayIt(spanish, attempt, provider)
  }

  function exitSession() {
    setSession(null)
    setStep(0)
    setFinished(false)
    // Refresca las barras del selector con lo que acaba de practicar
    getProgress(null, track)
      .then((prog) => setProgress(aggregateByWeek(prog.items)))
      .catch(() => {})
  }

  // Estos dos van ANTES que cualquier otra pantalla: sin sesión no se muestra nada.
  if (authenticated === null) {
    return (
      <main className="shell">
        <p className="lede">Cargando…</p>
      </main>
    )
  }

  if (!authenticated) {
    return (
      <main className="shell">
        <Login
          onSuccess={() => {
            setFatalError(null)
            setAuthenticated(true)
          }}
        />
      </main>
    )
  }

  if (fatalError && !session) {
    return (
      <main className="shell">
        <div className="card error-card">
          <h2>No se pudo cargar</h2>
          <p className="error">{fatalError}</p>
          <p className="lede">
            Revisa que el backend esté corriendo y que la base de datos tenga las palabras
            cargadas (<code>python api/seed.py</code>).
          </p>
        </div>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="shell">
        <p className="lede">Cargando…</p>
      </main>
    )
  }

  if (showDictionary) {
    return (
      <main className="shell">
        <Dictionary onBack={() => setShowDictionary(false)} />
      </main>
    )
  }

  if (showGame) {
    return (
      <main className="shell">
        <GamePicker onBack={() => setShowGame(false)} />
      </main>
    )
  }

  if (showStats) {
    return (
      <main className="shell">
        <Stats onBack={() => setShowStats(false)} />
      </main>
    )
  }

  return (
    <main className="shell">
      {!session && (
        <LessonSelector
          weeks={weeks}
          progress={progress}
          onStart={startWeek}
          loading={loading}
          format={format}
          onFormat={changeFormat}
          providerOptions={providerOptions}
          provider={provider}
          onProvider={changeProvider}
          track={track}
          onTrack={changeTrack}
          onDictionary={() => setShowDictionary(true)}
          onLogout={handleLogout}
          onGame={() => setShowGame(true)}
          onStats={() => setShowStats(true)}
        />
      )}

      {session && current && (
        <>
          <ExerciseCard
            key={`${current.word.id}-${current.mode}`}
            word={current.word}
            mode={current.mode}
            format={format}
            options={current.options}
            index={current.wordIndex}
            total={session.words.length}
            onSubmit={(answer) =>
              evaluate(current.word.id, current.mode, answer, format, provider)
            }
            onNext={() => setStep((s) => s + 1)}
            onSayIt={handleSayIt}
          />
          <button className="btn ghost" onClick={exitSession}>
            Salir de la sesión
          </button>
        </>
      )}

      {session && !current && !finished && (
        <FreePractice
          words={session.words}
          onSubmit={(text) =>
            freePractice(
              session.words.map((w) => w.id),
              text,
              provider
            )
          }
          onFinish={() => setFinished(true)}
          onSayIt={handleSayIt}
        />
      )}

      {session && finished && (
        <div className="stack">
          <div className="card done-card">
            <h2>Sesión terminada</h2>
            <p className="lede">
              Practicaste {session.words.length} palabras del bloque {session.week}.
              Tu progreso quedó guardado.
            </p>
            <button className="btn primary" onClick={exitSession}>
              Volver a los bloques
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
