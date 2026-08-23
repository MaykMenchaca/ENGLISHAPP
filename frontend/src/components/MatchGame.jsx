import { useEffect, useMemo, useRef, useState } from 'react'
import { getProgress } from '../api.js'
import { playCorrect, playFinish, playWrong } from '../sounds.js'

const PAIRS_PER_ROUND = 8

function shuffle(list) {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function formatTime(ms) {
  const s = ms / 1000
  return s < 10 ? `${s.toFixed(2)}s` : `${s.toFixed(1)}s`
}

function bestTimeKey(track, week) {
  return `tutor-match-best-${track}-${week}`
}

/** 8 parejas al azar de la sección + las fichas ya mezcladas en un solo mosaico. */
function buildRound(words) {
  const pairs = shuffle(words).slice(0, PAIRS_PER_ROUND)
  const tiles = pairs.flatMap((w) => [
    { key: `t-${w.id}`, pairId: w.id, text: w.term, side: 'term' },
    { key: `s-${w.id}`, pairId: w.id, text: w.spanish, side: 'spanish' },
  ])
  return { pairs, tiles: shuffle(tiles) }
}

export default function MatchGame({ track, week, sectionName, onBack }) {
  const [pool, setPool] = useState(null)
  const [error, setError] = useState(null)
  const [round, setRound] = useState(null) // { pairs, tiles }
  const [selected, setSelected] = useState([]) // hasta 2 keys de fichas
  const [solved, setSolved] = useState(new Set()) // pairId ya emparejados
  const [wrongPair, setWrongPair] = useState(null) // [key, key] mientras se sacude
  const [startedAt, setStartedAt] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [finished, setFinished] = useState(false)
  const [bestMs, setBestMs] = useState(() => {
    const raw = localStorage.getItem(bestTimeKey(track, week))
    return raw ? Number(raw) : null
  })
  const busyRef = useRef(false)

  // Carga las palabras de la sección una vez.
  useEffect(() => {
    let alive = true
    getProgress(week, track)
      .then((prog) => alive && setPool(prog.items))
      .catch((err) => alive && setError(err.message))
    return () => {
      alive = false
    }
  }, [track, week])

  useEffect(() => {
    if (pool && pool.length >= 2) startNewRound(pool)
  }, [pool]) // eslint-disable-line react-hooks/exhaustive-deps

  function startNewRound(items) {
    setRound(buildRound(items))
    setSelected([])
    setSolved(new Set())
    setWrongPair(null)
    setFinished(false)
    setStartedAt(null)
    setElapsed(0)
    busyRef.current = false
  }

  // Cronómetro: arranca en el primer toque, no antes (si tarda en leer las fichas
  // no debería penalizarlo).
  useEffect(() => {
    if (!startedAt || finished) return
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 100)
    return () => clearInterval(id)
  }, [startedAt, finished])

  const pairsTotal = round?.pairs.length ?? 0
  const allSolved = pairsTotal > 0 && solved.size === pairsTotal

  useEffect(() => {
    if (allSolved && !finished) {
      const finalMs = startedAt ? Date.now() - startedAt : 0
      setElapsed(finalMs)
      setFinished(true)
      // Encima del acierto del último par, pero son notas del mismo acorde:
      // se oye como un remate, no como dos sonidos peleándose.
      playFinish()
      if (bestMs === null || finalMs < bestMs) {
        setBestMs(finalMs)
        localStorage.setItem(bestTimeKey(track, week), String(finalMs))
      }
    }
  }, [allSolved, finished, startedAt, bestMs, track, week])

  function handleTap(tile) {
    if (busyRef.current || finished) return
    if (solved.has(tile.pairId)) return
    if (selected.some((k) => k === tile.key)) return

    if (!startedAt) setStartedAt(Date.now())

    const next = [...selected, tile.key]
    setSelected(next)
    if (next.length < 2) return

    busyRef.current = true
    const [aKey, bKey] = next
    const a = round.tiles.find((t) => t.key === aKey)
    const b = round.tiles.find((t) => t.key === bKey)

    if (a.pairId === b.pairId && a.side !== b.side) {
      playCorrect()
      setTimeout(() => {
        setSolved((prev) => new Set(prev).add(a.pairId))
        setSelected([])
        busyRef.current = false
      }, 220) // deja ver el par en verde un instante antes de que desaparezca
    } else {
      playWrong()
      setWrongPair([aKey, bKey])
      setTimeout(() => {
        setWrongPair(null)
        setSelected([])
        busyRef.current = false
      }, 500)
    }
  }

  const tileClass = (tile) => {
    if (solved.has(tile.pairId)) return 'match-tile solved'
    if (wrongPair?.includes(tile.key)) return 'match-tile wrong'
    if (selected.includes(tile.key)) return 'match-tile picked'
    return 'match-tile'
  }

  const isNew = useMemo(
    () => bestMs !== null && finished && elapsed <= bestMs,
    [bestMs, finished, elapsed]
  )

  if (error) {
    return (
      <div className="stack">
        <div className="card error-card">
          <h2>No se pudo cargar</h2>
          <p className="error">{error}</p>
        </div>
        <button className="btn ghost" onClick={onBack}>
          Volver a los bloques
        </button>
      </div>
    )
  }

  if (!round) {
    return (
      <div className="stack">
        <p className="lede">Preparando el juego…</p>
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="progress-line">
        <span>
          Emparejar · {sectionName} · {solved.size}/{pairsTotal}
        </span>
        <span className="mode-chip match-timer">{formatTime(elapsed)}</span>
      </div>

      {bestMs !== null && (
        <p className="match-best">
          Tu mejor tiempo aquí: <strong>{formatTime(bestMs)}</strong>
        </p>
      )}

      <div className="match-grid">
        {round.tiles.map((tile) => (
          <button
            key={tile.key}
            type="button"
            className={tileClass(tile)}
            onClick={() => handleTap(tile)}
            disabled={solved.has(tile.pairId) || finished}
          >
            {tile.text}
          </button>
        ))}
      </div>

      {finished && (
        <div className="feedback ok">
          <p className="feedback-verdict">{isNew ? 'Nuevo récord' : 'Completado'}</p>
          <p className="feedback-text">
            Emparejaste las {pairsTotal} palabras en {formatTime(elapsed)}.
          </p>
          <button className="btn primary" onClick={() => startNewRound(pool)}>
            Jugar otra ronda
          </button>
        </div>
      )}

      <button className="btn ghost" onClick={onBack}>
        Volver a los bloques
      </button>
    </div>
  )
}
