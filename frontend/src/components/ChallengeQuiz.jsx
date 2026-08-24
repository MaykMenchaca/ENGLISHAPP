import { useState } from 'react'
import SpeakButton from './SpeakButton.jsx'
import { playCorrect, playWrong } from '../sounds.js'
import { buildOptions } from '../wordUtils.js'

/**
 * Fase 1 del modo desafío: una sola pasada por TODAS las palabras del bloque,
 * eligiendo el significado entre 4 opciones (distractores del propio bloque).
 * A diferencia de la sesión normal no hay rondas ni repetición aquí — la
 * fase 2 (SessionReview, reutilizado tal cual) es la que insiste hasta
 * dominarlas todas.
 */
export default function ChallengeQuiz({ words, onEvaluate, onDone }) {
  const [index, setIndex] = useState(0)
  const [options] = useState(() => words.map((w) => buildOptions(w, 'meaning', words)))
  const [chosen, setChosen] = useState(null)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [correctCount, setCorrectCount] = useState(0)

  const word = words[index]

  async function handleChoice(option) {
    if (busy || result) return
    setChosen(option)
    setBusy(true)
    setError(null)
    try {
      const res = await onEvaluate(word.id, option)
      setResult(res)
      if (res.correct) {
        playCorrect()
        setCorrectCount((c) => c + 1)
      } else {
        playWrong()
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function handleNext() {
    if (index + 1 < words.length) {
      setIndex(index + 1)
      setChosen(null)
      setResult(null)
      setError(null)
      return
    }
    onDone(correctCount, words.length)
  }

  const correctValue = word.spanish
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
          Desafío · elegir · palabra {index + 1} de {words.length}
        </span>
        <span className="mode-chip">{correctCount} aciertos</span>
      </div>

      <div className="card">
        <p className="prompt-label">¿Qué significa?</p>
        <div className="term-row">
          <p className="term">{word.term}</p>
          <SpeakButton text={word.term} />
        </div>

        <div className="options">
          {options[index].map((option) => (
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

        {error && <p className="error">{error}</p>}
      </div>

      {result && (
        <div className={`feedback ${result.correct ? 'ok' : 'bad'}`}>
          <p className="feedback-verdict">{result.correct ? 'Correcto' : 'Todavía no'}</p>
          <p className="feedback-text">{result.feedback}</p>
          <div className="feedback-actions">
            <button className="btn primary" onClick={handleNext} autoFocus>
              {index + 1 < words.length ? 'Siguiente' : 'Ir a escribirlas'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
