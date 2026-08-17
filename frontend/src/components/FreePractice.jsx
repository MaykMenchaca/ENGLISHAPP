import { useRef, useState } from 'react'
import FeedbackPanel from './FeedbackPanel.jsx'

export default function FreePractice({ words, onSubmit, onFinish }) {
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const areaRef = useRef(null)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!text.trim() || busy || result) return

    setBusy(true)
    setError(null)
    try {
      setResult(await onSubmit(text.trim()))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <div className="progress-line">
        <span>Práctica libre</span>
        <span className="mode-chip">Escritura</span>
      </div>

      <div className="card">
        <p className="prompt-label">Escribe 2 o 3 frases en inglés usando estas palabras</p>
        <p className="word-chips">
          {words.map((w) => (
            <span className="chip" key={w.id}>
              {w.term}
            </span>
          ))}
        </p>

        <form onSubmit={handleSubmit}>
          <textarea
            ref={areaRef}
            className="input textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribe aquí en inglés. No importa si te equivocas."
            rows={5}
            disabled={busy || !!result}
          />
          {!result && (
            <button className="btn primary" type="submit" disabled={busy || !text.trim()}>
              {busy ? 'Revisando…' : 'Revisar mi texto'}
            </button>
          )}
        </form>

        {error && <p className="error">{error}</p>}
      </div>

      <FeedbackPanel result={result} onNext={onFinish} nextLabel="Terminar sesión" />
    </div>
  )
}
