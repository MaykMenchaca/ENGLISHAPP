import { useEffect, useRef, useState } from 'react'
import FeedbackPanel from './FeedbackPanel.jsx'
import SpeakButton from './SpeakButton.jsx'

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

export default function ExerciseCard({
  word,
  mode,
  format,
  options,
  onSubmit,
  onNext,
  index,
  total,
}) {
  const [answer, setAnswer] = useState('')
  const [chosen, setChosen] = useState(null)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  const isMeaning = mode === 'meaning'
  const isChoice = format === 'choice'

  // Al cambiar de ejercicio, limpiamos y devolvemos el foco al input
  useEffect(() => {
    setAnswer('')
    setChosen(null)
    setResult(null)
    setError(null)
    if (!isChoice) inputRef.current?.focus()
  }, [word.id, mode, isChoice])

  async function send(value) {
    if (busy || result) return
    setBusy(true)
    setError(null)
    try {
      setResult(await onSubmit(value))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function handleChoice(option) {
    if (busy || result) return
    setChosen(option)
    send(option)
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!answer.trim()) return
    send(answer.trim())
  }

  // Cuando ya respondimos, marcamos cuál era la correcta
  const correctValue = isMeaning ? word.spanish : word.term
  function choiceClass(option) {
    if (!result) return ''
    if (option === correctValue) return 'correct'
    if (option === chosen) return 'wrong'
    return 'dim'
  }

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
            <div className="term-row">
              <p className="term">{word.term}</p>
              <SpeakButton text={word.term} />
            </div>
          </>
        ) : (
          <>
            <p className="prompt-label">Completa la oración</p>
            <p className="sentence">{blankOut(word.sentence, word.term)}</p>
            {!isChoice && <p className="prompt-hint">Pista: {word.spanish}</p>}
          </>
        )}

        {isChoice ? (
          <div className="options">
            {options.map((option) => (
              <button
                key={option}
                type="button"
                className={`option ${choiceClass(option)}`}
                onClick={() => handleChoice(option)}
                disabled={busy || !!result}
              >
                {option}
              </button>
            ))}
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              className="input"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={
                isMeaning ? 'Escribe el significado…' : 'Escribe la palabra en inglés…'
              }
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
        )}

        {error && <p className="error">{error}</p>}
      </div>

      <FeedbackPanel result={result} onNext={onNext} speakText={word.sentence} />
    </div>
  )
}
