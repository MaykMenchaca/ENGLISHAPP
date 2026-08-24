import { useEffect, useRef, useState } from 'react'
import { speak, speechSupported } from '../speech.js'
import { listen, listenSupported } from '../listen.js'
import SpeakButton from './SpeakButton.jsx'

// Cada tema es solo una frase de apertura distinta — el backend no cambia,
// solo con qué mensaje arranca la conversación.
const TOPICS = [
  {
    id: 'free',
    label: 'Charla libre',
    opening: "Hi! I'm your English conversation partner. What's your name?",
  },
  {
    id: 'routine',
    label: 'Tu rutina diaria',
    opening: "Hi! Let's talk about your daily routine. What time do you usually wake up?",
  },
  {
    id: 'interview',
    label: 'Entrevista de trabajo',
    opening: "Hi! Let's practice a job interview. Can you tell me about yourself?",
  },
  {
    id: 'engineer',
    label: 'Tu trabajo como ingeniero',
    opening:
      "Hi! Let's talk about your work. What does an industrial engineer do at your company?",
  },
  {
    id: 'toefl',
    label: 'Estilo TOEFL: describe una experiencia',
    opening:
      "Hi! Let's practice for the TOEFL speaking section. Describe a time when you solved a difficult problem at work.",
  },
]

export default function VoiceChat({ onBack, onConverse }) {
  // null = todavía no eligió tema, se muestra el menú antes de la conversación.
  const [topic, setTopic] = useState(null)
  const [messages, setMessages] = useState([])
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [textInput, setTextInput] = useState('')
  // Empieza en inglés porque esto es práctica de speaking — el estudiante
  // cambia a español cuando necesite preguntar algo en su idioma.
  const [micLang, setMicLang] = useState('en-US')
  // Lo que el micrófono creyó escuchar, en espera de que el estudiante lo
  // confirme o lo corrija a mano antes de mandarlo — el reconocimiento con
  // acento no nativo se equivoca seguido, y mandarlo sin revisar se siente
  // como que la app "no entiende".
  const [awaitingConfirm, setAwaitingConfirm] = useState(false)
  const [draftText, setDraftText] = useState('')
  const [draftAlternatives, setDraftAlternatives] = useState([])
  const stopRef = useRef(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, interim, awaitingConfirm])

  // Detiene el reconocimiento si el estudiante sale de la pantalla a medio hablar.
  useEffect(() => () => stopRef.current?.(), [])

  function handlePickTopic(t) {
    setTopic(t)
    setMessages([{ role: 'assistant', text: t.opening, lang: 'en' }])
    speak(t.opening)
  }

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
        return [
          ...updated,
          {
            role: 'assistant',
            text: res.reply,
            exampleEn: res.example_en || null,
            lang: res.reply_lang || 'en',
          },
        ]
      })
      speak(res.reply, { lang: res.reply_lang })
      if (res.example_en) {
        // interrupt: false para que se encole después de la respuesta, sin
        // cortarla — dos utterances seguidas, no una reemplazando a la otra.
        speak(res.example_en, { lang: 'en', interrupt: false })
      }
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
      lang: micLang,
      onInterim: setInterim,
      onResult: (text, alternatives) => {
        setListening(false)
        setDraftText(text)
        setDraftAlternatives(alternatives)
        setAwaitingConfirm(true)
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

  function handleConfirmSend() {
    const text = draftText
    setAwaitingConfirm(false)
    setDraftText('')
    setDraftAlternatives([])
    handleUserText(text)
  }

  function handleRetry() {
    setAwaitingConfirm(false)
    setDraftText('')
    setDraftAlternatives([])
  }

  function handleTextSubmit(event) {
    event.preventDefault()
    handleUserText(textInput)
    setTextInput('')
  }

  if (!topic) {
    return (
      <div className="stack">
        <header className="masthead">
          <p className="eyebrow">Práctica de speaking</p>
          <h1>¿Qué quieres practicar hoy?</h1>
          <p className="lede">
            Elige un tema para arrancar la conversación. Puedes elegir otro la próxima vez
            que entres.
          </p>
        </header>

        <div className="voice-topics">
          {TOPICS.map((t) => (
            <button
              key={t.id}
              type="button"
              className="action-btn"
              onClick={() => handlePickTopic(t)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button className="btn ghost" onClick={onBack}>
          Volver a los bloques
        </button>
      </div>
    )
  }

  return (
    <div className="stack">
      <header className="masthead">
        <p className="eyebrow">Práctica de speaking</p>
        <h1>Habla en inglés</h1>
        <p className="lede">
          {listenSupported()
            ? 'Toca el micrófono y contesta en inglés o en español — elige el idioma antes de hablar. Te corrijo en español debajo de lo que dijiste, y te sigo la conversación en el idioma que uses.'
            : 'Tu navegador no puede escucharte por voz — usa Chrome o Edge para eso. Por ahora puedes escribir tus respuestas, en inglés o en español.'}
        </p>
      </header>

      <div className="voice-thread">
        {messages.map((m, i) => (
          <div key={i} className={`voice-msg ${m.role}`}>
            <p className="voice-msg-text">{m.text}</p>
            {m.correction && <p className="voice-correction">{m.correction}</p>}
            {m.exampleEn && (
              <p className="voice-example">
                <span className="feedback-label">Así se dice</span>
                <span className="feedback-expected-row">
                  {m.exampleEn}
                  <SpeakButton text={m.exampleEn} />
                </span>
              </p>
            )}
            {m.role === 'assistant' && (
              <button
                type="button"
                className="voice-slow-btn"
                onClick={() => speak(m.text, { rate: 0.55, lang: m.lang || 'en' })}
              >
                Repetir más lento
              </button>
            )}
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

      {awaitingConfirm ? (
        <div className="voice-confirm">
          <p className="voice-hint">¿Dijiste esto? Corrígelo si el micrófono se equivocó.</p>
          <textarea
            className="input textarea"
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            rows={2}
            autoFocus
          />
          {draftAlternatives.length > 0 && (
            <div className="voice-alternatives">
              {draftAlternatives.map((alt, i) => (
                <button
                  key={i}
                  type="button"
                  className="chip"
                  onClick={() => setDraftText(alt)}
                >
                  {alt}
                </button>
              ))}
            </div>
          )}
          <div className="voice-confirm-actions">
            <button type="button" className="btn ghost" onClick={handleRetry}>
              Grabar de nuevo
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={handleConfirmSend}
              disabled={!draftText.trim()}
            >
              Enviar
            </button>
          </div>
        </div>
      ) : listenSupported() ? (
        <div className="voice-controls">
          <div className="switch-row">
            <span className="switch-label">En qué idioma vas a hablar</span>
            <div className="switch" role="group" aria-label="Idioma del micrófono">
              <button
                type="button"
                className={micLang === 'en-US' ? 'active' : ''}
                onClick={() => setMicLang('en-US')}
                disabled={listening || busy}
              >
                English
              </button>
              <button
                type="button"
                className={micLang === 'es-MX' ? 'active' : ''}
                onClick={() => setMicLang('es-MX')}
                disabled={listening || busy}
              >
                Español
              </button>
            </div>
          </div>
          <button
            type="button"
            className={`voice-mic ${listening ? 'listening' : ''}`}
            onClick={toggleListening}
            disabled={busy}
            aria-label={listening ? 'Detener y revisar' : 'Hablar'}
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
            {listening ? 'Escuchando… toca de nuevo cuando termines' : 'Toca para hablar'}
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
