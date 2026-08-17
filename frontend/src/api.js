async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!res.ok) {
    let detail = `Error ${res.status}`
    try {
      const body = await res.json()
      if (body.detail) detail = body.detail
    } catch {
      // respuesta sin JSON, nos quedamos con el código
    }
    throw new Error(detail)
  }

  return res.json()
}

export const getLessons = () => request('/api/lessons')

export const getProgress = (week) =>
  request(week ? `/api/progress?week=${week}` : '/api/progress')

export const evaluate = (wordId, mode, userAnswer, format = 'text') =>
  request('/api/evaluate', {
    method: 'POST',
    body: JSON.stringify({ word_id: wordId, mode, user_answer: userAnswer, format }),
  })

export const freePractice = (wordIds, userAnswer) =>
  request('/api/free-practice', {
    method: 'POST',
    body: JSON.stringify({ word_ids: wordIds, user_answer: userAnswer }),
  })
