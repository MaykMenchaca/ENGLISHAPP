import { useState } from 'react'
import SpeakButton from './SpeakButton.jsx'

/**
 * "¿Cómo digo esto?" — para cuando lo que el estudiante quería decir no tenía
 * nada que ver con el ejercicio. Empieza cerrada (un enlace discreto) para no
 * competir con el feedback del ejercicio, que es lo principal de la pantalla.
 */
export default function SayItBox({ onSayIt, attemptPrefill = '' }) {
  const [open, setOpen] = useState(false)
  const [spanish, setSpanish] = useState('')
  const [attempt, setAttempt] = useState(attemptPrefill)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!spanish.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      setResult(await onSayIt(spanish.trim(), attempt.trim()))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button type="button" className="say-it-toggle" onClick={() => setOpen(true)}>
        ¿Cómo digo lo que en realidad quería decir?
      </button>
    )
  }

  return (
    <div className="say-it-box">
      <p className="feedback-label">¿Qué querías decir?</p>
      <form onSubmit={handleSubmit} className="say-it-form">
        <input
          className="input"
          value={spanish}
          onChange={(e) => setSpanish(e.target.value)}
          placeholder="Escribe en español lo que en realidad querías decir…"
          disabled={busy || !!result}
          autoFocus
        />
        <input
          className="input"
          value={attempt}
          onChange={(e) => setAttempt(e.target.value)}
          placeholder="¿Cómo lo intentaste en inglés? (opcional)"
          disabled={busy || !!result}
        />
        {!result && (
          <button className="btn primary" type="submit" disabled={busy || !spanish.trim()}>
            {busy ? 'Buscando…' : '¿Cómo se dice?'}
          </button>
        )}
      </form>

      {error && <p className="error">{error}</p>}

      {result && (
        <div className="say-it-result">
          <p className="feedback-expected-row">
            <span className="say-it-english">{result.english}</span>
            <SpeakButton text={result.english} />
          </p>
          <p className="feedback-text">{result.feedback}</p>
          {result.alternative && (
            <p className="feedback-es">
              <span className="feedback-label">También puedes decir</span>
              {result.alternative}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
