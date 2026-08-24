import { useEffect, useState } from 'react'
import { speak, speechSupported } from '../speech.js'
import { SENTENCES } from '../speakingContent.js'

/**
 * "Escucha y traduce": el sentido contrario a Escribir frases — aquí la IA
 * dice la frase en inglés y el estudiante escribe qué entendió en español.
 * Comparte el mismo banco de frases que PronunciationDrill (speakingContent.js);
 * la calificación es de la IA (translateCheck), con manga ancha para paráfrasis.
 */
export default function Dictation({ onTranslateCheck, onBack }) {
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const sentence = SENTENCES[index]

  // Se lee sola al entrar y cada vez que cambia la frase — así no hace falta
  // tocar nada para empezar a escuchar.
  useEffect(() => {
    speak(sentence)
  }, [sentence])

  async function handleSubmit(event) {
    event.preventDefault()
    if (!answer.trim() || busy || result) return
    setBusy(true)
    setError(null)
    try {
      const res = await onTranslateCheck(sentence, answer.trim())
      setResult(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function next() {
    setIndex((i) => (i + 1) % SENTENCES.length)
    setAnswer('')
    setResult(null)
    setError(null)
  }

  return (
    <div className="stack">
      <header className="masthead">
        <p className="eyebrow">Hablar · Escucha y traduce</p>
        <h1>¿Qué entendiste?</h1>
        <p className="lede">
          Te leo una frase en inglés. Escribe qué significa en español — no tiene que ser
          palabra por palabra, basta con que captes la idea.
        </p>
      </header>

      <div className="progress-line">
        <span>
          Frase {index + 1} de {SENTENCES.length}
        </span>
      </div>

      <div className="card">
        {speechSupported() && (
          <div className="drill-audio">
            <button type="button" className="btn ghost" onClick={() => speak(sentence)}>
              Escuchar otra vez
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => speak(sentence, { rate: 0.55 })}
            >
              Escuchar más lento
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <input
            className="input"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Escribe en español qué entendiste…"
            disabled={busy || !!result}
            autoComplete="off"
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
          {result.corrected && (
            <p className="feedback-corrected">
              <span className="feedback-label">Así se traduce</span>
              {result.corrected}
            </p>
          )}
          <p className="feedback-text">{result.feedback}</p>
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
