import { useEffect, useState } from 'react'
import { getLessons } from '../api.js'
import MatchGame from './MatchGame.jsx'

export default function GamePicker({ onBack }) {
  const [track, setTrack] = useState('engineering')
  const [weeks, setWeeks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [playing, setPlaying] = useState(null) // { week, sectionName }

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

  if (playing) {
    return (
      <MatchGame
        track={track}
        week={playing.week}
        sectionName={playing.sectionName}
        onBack={() => setPlaying(null)}
      />
    )
  }

  return (
    <div className="stack">
      <header className="masthead">
        <p className="eyebrow">Jugar · Emparejar</p>
        <h1>¿Qué tan bien va tu vocabulario?</h1>
        <p className="lede">
          Elige una sección para jugar contra el reloj: encuentra las 8 parejas de
          palabra y significado lo más rápido posible.
        </p>
      </header>

      <div className="tabs" role="group" aria-label="Tipo de vocabulario">
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
              onClick={() => setPlaying({ week: w.week, sectionName: w.section_name })}
              disabled={loading || w.count < 4}
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
