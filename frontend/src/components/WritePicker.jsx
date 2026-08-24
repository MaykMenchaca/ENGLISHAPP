import { useEffect, useState } from 'react'
import { getLessons, getProgress } from '../api.js'
import FreePractice from './FreePractice.jsx'

const WORDS_PER_PRACTICE = 5

function shuffle(list) {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * Escribir frases como apartado propio. Antes vivía clavada al final de cada
 * sesión, donde bloqueaba a quien todavía no tiene nivel para redactar libre;
 * ahora se entra cuando uno quiere. Mismo patrón que GamePicker: elegir track y
 * bloque, y con esas palabras se arranca la práctica que ya existía.
 */
export default function WritePicker({ onBack, onSubmit, onSayIt }) {
  const [track, setTrack] = useState('structure')
  const [weeks, setWeeks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [practice, setPractice] = useState(null) // { words, sectionName }

  useEffect(() => {
    let alive = true
    setLoading(true)
    getLessons(track)
      .then((d) => alive && setWeeks(d.weeks))
      .catch((err) => alive && setError(err.message))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [track])

  async function startPractice(week, sectionName) {
    setLoading(true)
    setError(null)
    try {
      const prog = await getProgress(week, track)
      setPractice({
        words: shuffle(prog.items).slice(0, WORDS_PER_PRACTICE),
        sectionName,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (practice) {
    return (
      <FreePractice
        words={practice.words}
        onSubmit={(text) => onSubmit(practice.words.map((w) => w.id), text)}
        onFinish={() => setPractice(null)}
        onSayIt={onSayIt}
      />
    )
  }

  return (
    <div className="stack">
      <header className="masthead">
        <p className="eyebrow">Escribir frases</p>
        <h1>Practica escribiendo en inglés</h1>
        <p className="lede">
          Elige un bloque y te doy 5 palabras suyas para que escribas un par de frases.
          La IA te corrige en español. Es el paso más exigente de la app — entra cuando
          te sientas listo, no hay prisa.
        </p>
      </header>

      <div className="track-tabs" role="group" aria-label="Tipo de vocabulario">
        <button
          type="button"
          className={track === 'structure' ? 'active' : ''}
          onClick={() => setTrack('structure')}
        >
          Estructura
        </button>
        <button
          type="button"
          className={track === 'engineering' ? 'active' : ''}
          onClick={() => setTrack('engineering')}
        >
          Ingeniería
        </button>
        <button
          type="button"
          className={track === 'basic' ? 'active' : ''}
          onClick={() => setTrack('basic')}
        >
          Inglés básico
        </button>
        <button
          type="button"
          className={track === 'academic' ? 'active' : ''}
          onClick={() => setTrack('academic')}
        >
          Académico
        </button>
      </div>

      {error && (
        <div className="card error-card">
          <h2>No se pudo cargar</h2>
          <p className="error">{error}</p>
        </div>
      )}

      {!error && (
        <div className="lesson-grid">
          {weeks.map((w) => (
            <button
              key={w.week}
              className="lesson-card"
              onClick={() => startPractice(w.week, w.section_name)}
              disabled={loading}
            >
              <span className="lesson-num">Bloque {w.week}</span>
              <span className="lesson-title">{w.section_name}</span>
              <span className="lesson-meta">{w.count} palabras</span>
            </button>
          ))}
        </div>
      )}

      <button className="btn ghost" onClick={onBack}>
        Volver a los bloques
      </button>
    </div>
  )
}
