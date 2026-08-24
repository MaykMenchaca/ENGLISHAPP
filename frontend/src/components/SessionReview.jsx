import { useEffect, useRef, useState } from 'react'
import SpeakButton from './SpeakButton.jsx'
import { playCorrect, playWrong } from '../sounds.js'

function shuffle(list) {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * Repaso de cierre: recordar el significado de las palabras de la sesión sin
 * pistas. Recordar (no reconocer entre opciones) es lo que fija el vocabulario,
 * y las que falla vuelven a preguntarse en la siguiente ronda hasta que salen.
 */
export default function SessionReview({ words, onEvaluate, onFinish, onExit }) {
  const [queue, setQueue] = useState(() => shuffle(words))
  const [round, setRound] = useState(1)
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  // Las que falló en la ronda en curso; alimentan la siguiente.
  const [missed, setMissed] = useState([])
  const inputRef = useRef(null)

  const word = queue[index]

  useEffect(() => {
    setAnswer('')
    setResult(null)
    setError(null)
    inputRef.current?.focus()
  }, [word?.id])

  async function handleSubmit(event) {
    event.preventDefault()
    if (!answer.trim() || busy || result) return

    setBusy(true)
    setError(null)
    try {
      const res = await onEvaluate(word.id, answer.trim())
      setResult(res)
      if (res.correct) {
        playCorrect()
      } else {
        playWrong()
        setMissed((prev) => [...prev, word])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function handleNext() {
    if (index + 1 < queue.length) {
      setIndex(index + 1)
      return
    }
    // Fin de la ronda: si quedó algo pendiente, otra vuelta solo con eso.
    if (missed.length > 0) {
      setQueue(shuffle(missed))
      setMissed([])
      setIndex(0)
      setRound(round + 1)
      return
    }
    onFinish()
  }

  if (!word) return null

  const isLastOfRound = index + 1 === queue.length
  const nextLabel = !isLastOfRound
    ? 'Siguiente'
    : missed.length > 0
      ? `Repasar las ${missed.length} que fallaste`
      : 'Terminar sesión'

  return (
    <div className="stack">
      <div className="progress-line">
        <span>
          Repaso · palabra {index + 1} de {queue.length}
          {round > 1 && ` · ronda ${round}`}
        </span>
        <span className="mode-chip">Significado</span>
      </div>

      <div className="card">
        <p className="prompt-label">
          {round === 1
            ? '¿Qué significa? Escríbelo en español'
            : 'Otra vez, para que se te quede: ¿qué significa?'}
        </p>
        <div className="term-row">
          <p className="term">{word.term}</p>
          <SpeakButton text={word.term} />
        </div>

        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            className="input"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Escribe el significado en español…"
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

      {result && (
        <div className={`feedback ${result.correct ? 'ok' : 'bad'}`}>
          <p className="feedback-verdict">{result.correct ? 'Correcto' : 'Todavía no'}</p>

          {/* Al fallar, la respuesta completa: es justo el momento en que se
              aprende, y esta palabra vuelve a salir en la siguiente ronda. */}
          {!result.correct && (
            <p className="feedback-expected">
              <span className="feedback-label">Significa</span>
              {word.spanish}
            </p>
          )}

          <p className="feedback-es">
            <span className="feedback-label">Ejemplo</span>
            {word.sentence}
          </p>

          <div className="feedback-audio">
            <span className="feedback-audio-item">
              <span className="feedback-audio-label">La palabra</span>
              <SpeakButton text={word.term} label={`Escuchar «${word.term}»`} size="sm" />
            </span>
            <span className="feedback-audio-item">
              <span className="feedback-audio-label">La oración completa</span>
              <SpeakButton text={word.sentence} label="Escuchar la oración completa" size="sm" />
            </span>
          </div>

          <div className="feedback-actions">
            <button className="btn primary" onClick={handleNext} autoFocus>
              {nextLabel}
            </button>
          </div>
        </div>
      )}

      <button className="btn ghost" onClick={onExit}>
        Salir de la sesión
      </button>
    </div>
  )
}
