const OPTIONS_PER_QUESTION = 4

export function shuffle(list) {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** 1 respuesta correcta + 3 distractores tomados del mismo pool (bloque o sesión). */
export function buildOptions(word, mode, pool) {
  const field = mode === 'meaning' ? 'spanish' : 'term'
  const correct = word[field]
  const distractors = shuffle(
    pool.filter((w) => w.id !== word.id).map((w) => w[field])
  )
    .filter((value, i, arr) => value !== correct && arr.indexOf(value) === i)
    .slice(0, OPTIONS_PER_QUESTION - 1)

  return shuffle([correct, ...distractors])
}
