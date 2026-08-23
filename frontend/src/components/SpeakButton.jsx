import { speak, speechSupported } from '../speech.js'

/**
 * Botón de bocina para escuchar la pronunciación.
 * Si el navegador no trae voces, no se pinta nada en vez de mostrar un botón muerto.
 */
export default function SpeakButton({ text, label, size = 'md' }) {
  if (!speechSupported() || !text) return null

  return (
    <button
      type="button"
      className={`speak-btn ${size === 'sm' ? 'sm' : ''}`}
      onClick={(e) => {
        e.stopPropagation() // no dispara el clic de la tarjeta que lo contiene
        speak(text)
      }}
      aria-label={label || `Escuchar la pronunciación de ${text}`}
      title="Escuchar"
    >
      {/* Bocina dibujada en SVG: no depende de que la fuente traiga el emoji */}
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          d="M4 9v6h4l5 4V5L8 9H4z"
          fill="currentColor"
        />
        <path
          d="M16.5 8.5a5 5 0 0 1 0 7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M19 6a8.5 8.5 0 0 1 0 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </button>
  )
}
