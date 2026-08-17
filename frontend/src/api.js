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

// { default: 'gemini' | null, options: ['gemini', 'deepseek', ...] }
// "options" solo trae los que tienen clave puesta en el servidor.
export const getProviders = () => request('/api/providers')

export const evaluate = (wordId, mode, userAnswer, format = 'text', provider = null) =>
  request('/api/evaluate', {
    method: 'POST',
    body: JSON.stringify({
      word_id: wordId,
      mode,
      user_answer: userAnswer,
      format,
      provider,
    }),
  })

export const freePractice = (wordIds, userAnswer, provider = null) =>
  request('/api/free-practice', {
    method: 'POST',
    body: JSON.stringify({ word_ids: wordIds, user_answer: userAnswer, provider }),
  })
