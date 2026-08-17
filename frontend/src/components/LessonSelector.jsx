const TITLES = {
  1: 'Cimientos',
  2: 'Procesos y calidad',
  3: 'Datos y conectores',
  4: 'Gestión y abstractos',
}

export default function LessonSelector({ weeks, progress, onStart, loading }) {
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
