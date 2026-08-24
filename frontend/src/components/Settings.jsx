const PROVIDER_LABELS = {
  gemini: 'Gemini',
  claude: 'Claude',
  deepseek: 'DeepSeek',
}

/**
 * Ajustes en su propia pantalla. Antes los 3 switch-row (formato, sonidos,
 * proveedor) vivían arriba de la rejilla de bloques y ocupaban media pantalla
 * en cada visita, aunque casi nunca se vuelven a tocar — aquí no compiten con
 * lo que sí se usa a diario. Mismas clases .switch-row/.switch de siempre,
 * nada de estilos nuevos que inventar.
 */
export default function Settings({
  format,
  onFormat,
  sounds,
  onSounds,
  providerOptions,
  provider,
  onProvider,
  theme,
  onTheme,
  onBack,
}) {
  return (
    <div className="stack">
      <header className="masthead">
        <p className="eyebrow">Ajustes</p>
        <h1>Cómo quieres que se vea y suene la app</h1>
        <p className="lede">Se guardan solos y se recuerdan la próxima vez que entres.</p>
      </header>

      <div className="switch-row">
        <span className="switch-label">Apariencia</span>
        <div className="switch" role="group" aria-label="Tema claro u oscuro">
          <button
            type="button"
            className={theme === 'dark' ? 'active' : ''}
            onClick={() => onTheme('dark')}
          >
            Oscuro
          </button>
          <button
            type="button"
            className={theme === 'light' ? 'active' : ''}
            onClick={() => onTheme('light')}
          >
            Claro
          </button>
        </div>
        <p className="switch-hint">Elige el que se te haga más cómodo para leer.</p>
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

      <div className="switch-row">
        <span className="switch-label">Sonidos</span>
        <div className="switch" role="group" aria-label="Sonidos de acierto y error">
          <button
            type="button"
            className={sounds ? 'active' : ''}
            onClick={() => onSounds(true)}
          >
            Activados
          </button>
          <button
            type="button"
            className={!sounds ? 'active' : ''}
            onClick={() => onSounds(false)}
          >
            Silencio
          </button>
        </div>
        <p className="switch-hint">
          {sounds
            ? 'Suena un tono al acertar y otro distinto al fallar, también en el juego.'
            : 'Sin tonos de acierto ni de error. La pronunciación en voz alta sigue funcionando.'}
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

      <button className="btn ghost" onClick={onBack}>
        Volver a los bloques
      </button>
    </div>
  )
}
