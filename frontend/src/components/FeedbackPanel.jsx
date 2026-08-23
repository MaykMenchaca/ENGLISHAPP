import SpeakButton from './SpeakButton.jsx'
import SayItBox from './SayItBox.jsx'

export default function FeedbackPanel({
  result,
  onNext,
  nextLabel = 'Siguiente',
  speakText,
  expected,
  expectedIsEnglish = false,
  term,
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

      {/* Dos audios distintos y etiquetados, para que quede claro cuál es cuál:
          antes solo estaba el de la oración y se confundía con la palabra. */}
      {(term || speakText) && (
        <div className="feedback-audio">
          {term && (
            <span className="feedback-audio-item">
              <span className="feedback-audio-label">La palabra</span>
              <SpeakButton text={term} label={`Escuchar «${term}»`} size="sm" />
            </span>
          )}
          {speakText && (
            <span className="feedback-audio-item">
              <span className="feedback-audio-label">La oración completa</span>
              <SpeakButton text={speakText} label="Escuchar la oración completa" size="sm" />
            </span>
          )}
        </div>
      )}

      <div className="feedback-actions">
        <button className="btn primary" onClick={onNext} autoFocus>
          {nextLabel}
        </button>
      </div>

      {onSayIt && <SayItBox onSayIt={onSayIt} attemptPrefill={sayItPrefill} />}
    </div>
  )
}
