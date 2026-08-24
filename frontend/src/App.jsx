import { useEffect, useMemo, useState } from 'react'
import {
  converse,
  evaluate,
  freePractice,
  getLessons,
  getMe,
  getProgress,
  getProviders,
  logout as apiLogout,
  sayIt,
  setUnauthorizedHandler,
} from './api.js'
import Login from './components/Login.jsx'
import LessonSelector from './components/LessonSelector.jsx'
import BlockScreen from './components/BlockScreen.jsx'
import ExerciseCard from './components/ExerciseCard.jsx'
import SessionReview from './components/SessionReview.jsx'
import FreePractice from './components/FreePractice.jsx'
import MatchGame from './components/MatchGame.jsx'
import Dictionary from './components/Dictionary.jsx'
import Settings from './components/Settings.jsx'
import Stats from './components/Stats.jsx'
import RutaScreen from './components/RutaScreen.jsx'
import SpeakScreen from './components/SpeakScreen.jsx'
import { setSoundsEnabled, soundsEnabled } from './sounds.js'
import { getTheme, setTheme } from './theme.js'

const WORDS_PER_SESSION = 5
const MODES = ['meaning', 'completion']
const OPTIONS_PER_QUESTION = 4

function shuffle(list) {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** Resume el progreso por sección, para las barras del selector. */
function aggregateByWeek(items) {
  const byWeek = {}
  for (const item of items) {
    const bucket = (byWeek[item.week] ||= { attempted: 0, correct: 0, total: 0 })
    if (item.attempts > 0) bucket.attempted += 1
    bucket.correct += item.correct
    bucket.total += item.attempts
  }
  for (const bucket of Object.values(byWeek)) {
    bucket.accuracy = bucket.total ? bucket.correct / bucket.total : null
  }
  return byWeek
}

/** 1 respuesta correcta + 3 distractores tomados de la misma semana. */
function buildOptions(word, mode, pool) {
  const field = mode === 'meaning' ? 'spanish' : 'term'
  const correct = word[field]
  const distractors = shuffle(
    pool.filter((w) => w.id !== word.id).map((w) => w[field])
  )
    .filter((value, i, arr) => value !== correct && arr.indexOf(value) === i)
    .slice(0, OPTIONS_PER_QUESTION - 1)

  return shuffle([correct, ...distractors])
}

export default function App() {
  const [weeks, setWeeks] = useState([])
  const [progress, setProgress] = useState({})
  const [loading, setLoading] = useState(true)
  const [fatalError, setFatalError] = useState(null)

  // null = todavía no sabemos si hay sesión (evita parpadear el login al cargar)
  const [authenticated, setAuthenticated] = useState(null)

  // Bloque elegido en la rejilla ({track, week, sectionName}) y qué actividad
  // hace con él (null = todavía viendo BlockScreen, sin haber elegido nada).
  // Antes "Jugar" y "Escribir frases" volvían a preguntar track+bloque en sus
  // propias pantallas; ahora el bloque se elige una sola vez aquí.
  const [selectedBlock, setSelectedBlock] = useState(null)
  const [activity, setActivity] = useState(null) // null | 'practice' | 'game' | 'write'
  const [writeWords, setWriteWords] = useState(null) // palabras para la actividad "write"

  // Estado de la sesión de práctica (actividad "practice")
  const [session, setSession] = useState(null) // { week, words, pool }
  const [step, setStep] = useState(0) // índice sobre words * MODES
  const [finished, setFinished] = useState(false)

  // 'choice' (opciones) o 'text' (escribir). Se recuerda entre sesiones.
  const [format, setFormat] = useState(
    () => localStorage.getItem('tutor-format') || 'choice'
  )

  function changeFormat(next) {
    setFormat(next)
    localStorage.setItem('tutor-format', next)
  }

  // Motores de IA con clave configurada en el servidor. Vacío hasta que
  // responda /api/providers; el switch no se pinta mientras tanto.
  const [providerOptions, setProviderOptions] = useState([])
  const [provider, setProvider] = useState(() => localStorage.getItem('tutor-provider'))

  function changeProvider(next) {
    setProvider(next)
    localStorage.setItem('tutor-provider', next)
  }

  // El valor real vive en sounds.js (localStorage) para que MatchGame y demás
  // lo lean sin pasarlo por props; aquí solo se espeja para repintar el botón.
  const [sounds, setSounds] = useState(() => soundsEnabled())

  function changeSounds(next) {
    setSounds(next)
    setSoundsEnabled(next)
  }

  // Igual que sounds: el valor real vive en theme.js (localStorage + atributo
  // en <html>), aquí solo se espeja para repintar el interruptor de Ajustes.
  const [theme, setThemeState] = useState(() => getTheme())

  function changeTheme(next) {
    setThemeState(next)
    setTheme(next)
  }

  // 'structure' | 'engineering' | 'basic' | 'academic'. Empieza en 'structure'
  // para quien nunca ha elegido nada — es el primer paso de la ruta recomendada.
  const [track, setTrack] = useState(
    () => localStorage.getItem('tutor-track') || 'structure'
  )
  const [showDictionary, setShowDictionary] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [showRuta, setShowRuta] = useState(false)
  const [showVoice, setShowVoice] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  function changeTrack(next) {
    setTrack(next)
    localStorage.setItem('tutor-track', next)
  }

  // Cualquier 401 (sesión expirada a media sesión) devuelve al login.
  useEffect(() => {
    setUnauthorizedHandler(() => setAuthenticated(false))
  }, [])

  // ¿Hay sesión? Se pregunta una vez al cargar.
  useEffect(() => {
    let alive = true
    getMe()
      .then((d) => alive && setAuthenticated(d.authenticated))
      .catch(() => alive && setAuthenticated(false))
    return () => {
      alive = false
    }
  }, [])

  async function handleLogout() {
    try {
      await apiLogout()
    } catch {
      // aunque falle en el servidor, localmente volvemos al login
    }
    setSession(null)
    setSelectedBlock(null)
    setActivity(null)
    setShowDictionary(false)
    setAuthenticated(false)
  }

  // Se vuelve a cargar al cambiar de track o al iniciar sesión.
  useEffect(() => {
    if (!authenticated) return
    let alive = true
    setLoading(true)
    ;(async () => {
      try {
        const [lessons, prog, providersRes] = await Promise.all([
          getLessons(track),
          getProgress(null, track),
          getProviders(),
        ])
        if (!alive) return

        setWeeks(lessons.weeks)
        setProviderOptions(providersRes.options)
        // Si lo guardado en localStorage ya no está disponible (o nunca eligió),
        // cae en el proveedor por defecto del servidor.
        setProvider((prev) =>
          prev && providersRes.options.includes(prev) ? prev : providersRes.default
        )
        setProgress(aggregateByWeek(prog.items))
      } catch (err) {
        if (alive) setFatalError(err.message)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [track, authenticated])

  // trackOverride existe para saltos entre tracks: el estado `track` tarda un
  // render en actualizarse, así que no sirve leerlo aquí mismo tras cambiarlo.
  async function startWeek(week, trackOverride) {
    const activeTrack = trackOverride || track
    setLoading(true)
    setFatalError(null)
    try {
      const prog = await getProgress(week, activeTrack)

      // Tres grupos por prioridad: nunca vistas, falladas, y dominadas.
      // Se baraja DENTRO de cada grupo para que no salgan siempre las mismas
      // palabras, sin perder el criterio de insistir en lo que peor domina.
      const nuevas = prog.items.filter((w) => w.attempts === 0)
      const flojas = prog.items.filter((w) => w.attempts > 0 && (w.accuracy ?? 0) < 1)
      const dominadas = prog.items.filter((w) => w.attempts > 0 && (w.accuracy ?? 0) >= 1)
      const ranked = [...shuffle(nuevas), ...shuffle(flojas), ...shuffle(dominadas)]

      // pool = todas las palabras de la sección, para sacar distractores creíbles
      setSession({ week, words: ranked.slice(0, WORDS_PER_SESSION), pool: prog.items })
      setStep(0)
      setFinished(false)
    } catch (err) {
      setFatalError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const current = useMemo(() => {
    if (!session) return null
    const totalSteps = session.words.length * MODES.length
    if (step >= totalSteps) return null
    const word = session.words[Math.floor(step / MODES.length)]
    const mode = MODES[step % MODES.length]
    return {
      word,
      mode,
      wordIndex: Math.floor(step / MODES.length),
      // Se recalculan solo cuando cambia el ejercicio, no en cada render
      options: format === 'choice' ? buildOptions(word, mode, session.pool) : [],
    }
  }, [session, step, format])

  // "¿Cómo digo esto?" — consulta libre, no ligada al ejercicio en curso.
  function handleSayIt(spanish, attempt) {
    return sayIt(spanish, attempt, provider)
  }

  // Chat de voz: no depende de una sesión de bloque, así que vive aparte.
  function handleConverse(chatMessages) {
    return converse(chatMessages, provider)
  }

  // Entrar a un bloque desde cualquiera de los tres caminos (rejilla,
  // "siguiente recomendado", Ruta): cambia la pestaña activa si hace falta
  // y muestra BlockScreen, sin arrancar nada todavía.
  function openBlock(blockTrack, week, sectionName) {
    if (blockTrack !== track) changeTrack(blockTrack)
    setSelectedBlock({ track: blockTrack, week, sectionName })
    setActivity(null)
    setSession(null)
    setStep(0)
    setFinished(false)
    setWriteWords(null)
  }

  function handleSelectBlock(week, sectionName) {
    openBlock(track, week, sectionName)
  }

  function handleJump(jumpTrack, week, sectionName) {
    setShowRuta(false)
    openBlock(jumpTrack, week, sectionName)
  }

  function handlePractice() {
    setActivity('practice')
    startWeek(selectedBlock.week, selectedBlock.track)
  }

  function handleGame() {
    setActivity('game')
  }

  async function handleWrite() {
    setLoading(true)
    setFatalError(null)
    try {
      const prog = await getProgress(selectedBlock.week, selectedBlock.track)
      setWriteWords(shuffle(prog.items).slice(0, WORDS_PER_SESSION))
      setActivity('write')
    } catch (err) {
      setFatalError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Vuelve a BlockScreen (no a la rejilla entera): dentro de un bloque puede
  // querer probar otra actividad sin tener que volver a buscarlo.
  function backToBlock() {
    setActivity(null)
    setSession(null)
    setStep(0)
    setFinished(false)
    setWriteWords(null)
    // Refresca las barras de la rejilla con lo que acaba de practicar
    getProgress(null, track)
      .then((prog) => setProgress(aggregateByWeek(prog.items)))
      .catch(() => {})
  }

  function backToSelector() {
    setSelectedBlock(null)
    setActivity(null)
    setSession(null)
    setStep(0)
    setFinished(false)
    setWriteWords(null)
  }

  // Estos dos van ANTES que cualquier otra pantalla: sin sesión no se muestra nada.
  if (authenticated === null) {
    return (
      <main className="shell">
        <p className="lede">Cargando…</p>
      </main>
    )
  }

  if (!authenticated) {
    return (
      <main className="shell">
        <Login
          onSuccess={() => {
            setFatalError(null)
            setAuthenticated(true)
          }}
        />
      </main>
    )
  }

  if (fatalError && !session) {
    return (
      <main className="shell">
        <div className="card error-card">
          <h2>No se pudo cargar</h2>
          <p className="error">{fatalError}</p>
          <p className="lede">
            Revisa que el backend esté corriendo y que la base de datos tenga las palabras
            cargadas (<code>python api/seed.py</code>).
          </p>
        </div>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="shell">
        <p className="lede">Cargando…</p>
      </main>
    )
  }

  if (showDictionary) {
    return (
      <main className="shell">
        <Dictionary onBack={() => setShowDictionary(false)} />
      </main>
    )
  }

  if (showStats) {
    return (
      <main className="shell">
        <Stats onBack={() => setShowStats(false)} />
      </main>
    )
  }

  if (showRuta) {
    return (
      <main className="shell">
        <RutaScreen onBack={() => setShowRuta(false)} onStart={handleJump} />
      </main>
    )
  }

  if (showVoice) {
    return (
      <main className="shell">
        <SpeakScreen onBack={() => setShowVoice(false)} onConverse={handleConverse} />
      </main>
    )
  }

  if (showSettings) {
    return (
      <main className="shell">
        <Settings
          format={format}
          onFormat={changeFormat}
          sounds={sounds}
          onSounds={changeSounds}
          providerOptions={providerOptions}
          provider={provider}
          onProvider={changeProvider}
          theme={theme}
          onTheme={changeTheme}
          onBack={() => setShowSettings(false)}
        />
      </main>
    )
  }

  return (
    <main className="shell">
      {!selectedBlock && (
        <LessonSelector
          weeks={weeks}
          progress={progress}
          onStart={handleSelectBlock}
          onJump={handleJump}
          loading={loading}
          track={track}
          onTrack={changeTrack}
          onDictionary={() => setShowDictionary(true)}
          onLogout={handleLogout}
          onStats={() => setShowStats(true)}
          onRuta={() => setShowRuta(true)}
          onVoice={() => setShowVoice(true)}
          onSettings={() => setShowSettings(true)}
        />
      )}

      {selectedBlock && !activity && (
        <BlockScreen
          track={selectedBlock.track}
          week={selectedBlock.week}
          sectionName={selectedBlock.sectionName}
          onPractice={handlePractice}
          onGame={handleGame}
          onWrite={handleWrite}
          onBack={backToSelector}
        />
      )}

      {selectedBlock && activity === 'game' && (
        <MatchGame
          track={selectedBlock.track}
          week={selectedBlock.week}
          sectionName={selectedBlock.sectionName}
          onBack={backToBlock}
        />
      )}

      {selectedBlock && activity === 'write' && writeWords && (
        <>
          <FreePractice
            words={writeWords}
            onSubmit={(text) => freePractice(writeWords.map((w) => w.id), text, provider)}
            onFinish={backToBlock}
            onSayIt={handleSayIt}
          />
          <button className="btn ghost" onClick={backToBlock}>
            Volver al bloque
          </button>
        </>
      )}

      {selectedBlock && activity === 'practice' && session && current && (
        <>
          <ExerciseCard
            key={`${current.word.id}-${current.mode}`}
            word={current.word}
            mode={current.mode}
            format={format}
            options={current.options}
            index={current.wordIndex}
            total={session.words.length}
            onSubmit={(answer) =>
              evaluate(current.word.id, current.mode, answer, format, provider)
            }
            onNext={() => setStep((s) => s + 1)}
            onSayIt={handleSayIt}
          />
          <button className="btn ghost" onClick={backToBlock}>
            Salir de la sesión
          </button>
        </>
      )}

      {selectedBlock && activity === 'practice' && session && !current && !finished && (
        <SessionReview
          words={session.words}
          onEvaluate={(wordId, answer) =>
            evaluate(wordId, 'meaning', answer, 'recall', provider)
          }
          onFinish={() => setFinished(true)}
          onExit={backToBlock}
        />
      )}

      {selectedBlock && activity === 'practice' && session && finished && (
        <div className="stack">
          <div className="card done-card">
            <h2>Sesión terminada</h2>
            <p className="lede">
              Practicaste {session.words.length} palabras del bloque {session.week}.
              Tu progreso quedó guardado.
            </p>
            <button className="btn primary" onClick={backToBlock}>
              Volver al bloque
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
