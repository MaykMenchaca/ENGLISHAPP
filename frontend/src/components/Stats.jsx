import { useEffect, useState } from 'react'
import { getStats } from '../api.js'

const pct = (v) => (v === null || v === undefined ? null : Math.round(v * 100))

export default function Stats({ onBack }) {
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

  const totalWords = tracks.reduce((n, t) => n + t.total, 0)
  const totalPracticed = tracks.reduce((n, t) => n + t.practiced, 0)
  const totalAttempts = tracks.reduce((n, t) => n + t.attempts, 0)
  const totalCorrect = tracks.reduce((n, t) => n + t.correct, 0)
  const overallAccuracy = totalAttempts ? totalCorrect / totalAttempts : null

  return (
    <div className="stack">
      <header className="masthead">
        <p className="eyebrow">Progreso</p>
        <h1>Cómo vas por área</h1>
        <p className="lede">
          Una palabra cuenta como practicada en cuanto la respondes al menos una vez.
          La precisión se calcula sobre respuestas, no sobre palabras.
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
        <>
          {/* Cifra principal: una sola por vista */}
          <div className="card hero-card">
            <p className="stat-label">Palabras practicadas en total</p>
            <p className="hero-figure">{totalPracticed}</p>
            <p className="stat-sub">
              de {totalWords} disponibles
              {overallAccuracy !== null && ` · ${pct(overallAccuracy)}% de acierto`}
            </p>
          </div>

          {/* Un resumen por área */}
          <div className="stat-row">
            {tracks.map((t) => (
              <div className="stat-tile" key={t.track}>
                <p className="stat-label">{t.label}</p>
                <p className="stat-value">
                  {t.practiced}
                  <span className="stat-of"> / {t.total}</span>
                </p>
                <span className="meter" aria-hidden="true">
                  {/* Sin relleno cuando es cero: min-width pintaría una marca
                      azul y sugeriría avance donde no lo hay. */}
                  {t.coverage > 0 && (
                    <span className="meter-fill" style={{ width: `${pct(t.coverage)}%` }} />
                  )}
                </span>
                <p className="stat-sub">
                  {pct(t.coverage)}% cubierto
                  {t.accuracy !== null && ` · ${pct(t.accuracy)}% acierto`}
                </p>
              </div>
            ))}
          </div>

          {/* Desglose por sección, un grupo por área */}
          {tracks.map((t) => (
            <section className="stat-group" key={t.track}>
              <h2 className="stat-group-title">{t.label}</h2>
              <table className="stat-table">
                <thead>
                  <tr>
                    <th scope="col">Sección</th>
                    <th scope="col" className="num">
                      Practicadas
                    </th>
                    <th scope="col" className="num">
                      Acierto
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {t.sections.map((s) => (
                    <tr key={s.week}>
                      <th scope="row">
                        <span className="stat-section-name">{s.section_name}</span>
                        <span className="meter thin" aria-hidden="true">
                          {s.coverage > 0 && (
                            <span
                              className="meter-fill"
                              style={{ width: `${pct(s.coverage)}%` }}
                            />
                          )}
                        </span>
                      </th>
                      <td className="num">
                        {s.practiced}/{s.total}
                      </td>
                      <td className="num">
                        {s.accuracy === null ? '—' : `${pct(s.accuracy)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </>
      )}

      <button className="btn ghost" onClick={onBack}>
        Volver a los bloques
      </button>
    </div>
  )
}
