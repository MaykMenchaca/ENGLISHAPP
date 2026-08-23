import { useMemo, useRef, useState } from 'react'
import FeedbackPanel from './FeedbackPanel.jsx'
import { playCorrect, playWrong } from '../sounds.js'

function normalize(value) {
  return value.toLowerCase().trim()
}

export default function FreePractice({ words, onSubmit, onFinish, onSayIt }) {
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const areaRef = useRef(null)

  // Solo para pintar las fichas: ninguna de estas palabras es obligatoria, así
  // que esto nunca bloquea el envío, solo muestra cuántas ya usó.
  const usedTerms = useMemo(() => {
    const lowerText = normalize(text)
    const found = new Set()
    for (const w of words) {
      const term = normalize(w.term)
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (new RegExp(`\\b${escaped}\\b`).test(lowerText)) found.add(term)
    }
    return found
  }, [text, words])

  async function handleSubmit(event) {
    event.preventDefault()
    if (!text.trim() || busy || result) return

    setBusy(true)
    setError(null)
    try {
      const res = await onSubmit(text.trim())
      setResult(res)
      if (res.correct) playCorrect()
      else playWrong()
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
        <p className="prompt-label">Escribe 2 o 3 frases en inglés</p>
        <p className="prompt-hint">
          Usa al menos 2 de estas palabras — no tienes que usarlas todas.
        </p>
        <p className="word-chips">
          {words.map((w) => (
            <span
              className={`chip ${usedTerms.has(normalize(w.term)) ? 'chip-used' : ''}`}
              key={w.id}
            >
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

      <FeedbackPanel
        result={result}
        onNext={onFinish}
        nextLabel="Terminar sesión"
        onSayIt={onSayIt}
        sayItPrefill={text}
      />
    </div>
  )
}
