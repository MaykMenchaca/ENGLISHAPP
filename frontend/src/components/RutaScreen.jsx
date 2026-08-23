import { useEffect, useState } from 'react'
import { getStats } from '../api.js'
import { LEARNING_PATH, isMastered } from '../learningPath.js'

export default function RutaScreen({ onBack, onStart }) {
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    getStats()
      .then((d) => alive && setTracks(d.tracks))
      .catch((err) => alive && setError(err.message))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  // {track: {label, sections: {week: sectionStats}}} — mismos datos que Progreso,
  // reacomodados para buscar por (track, week) en vez de recorrer listas.
  const byTrack = {}
  for (const t of tracks) {
    byTrack[t.track] = { label: t.label, sections: {} }
    for (const s of t.sections) byTrack[t.track].sections[s.week] = s
  }

  // El primer paso de la ruta que todavía no está dominado, para destacarlo.
  let nextIndex = LEARNING_PATH.findIndex((step) => {
    const sectionStats = byTrack[step.track]?.sections[step.week]
    return !isMastered(sectionStats)
  })
  if (nextIndex === -1) nextIndex = LEARNING_PATH.length // ya dominó todo

  return (
    <div className="stack">
      <header className="masthead">
        <p className="eyebrow">Guía de estudio</p>
        <h1>Tu ruta recomendada</h1>
        <p className="lede">
          El orden que más te va a servir para armar oraciones desde cero, no una
          regla obligatoria: puedes entrar a cualquier bloque desde «Elige tu
          bloque» cuando quieras. Si no sabes por dónde empezar, empieza aquí.
        </p>
      </header>

      {error && (
        <div className="card error-card">
          <h2>No se pudo cargar</h2>
          <p className="error">{error}</p>
        </div>
      )}

      {loading && <p className="lede">Cargando…</p>}

      {!loading && !error && (
        <ol className="path-list">
          {LEARNING_PATH.map((step, i) => {
            const sectionStats = byTrack[step.track]?.sections[step.week]
            const trackLabel = byTrack[step.track]?.label || step.track
            const mastered = isMastered(sectionStats)
            const isNext = i === nextIndex
            return (
              <li
                key={`${step.track}-${step.week}`}
                className={`path-step ${mastered ? 'done' : ''} ${isNext ? 'next' : ''}`}
              >
                <span className="path-badge" aria-hidden="true">
                  {mastered ? '✓' : i + 1}
                </span>
                <div className="path-body">
                  <p className="path-title">
                    {trackLabel} · {sectionStats?.section_name || `Bloque ${step.week}`}
                  </p>
                  {step.reason && <p className="path-reason">{step.reason}</p>}
                </div>
                <button
                  type="button"
                  className={isNext ? 'btn primary' : 'btn ghost'}
                  onClick={() => onStart(step.track, step.week)}
                >
                  {isNext ? 'Empieza aquí' : mastered ? 'Repasar' : 'Practicar'}
                </button>
              </li>
            )
          })}
        </ol>
      )}

      <button className="btn ghost" onClick={onBack}>
        Volver a los bloques
      </button>
    </div>
  )
}
