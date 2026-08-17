import { useEffect, useRef, useState } from 'react'
import FeedbackPanel from './FeedbackPanel.jsx'

/** Sustituye el término dentro de la oración por una línea. */
function blankOut(sentence, term) {
  const base = term.replace(/^to\s+/i, '')
  const words = base.split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const last = words[words.length - 1]
  words[words.length - 1] = /y$/i.test(base)
    ? `${last.slice(0, -1)}(?:y|ies|ied|ying)`
    : `${last}(?:s|es|d|ed|ing)?`
  const re = new RegExp(`\\b${words.join('[\\s-]+')}\\b`, 'i')
  return sentence.replace(re, '______')
}

export default function ExerciseCard({ word, mode, onSubmit, onNext, index, total }) {
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  // Al cambiar de ejercicio, limpiamos y devolvemos el foco al input
  useEffect(() => {
    setAnswer('')
    setResult(null)
    setError(null)
    inputRef.current?.focus()
  }, [word.id, mode])

  async function handleSubmit(event) {
    event.preventDefault()
    if (!answer.trim() || busy || result) return

    setBusy(true)
    setError(null)
    try {
      setResult(await onSubmit(answer.trim()))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const isMeaning = mode === 'meaning'

  return (
    <div className="stack">
      <div className="progress-line">
        <span>
          Palabra {index + 1} de {total}
        </span>
        <span className="mode-chip">{isMeaning ? 'Significado' : 'Completar'}</span>
      </div>

      <div className="card">
        {isMeaning ? (
          <>
            <p className="prompt-label">¿Qué significa?</p>
            <p className="term">{word.term}</p>
          </>
        ) : (
          <>
            <p className="prompt-label">Completa la oración</p>
            <p className="sentence">{blankOut(word.sentence, word.term)}</p>
            <p className="prompt-hint">Pista: {word.spanish}</p>
          </>
        )}

        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            className="input"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={isMeaning ? 'Escribe el significado…' : 'Escribe la palabra en inglés…'}
            disabled={busy || !!result}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck="false"
          />
          {!result && (
            <button className="btn primary" type="submit" disabled={busy || !answer.trim()}>
              {busy ? 'Revisando…' : 'Revisar'}
            </button>
          )}
        </form>

        {error && <p className="error">{error}</p>}
      </div>

      <FeedbackPanel result={result} onNext={onNext} />
    </div>
  )
}
