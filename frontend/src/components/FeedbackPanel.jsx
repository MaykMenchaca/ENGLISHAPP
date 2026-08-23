import SpeakButton from './SpeakButton.jsx'
import SayItBox from './SayItBox.jsx'

export default function FeedbackPanel({
  result,
  onNext,
  nextLabel = 'Siguiente',
  speakText,
  expected,
  expectedIsEnglish = false,
  onSayIt,
  sayItPrefill,
}) {
  if (!result) return null

  return (
    <div className={`feedback ${result.correct ? 'ok' : 'bad'}`}>
      <p className="feedback-verdict">{result.correct ? 'Correcto' : 'Todavía no'}</p>

      {/* Solo cuando falló: si acertó, ya sabe cuál era. */}
      {!result.correct && expected && (
        <p className="feedback-expected">
          <span className="feedback-label">La respuesta era</span>
          <span className="feedback-expected-row">
            {expected}
            {expectedIsEnglish && <SpeakButton text={expected} />}
          </span>
        </p>
      )}

      {result.corrected && (
        <p className="feedback-corrected">
          <span className="feedback-label">Corregido</span>
          {result.corrected}
        </p>
      )}

      <p className="feedback-text">{result.feedback}</p>

      {/* Solo aquí, ya respondido: durante el ejercicio regalaría la respuesta. */}
      {result.sentence_es && (
        <p className="feedback-es">
          <span className="feedback-label">La oración en español</span>
          {result.sentence_es}
        </p>
      )}

      <div className="feedback-actions">
        <button className="btn primary" onClick={onNext} autoFocus>
          {nextLabel}
        </button>
        {/* Aquí ya se reveló la respuesta, así que oír la oración no la delata */}
        {speakText && (
          <SpeakButton text={speakText} label="Escuchar la oración completa" />
        )}
      </div>

      {onSayIt && <SayItBox onSayIt={onSayIt} attemptPrefill={sayItPrefill} />}
    </div>
  )
}
