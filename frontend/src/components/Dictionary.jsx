import { useEffect, useRef, useState } from 'react'
import { addDictionaryEntry, deleteDictionaryEntry, getDictionary } from '../api.js'
import SpeakButton from './SpeakButton.jsx'

export default function Dictionary({ onBack }) {
  const [items, setItems] = useState([])
  const [term, setTerm] = useState('')
  const [meaning, setMeaning] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const termRef = useRef(null)

  useEffect(() => {
    let alive = true
    getDictionary()
      .then((d) => alive && setItems(d.items))
      .catch((err) => alive && setError(err.message))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  async function handleAdd(event) {
    event.preventDefault()
    if (!term.trim() || !meaning.trim() || busy) return

    setBusy(true)
    setError(null)
    try {
      const entry = await addDictionaryEntry(term.trim(), meaning.trim())
      setItems((prev) => [entry, ...prev])
      setTerm('')
      setMeaning('')
      termRef.current?.focus()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id) {
    // Se quita de la lista al instante; si el servidor falla, se restaura.
    const previous = items
    setItems((prev) => prev.filter((e) => e.id !== id))
    try {
      await deleteDictionaryEntry(id)
    } catch (err) {
      setItems(previous)
      setError(err.message)
    }
  }

  return (
    <div className="stack">
      <header className="masthead">
        <p className="eyebrow">Mi diccionario</p>
        <h1>Palabras que voy encontrando</h1>
        <p className="lede">
          Cuando te topes con una palabra nueva fuera de las sesiones, guárdala aquí con
          su significado para no perderla.
        </p>
      </header>

      <div className="card">
        <form onSubmit={handleAdd}>
          <input
            ref={termRef}
            className="input"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Palabra en inglés"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck="false"
          />
          <input
            className="input"
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            placeholder="Qué significa"
          />
          <button
            className="btn primary"
            type="submit"
            disabled={busy || !term.trim() || !meaning.trim()}
          >
            {busy ? 'Guardando…' : 'Guardar palabra'}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </div>

      {loading ? (
        <p className="lede">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="lede">Todavía no has guardado ninguna palabra.</p>
      ) : (
        <>
          <div className="progress-line">
            <span>
              {items.length} {items.length === 1 ? 'palabra guardada' : 'palabras guardadas'}
            </span>
          </div>
          <div className="dict-list">
            {items.map((entry) => (
              <div className="dict-item" key={entry.id}>
                <div className="dict-body">
                  <SpeakButton text={entry.term} size="sm" />
                  <div>
                    <p className="dict-term">{entry.term}</p>
                    <p className="dict-meaning">{entry.meaning}</p>
                  </div>
                </div>
                <button
                  className="dict-delete"
                  onClick={() => handleDelete(entry.id)}
                  aria-label={`Borrar ${entry.term}`}
                  title="Borrar"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <button className="btn ghost" onClick={onBack}>
        Volver a los bloques
      </button>
    </div>
  )
}
