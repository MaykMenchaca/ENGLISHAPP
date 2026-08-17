import { useEffect, useMemo, useState } from 'react'
import { evaluate, freePractice, getLessons, getProgress } from './api.js'
import LessonSelector from './components/LessonSelector.jsx'
import ExerciseCard from './components/ExerciseCard.jsx'
import FreePractice from './components/FreePractice.jsx'

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

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [lessons, prog] = await Promise.all([getLessons(), getProgress()])
        if (!alive) return

        setWeeks(lessons.weeks)

        // Agregamos por semana para pintar las barras del selector
        const byWeek = {}
        for (const item of prog.items) {
          const bucket = (byWeek[item.week] ||= { attempted: 0, correct: 0, total: 0 })
          if (item.attempts > 0) bucket.attempted += 1
          bucket.correct += item.correct
          bucket.total += item.attempts
        }
        for (const bucket of Object.values(byWeek)) {
          bucket.accuracy = bucket.total ? bucket.correct / bucket.total : null
        }
        setProgress(byWeek)
      } catch (err) {
        if (alive) setFatalError(err.message)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  async function startWeek(week) {
    setLoading(true)
    setFatalError(null)
    try {
      const prog = await getProgress(week)
      // Prioriza lo que peor domina: primero sin intentos, luego menor precisión
      const ranked = [...prog.items].sort((a, b) => {
        if (a.attempts === 0 && b.attempts !== 0) return -1
        if (b.attempts === 0 && a.attempts !== 0) return 1
        return (a.accuracy ?? 0) - (b.accuracy ?? 0)
      })
      // pool = todas las palabras de la semana, para sacar distractores creíbles
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

  function exitSession() {
    setSession(null)
    setStep(0)
    setFinished(false)
    // Refresca las barras del selector con lo que acaba de practicar
    getProgress()
      .then((prog) => {
        const byWeek = {}
        for (const item of prog.items) {
          const bucket = (byWeek[item.week] ||= { attempted: 0, correct: 0, total: 0 })
          if (item.attempts > 0) bucket.attempted += 1
          bucket.correct += item.correct
          bucket.total += item.attempts
        }
        for (const bucket of Object.values(byWeek)) {
          bucket.accuracy = bucket.total ? bucket.correct / bucket.total : null
        }
        setProgress(byWeek)
      })
      .catch(() => {})
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
            onSubmit={(answer) => evaluate(current.word.id, current.mode, answer, format)}
            onNext={() => setStep((s) => s + 1)}
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
              text
            )
          }
          onFinish={() => setFinished(true)}
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
