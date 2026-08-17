export default function FeedbackPanel({ result, onNext, nextLabel = 'Siguiente' }) {
  if (!result) return null

  return (
    <div className={`feedback ${result.correct ? 'ok' : 'bad'}`}>
      <p className="feedback-verdict">{result.correct ? 'Correcto' : 'Todavía no'}</p>

      {result.corrected && (
        <p className="feedback-corrected">
          <span className="feedback-label">Corregido</span>
          {result.corrected}
        </p>
      )}

      <p className="feedback-text">{result.feedback}</p>

      <button className="btn primary" onClick={onNext} autoFocus>
        {nextLabel}
      </button>
    </div>
  )
}
