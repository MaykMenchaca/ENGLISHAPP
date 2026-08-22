const PROVIDER_LABELS = {
  gemini: 'Gemini',
  claude: 'Claude',
  deepseek: 'DeepSeek',
}

export default function LessonSelector({
  weeks,
  progress,
  onStart,
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
}) {
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

      <div className="tabs" role="group" aria-label="Tipo de vocabulario">
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
        <button type="button" className="tab-side" onClick={onGame}>
          Jugar
        </button>
        <button type="button" onClick={onDictionary}>
          Mi diccionario
        </button>
        <button type="button" className="tab-logout" onClick={onLogout}>
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
