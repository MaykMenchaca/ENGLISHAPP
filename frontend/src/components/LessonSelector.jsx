import { useEffect, useState } from 'react'
import { getStats } from '../api.js'
import { LEARNING_PATH, isMastered } from '../learningPath.js'

const PROVIDER_LABELS = {
  gemini: 'Gemini',
  claude: 'Claude',
  deepseek: 'DeepSeek',
}

// Posición de cada (track, week) dentro de la ruta global, 1-indexada. Es
// estático — no depende de progreso — así que se calcula una sola vez fuera
// del componente en vez de en cada render.
const PATH_INDEX = new Map(
  LEARNING_PATH.map((step, i) => [`${step.track}-${step.week}`, i + 1])
)

export default function LessonSelector({
  weeks,
  progress,
  onStart,
  onJump,
  loading,
  format,
  onFormat,
  providerOptions,
  provider,
  onProvider,
  track,
  onTrack,
  onDictionary,
  onLogout,
  onGame,
  onVoice,
  onStats,
  onRuta,
}) {
  // Solo para la franja "siguiente recomendado" — el orden de las tarjetas
  // dentro de cada track ya no necesita esto, es puramente estático.
  const [statsTracks, setStatsTracks] = useState([])

  useEffect(() => {
    let alive = true
    getStats()
      .then((d) => alive && setStatsTracks(d.tracks))
      .catch(() => {}) // la franja simplemente no aparece si falla
    return () => {
      alive = false
    }
  }, [])

  const byTrack = {}
  for (const t of statsTracks) {
    byTrack[t.track] = {}
    for (const s of t.sections) byTrack[t.track][s.week] = s
  }
  const nextStep = LEARNING_PATH.find((step) => !isMastered(byTrack[step.track]?.[step.week]))
  const nextStepStats = nextStep && byTrack[nextStep.track]?.[nextStep.week]

  // Mismas tarjetas, reordenadas por prioridad de la ruta — los bloques que
  // no están en la ruta (no debería pasar, la cubre entera) van al final.
  const orderedWeeks = [...weeks].sort((a, b) => {
    const pa = PATH_INDEX.get(`${track}-${a.week}`) ?? 999
    const pb = PATH_INDEX.get(`${track}-${b.week}`) ?? 999
    return pa - pb
  })
  return (
    <div className="stack">
      <header className="masthead">
        <p className="eyebrow">Tutor de inglés · TOEFL + Ingeniería Industrial</p>
        <h1>Elige tu bloque</h1>
        <p className="lede">
          Cada sesión son 5 palabras. De cada una te pregunto el significado y luego
          te pido completarla dentro de una oración. Te corrijo en español.
        </p>
      </header>

      {/* Solo aparece si aún queda algo por dominar en la ruta — cuando la
          termina toda, no tiene sentido seguir empujándolo a "lo siguiente". */}
      {nextStep && (
        <div className="next-up">
          <div className="next-up-text">
            <span className="next-up-label">Siguiente recomendado</span>
            <p className="next-up-title">
              {nextStepStats?.section_name || `Bloque ${nextStep.week}`}
            </p>
          </div>
          <button
            type="button"
            className="btn primary"
            onClick={() => onJump(nextStep.track, nextStep.week)}
          >
            Empezar
          </button>
        </div>
      )}

      <div className="track-tabs" role="group" aria-label="Tipo de vocabulario">
        <button
          type="button"
          className={track === 'structure' ? 'active' : ''}
          onClick={() => onTrack('structure')}
        >
          Estructura
        </button>
        <button
          type="button"
          className={track === 'engineering' ? 'active' : ''}
          onClick={() => onTrack('engineering')}
        >
          Ingeniería
        </button>
        <button
          type="button"
          className={track === 'basic' ? 'active' : ''}
          onClick={() => onTrack('basic')}
        >
          Inglés básico
        </button>
        <button
          type="button"
          className={track === 'academic' ? 'active' : ''}
          onClick={() => onTrack('academic')}
        >
          Académico
        </button>
      </div>

      <div className="action-bar" role="group" aria-label="Herramientas">
        <button type="button" className="action-btn" onClick={onRuta}>
          Ruta
        </button>
        <button type="button" className="action-btn" onClick={onStats}>
          Progreso
        </button>
        <button type="button" className="action-btn" onClick={onGame}>
          Jugar
        </button>
        <button type="button" className="action-btn" onClick={onVoice}>
          Hablar
        </button>
        <button type="button" className="action-btn" onClick={onDictionary}>
          Mi diccionario
        </button>
        <button type="button" className="action-btn logout" onClick={onLogout}>
          Salir
        </button>
      </div>

      <div className="switch-row">
        <span className="switch-label">Cómo quieres responder</span>
        <div className="switch" role="group" aria-label="Formato de respuesta">
          <button
            type="button"
            className={format === 'choice' ? 'active' : ''}
            onClick={() => onFormat('choice')}
          >
            Opciones
          </button>
          <button
            type="button"
            className={format === 'text' ? 'active' : ''}
            onClick={() => onFormat('text')}
          >
            Escribir
          </button>
        </div>
        <p className="switch-hint">
          {format === 'choice'
            ? 'Eliges entre 4 opciones. Respuesta inmediata, ideal para empezar.'
            : 'Escribes tu respuesta y la IA te corrige en español. Cuesta más, enseña más.'}
        </p>
      </div>

      {/* Solo aparece si hay más de un proveedor con clave configurada en el
          servidor — con uno solo, elegir no tiene sentido. */}
      {providerOptions.length > 1 && (
        <div className="switch-row">
          <span className="switch-label">Motor de IA para escribir</span>
          <div className="switch" role="group" aria-label="Proveedor de IA">
            {providerOptions.map((p) => (
              <button
                key={p}
                type="button"
                className={provider === p ? 'active' : ''}
                onClick={() => onProvider(p)}
              >
                {PROVIDER_LABELS[p] || p}
              </button>
            ))}
          </div>
          <p className="switch-hint">
            Solo se usa en modo «Escribir» y en la práctica libre. Si uno falla o se
            queda sin cuota, cambia aquí sin perder tu sesión.
          </p>
        </div>
      )}

      <div className="lesson-grid">
        {orderedWeeks.map((w) => {
          const stats = progress[w.week] || { attempted: 0, accuracy: null }
          const pct = w.count ? Math.round((stats.attempted / w.count) * 100) : 0
          const priority = PATH_INDEX.get(`${track}-${w.week}`)
          return (
            <button
              key={w.week}
              className="lesson-card"
              onClick={() => onStart(w.week)}
              disabled={loading}
            >
              <span className="lesson-num">
                Bloque {w.week}
                {priority && <span className="lesson-priority"> · {priority}º en tu ruta</span>}
              </span>
              <span className="lesson-title">{w.section_name}</span>
              <span className="lesson-meta">{w.count} palabras</span>
              <span className="bar" aria-hidden="true">
                <span className="bar-fill" style={{ width: `${pct}%` }} />
              </span>
              <span className="lesson-meta">
                {stats.attempted} vistas
                {stats.accuracy !== null && ` · ${Math.round(stats.accuracy * 100)}% acierto`}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
