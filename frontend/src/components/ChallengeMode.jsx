import { useState } from 'react'
import ChallengeQuiz from './ChallengeQuiz.jsx'
import SessionReview from './SessionReview.jsx'

/**
 * Modo desafío: cubre TODO el vocabulario de un bloque de una sentada, en
 * dos fases cada vez más exigentes — primero eligiendo el significado
 * (ChallengeQuiz, una pasada), luego escribiéndolo de memoria
 * (SessionReview, reutilizado tal cual: ya repite por rondas solo lo que
 * falla hasta dominarlo todo).
 */
export default function ChallengeMode({
  words,
  sectionName,
  onEvaluateChoice,
  onEvaluateRecall,
  onExit,
}) {
  const [phase, setPhase] = useState('quiz') // 'quiz' | 'review' | 'summary'
  const [quizScore, setQuizScore] = useState(null) // { correct, total }

  if (phase === 'quiz') {
    return (
      <ChallengeQuiz
        words={words}
        onEvaluate={onEvaluateChoice}
        onDone={(correct, total) => {
          setQuizScore({ correct, total })
          setPhase('review')
        }}
      />
    )
  }

  if (phase === 'review') {
    return (
      <SessionReview
        words={words}
        onEvaluate={onEvaluateRecall}
        onFinish={() => setPhase('summary')}
        onExit={onExit}
      />
    )
  }

  return (
    <div className="stack">
      <div className="card done-card">
        <h2>Dominaste «{sectionName}»</h2>
        <p className="lede">
          Elegiste el significado correcto de {quizScore?.correct} de {quizScore?.total}{' '}
          palabras a la primera, y las escribiste todas de memoria hasta sacarlas bien.
        </p>
        <button className="btn primary" onClick={onExit}>
          Volver al bloque
        </button>
      </div>
    </div>
  )
}
