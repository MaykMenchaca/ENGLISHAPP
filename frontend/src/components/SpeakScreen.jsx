import { useState } from 'react'
import VoiceChat from './VoiceChat.jsx'
import PronunciationDrill from './PronunciationDrill.jsx'
import Phrasebook from './Phrasebook.jsx'

// Antes «Hablar» hacía una sola cosa (conversar) y VoiceChat.jsx ya eran
// 340+ líneas. Un menú de tres prácticas ordena la zona y deja espacio para
// pronunciación y frases sin amontonar todo en un solo componente.
const MODES = [
  {
    id: 'talk',
    label: 'Conversar',
    desc: 'Una charla completa en inglés (o español), con corrección en español.',
  },
  {
    id: 'drill',
    label: 'Escucha y repite',
    desc: 'Practica pronunciación: te digo si el reconocedor te entendió, frase por frase.',
  },
  {
    id: 'phrasebook',
    label: 'Frases útiles',
    desc: 'Frases comunes para platicar, en inglés y su significado en español.',
  },
]

export default function SpeakScreen({ onBack, onConverse }) {
  const [mode, setMode] = useState(null)

  if (mode === 'talk') return <VoiceChat onBack={() => setMode(null)} onConverse={onConverse} />
  if (mode === 'drill') return <PronunciationDrill onBack={() => setMode(null)} />
  if (mode === 'phrasebook') return <Phrasebook onBack={() => setMode(null)} />

  return (
    <div className="stack">
      <header className="masthead">
        <p className="eyebrow">Hablar</p>
        <h1>Practica tu speaking</h1>
        <p className="lede">Elige qué quieres practicar hoy. Puedes cambiar cuando quieras.</p>
      </header>

      <div className="block-activities">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className="block-activity"
            onClick={() => setMode(m.id)}
          >
            <span className="block-activity-title">{m.label}</span>
            <span className="block-activity-desc">{m.desc}</span>
          </button>
        ))}
      </div>

      <button className="btn ghost" onClick={onBack}>
        Volver a los bloques
      </button>
    </div>
  )
}
