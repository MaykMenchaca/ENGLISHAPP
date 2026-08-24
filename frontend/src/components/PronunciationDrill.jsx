import { useRef, useState } from 'react'
import { speak, speechSupported } from '../speech.js'
import { listen, listenSupported } from '../listen.js'
import SpeakButton from './SpeakButton.jsx'
import { SENTENCES } from '../speakingContent.js'

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9' ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

/**
 * "Escucha y repite": no califica pronunciación (eso necesitaría un servicio
 * de pago) sino si el reconocedor del navegador te entendió. Es un
 * termómetro honesto — si te entendió, tu pronunciación estuvo lo bastante
 * cerca — no una nota.
 */
export default function PronunciationDrill({ onBack }) {
  const [index, setIndex] = useState(0)
  const [listening, setListening] = useState(false)
  const [heard, setHeard] = useState(null)
  const [textInput, setTextInput] = useState('')
  const [error, setError] = useState(null)
  const stopRef = useRef(null)

  const sentence = SENTENCES[index]
  const targetWords = normalize(sentence)
  const heardSet = new Set(heard ? normalize(heard) : [])
  const allHeard = heard !== null && targetWords.every((w) => heardSet.has(w))

  function toggleListening() {
    if (listening) {
      stopRef.current?.()
      return
    }
    setError(null)
    setHeard(null)
    setListening(true)
    stopRef.current = listen({
      lang: 'en-US',
      onResult: (text) => {
        setListening(false)
        setHeard(text)
      },
      onEnd: () => setListening(false),
      onError: (message) => {
        setError(message)
        setListening(false)
      },
    })
  }

  function handleTextSubmit(event) {
    event.preventDefault()
    if (!textInput.trim()) return
    setHeard(textInput.trim())
  }

  function next() {
    setIndex((i) => (i + 1) % SENTENCES.length)
    setHeard(null)
    setTextInput('')
    setError(null)
  }

  return (
    <div className="stack">
      <header className="masthead">
        <p className="eyebrow">Hablar · Escucha y repite</p>
        <h1>Practica tu pronunciación</h1>
        <p className="lede">
          Escucha la frase, repítela en voz alta, y te marco qué palabras se entendieron.
          Mide si se te entiende, no qué tan «bien» suena.
        </p>
      </header>

      <div className="progress-line">
        <span>
          Frase {index + 1} de {SENTENCES.length}
        </span>
      </div>

      <div className="card">
        <p className="sentence">{sentence}</p>
        {speechSupported() && (
          <div className="drill-audio">
            <SpeakButton text={sentence} label="Escuchar normal" />
            <button
              type="button"
              className="btn ghost"
              onClick={() => speak(sentence, { rate: 0.55 })}
            >
              Escuchar más lento
            </button>
          </div>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {listenSupported() ? (
        <div className="voice-controls">
          <button
            type="button"
            className={`voice-mic ${listening ? 'listening' : ''}`}
            onClick={toggleListening}
            aria-label={listening ? 'Detener' : 'Repetir la frase'}
          >
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
              <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" />
              <path
                d="M5 11a7 7 0 0 0 14 0"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path d="M12 18v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <p className="voice-hint">{listening ? 'Escuchando…' : 'Toca y di la frase'}</p>
        </div>
      ) : (
        <form onSubmit={handleTextSubmit} className="voice-fallback">
          <input
            className="input"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Tu navegador no puede escucharte — escribe lo que dirías…"
            autoComplete="off"
          />
          <button className="btn primary" type="submit" disabled={!textInput.trim()}>
            Revisar
          </button>
        </form>
      )}

      {heard !== null && (
        <div className={`feedback ${allHeard ? 'ok' : 'bad'}`}>
          <p className="feedback-verdict">{allHeard ? 'Se te entendió todo' : 'Faltó algo'}</p>
          <p className="word-chips">
            {targetWords.map((w, i) => (
              <span key={i} className={`chip ${heardSet.has(w) ? 'chip-used' : 'chip-missed'}`}>
                {w}
              </span>
            ))}
          </p>
          <p className="feedback-text">Lo que se escuchó: «{heard}»</p>
          <div className="feedback-actions">
            <button className="btn primary" onClick={next} autoFocus>
              Siguiente frase
            </button>
          </div>
        </div>
      )}

      <button className="btn ghost" onClick={onBack}>
        Volver a Hablar
      </button>
    </div>
  )
}
