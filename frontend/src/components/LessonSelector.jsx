const TITLES = {
  1: 'Cimientos',
  2: 'Procesos y calidad',
  3: 'Datos y conectores',
  4: 'Gestión y abstractos',
}

export default function LessonSelector({ weeks, progress, onStart, loading, format, onFormat }) {
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

      <div className="lesson-grid">
        {weeks.map((w) => {
          const stats = progress[w.week] || { attempted: 0, accuracy: null }
          const pct = w.count ? Math.round((stats.attempted / w.count) * 100) : 0
          return (
            <button
              key={w.week}
              className="lesson-card"
              onClick={() => onStart(w.week)}
              disabled={loading}
            >
              <span className="lesson-num">Bloque {w.week}</span>
              <span className="lesson-title">{TITLES[w.week] || `Semana ${w.week}`}</span>
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
