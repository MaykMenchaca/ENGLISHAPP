import { useEffect, useState } from 'react'
import { getProgress } from '../api.js'

/**
 * Pantalla intermedia entre "elegir bloque" y "hacer algo con él". Antes
 * GamePicker y WritePicker volvían a preguntar track + bloque — exactamente
 * lo que ya se eligió en la rejilla principal. Ahora el bloque se elige UNA
 * vez y aquí se decide qué actividad hacer con él; MatchGame y FreePractice
 * no cambian, solo cambia quién los abre.
 */
export default function BlockScreen({ track, week, sectionName, onPractice, onGame, onWrite, onBack }) {
  const [stats, setStats] = useState(null) // { count, attempted, accuracy }
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    setStats(null)
    setError(null)
    getProgress(week, track)
      .then((prog) => {
        if (!alive) return
        const items = prog.items
        const attempted = items.filter((w) => w.attempts > 0).length
        const totalAttempts = items.reduce((sum, w) => sum + w.attempts, 0)
        const totalCorrect = items.reduce((sum, w) => sum + w.correct, 0)
        setStats({
          count: items.length,
          attempted,
          accuracy: totalAttempts ? totalCorrect / totalAttempts : null,
        })
      })
      .catch((err) => alive && setError(err.message))
    return () => {
      alive = false
    }
  }, [track, week])

  const pct = stats && stats.count ? Math.round((stats.attempted / stats.count) * 100) : 0

  return (
    <div className="stack">
      <header className="masthead">
        <p className="eyebrow">Bloque {week}</p>
        <h1>{sectionName}</h1>
        {stats && (
          <p className="lede">
            {stats.count} palabras · {stats.attempted} vistas
            {stats.accuracy !== null && ` · ${Math.round(stats.accuracy * 100)}% acierto`}
          </p>
        )}
      </header>

      {stats && (
        <span className="bar" aria-hidden="true">
          <span className="bar-fill" style={{ width: `${pct}%` }} />
        </span>
      )}

      {error && (
        <div className="card error-card">
          <h2>No se pudo cargar</h2>
          <p className="error">{error}</p>
        </div>
      )}

      <div className="block-activities">
        <button type="button" className="block-activity" onClick={onPractice} disabled={!!error}>
          <span className="block-activity-title">Practicar las palabras</span>
          <span className="block-activity-desc">
            5 palabras: significado, completar la oración, y un repaso final para que se
            te queden.
          </span>
        </button>
        <button
          type="button"
          className="block-activity"
          onClick={onGame}
          disabled={!!error || !stats || stats.count < 4}
        >
          <span className="block-activity-title">Jugar a emparejar</span>
          <span className="block-activity-desc">
            Encuentra las parejas de palabra y significado contra el reloj.
          </span>
        </button>
        <button type="button" className="block-activity" onClick={onWrite} disabled={!!error}>
          <span className="block-activity-title">Escribir frases</span>
          <span className="block-activity-desc">
            Redacta un par de frases en inglés usando algunas de estas palabras. La IA
            te corrige en español.
          </span>
        </button>
      </div>

      <button className="btn ghost" onClick={onBack}>
        Volver a los bloques
      </button>
    </div>
  )
}
