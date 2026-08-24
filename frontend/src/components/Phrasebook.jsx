import SpeakButton from './SpeakButton.jsx'

// Estático a propósito: carga al instante y no gasta cuota de IA. Cada
// frase trae su significado en español, como pidió Mayk.
const GROUPS = [
  {
    title: 'Saludar y presentarte',
    phrases: [
      { en: 'Nice to meet you.', es: 'Mucho gusto.' },
      { en: 'How are you doing today?', es: '¿Cómo estás hoy?' },
      { en: "My name is Mayk, I'm an industrial engineer.", es: 'Me llamo Mayk, soy ingeniero industrial.' },
      { en: "I'm from Mexico.", es: 'Soy de México.' },
      { en: 'What do you do for a living?', es: '¿A qué te dedicas?' },
    ],
  },
  {
    title: 'En el trabajo',
    phrases: [
      { en: 'Can we schedule a meeting for tomorrow?', es: '¿Podemos agendar una junta para mañana?' },
      { en: "I'll send you the report by the end of the day.", es: 'Te mando el reporte antes de que acabe el día.' },
      { en: 'We found a bottleneck in the production line.', es: 'Encontramos un cuello de botella en la línea de producción.' },
      { en: 'Let me double-check the numbers.', es: 'Déjame revisar los números otra vez.' },
      { en: 'Sorry, I missed that — could you repeat it?', es: 'Perdón, no capté eso — ¿lo repites?' },
    ],
  },
  {
    title: 'Entrevista de trabajo',
    phrases: [
      { en: 'Tell me about yourself.', es: 'Cuéntame sobre ti.' },
      { en: 'What are your strengths and weaknesses?', es: '¿Cuáles son tus fortalezas y debilidades?' },
      { en: 'Why do you want to work here?', es: '¿Por qué quieres trabajar aquí?' },
      { en: 'I have experience improving production processes.', es: 'Tengo experiencia mejorando procesos de producción.' },
      { en: 'Do you have any questions for me?', es: '¿Tienes alguna pregunta para mí?' },
    ],
  },
  {
    title: 'Pedir ayuda',
    phrases: [
      { en: "I'm not sure I understood — can you explain it differently?", es: 'No estoy seguro de haber entendido — ¿me lo explicas de otra forma?' },
      { en: 'How do you say this in English?', es: '¿Cómo se dice esto en inglés?' },
      { en: 'Could you speak a little slower, please?', es: '¿Podrías hablar un poco más despacio, por favor?' },
      { en: 'Sorry, what does that word mean?', es: 'Perdón, ¿qué significa esa palabra?' },
      { en: 'Thanks, that makes sense now.', es: 'Gracias, ya le entendí.' },
    ],
  },
]

export default function Phrasebook({ onBack }) {
  return (
    <div className="stack">
      <header className="masthead">
        <p className="eyebrow">Hablar · Frases útiles</p>
        <h1>Frases para platicar</h1>
        <p className="lede">
          Frases comunes en inglés, agrupadas por tema, con su significado en español.
          Toca la bocina para oírlas.
        </p>
      </header>

      {GROUPS.map((g) => (
        <div className="stat-group" key={g.title}>
          <h2 className="stat-group-title">{g.title}</h2>
          <div className="phrase-list">
            {g.phrases.map((p) => (
              <div className="phrase-item" key={p.en}>
                <div>
                  <p className="phrase-en">{p.en}</p>
                  <p className="phrase-es">{p.es}</p>
                </div>
                <SpeakButton text={p.en} />
              </div>
            ))}
          </div>
        </div>
      ))}

      <button className="btn ghost" onClick={onBack}>
        Volver a Hablar
      </button>
    </div>
  )
}
