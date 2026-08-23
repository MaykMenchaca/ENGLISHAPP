import { useEffect, useRef, useState } from 'react'
import { speak, speechSupported } from '../speech.js'
import { listen, listenSupported } from '../listen.js'

// Frase de apertura fija: no gasta cuota de IA en saludar, y siempre arranca
// la charla con una pregunta sencilla que cualquier principiante puede contestar.
const OPENING_LINE = "Hi! I'm your English conversation partner. What's your name?"

export default function VoiceChat({ onBack, onConverse }) {
  const [messages, setMessages] = useState([{ role: 'assistant', text: OPENING_LINE }])
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [textInput, setTextInput] = useState('')
  const stopRef = useRef(null)
  const bottomRef = useRef(null)
  const spokeOpening = useRef(false)

  useEffect(() => {
    // Solo una vez, aunque el componente se vuelva a montar en modo estricto.
    if (spokeOpening.current) return
    spokeOpening.current = true
    speak(OPENING_LINE)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, interim])

  // Detiene el reconocimiento si el estudiante sale de la pantalla a medio hablar.
  useEffect(() => () => stopRef.current?.(), [])

  async function handleUserText(text) {
    const trimmed = text.trim()
    if (!trimmed || busy) return

    setInterim('')
    setError(null)
    const nextMessages = [...messages, { role: 'user', text: trimmed }]
    setMessages(nextMessages)
    setBusy(true)

    try {
      const res = await onConverse(nextMessages.map(({ role, text: t }) => ({ role, text: t })))
      setMessages((prev) => {
        const updated = [...prev]
        const lastUserIndex = updated.length - 1
        if (res.correction) {
          updated[lastUserIndex] = { ...updated[lastUserIndex], correction: res.correction }
        }
        return [...updated, { role: 'assistant', text: res.reply }]
      })
      speak(res.reply)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function toggleListening() {
    if (listening) {
      stopRef.current?.()
      return
    }
    setError(null)
    setListening(true)
    stopRef.current = listen({
      onInterim: setInterim,
      onResult: (text) => {
        setListening(false)
        handleUserText(text)
      },
      onEnd: () => {
        setListening(false)
        setInterim('')
      },
      onError: (message) => {
        setError(message)
        setListening(false)
      },
    })
  }

  function handleTextSubmit(event) {
    event.preventDefault()
    handleUserText(textInput)
    setTextInput('')
  }

  return (
    <div className="stack">
      <header className="masthead">
        <p className="eyebrow">Práctica de speaking</p>
        <h1>Habla en inglés</h1>
        <p className="lede">
          {listenSupported()
            ? 'Toca el micrófono y contesta en inglés. Te corrijo en español debajo de lo que dijiste, y te sigo la conversación.'
            : 'Tu navegador no puede escucharte por voz — usa Chrome o Edge para eso. Por ahora puedes escribir tus respuestas.'}
        </p>
      </header>

      <div className="voice-thread">
        {messages.map((m, i) => (
          <div key={i} className={`voice-msg ${m.role}`}>
            <p className="voice-msg-text">{m.text}</p>
            {m.correction && <p className="voice-correction">{m.correction}</p>}
          </div>
        ))}
        {interim && (
          <div className="voice-msg user interim">
            <p className="voice-msg-text">{interim}</p>
          </div>
        )}
        {busy && (
          <div className="voice-msg assistant interim">
            <p className="voice-msg-text">…</p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="error">{error}</p>}

      {listenSupported() ? (
        <div className="voice-controls">
          <button
            type="button"
            className={`voice-mic ${listening ? 'listening' : ''}`}
            onClick={toggleListening}
            disabled={busy}
            aria-label={listening ? 'Detener y enviar' : 'Hablar'}
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
          <p className="voice-hint">
            {listening ? 'Escuchando… toca de nuevo para enviar' : 'Toca para hablar'}
          </p>
        </div>
      ) : (
        <form onSubmit={handleTextSubmit} className="voice-fallback">
          <input
            className="input"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Escribe tu respuesta en inglés…"
            disabled={busy}
            autoComplete="off"
          />
          <button className="btn primary" type="submit" disabled={busy || !textInput.trim()}>
            Enviar
          </button>
        </form>
      )}

      {!speechSupported() && (
        <p className="voice-hint">
          Tu navegador tampoco puede leer las respuestas en voz alta — las verás solo en texto.
        </p>
      )}

      <button className="btn ghost" onClick={onBack}>
        Terminar conversación
      </button>
    </div>
  )
}
