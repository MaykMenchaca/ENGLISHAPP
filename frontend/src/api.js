// App registra aquí qué hacer cuando el servidor responde 401 (sesión expirada o
// ausente), para volver al login en vez de mostrar un error críptico.
let onUnauthorized = () => {}
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn
}

async function request(path, options = {}) {
  const res = await fetch(path, {
    // Sin esto el navegador no manda la cookie de sesión en desarrollo, donde el
    // frontend (5173) y la API (8000) son orígenes distintos.
    credentials: 'include',
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
    if (res.status === 401) onUnauthorized()
    throw new Error(detail)
  }

  return res.json()
}

// --- sesión ---
export const getMe = () => request('/api/me')

export const login = (username, password) =>
  request('/api/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })

export const logout = () => request('/api/logout', { method: 'POST' })

export const getLessons = (track = 'engineering') =>
  request(`/api/lessons?track=${track}`)

export const getProgress = (week, track = 'engineering') =>
  request(
    week ? `/api/progress?track=${track}&week=${week}` : `/api/progress?track=${track}`
  )

export const getStats = () => request('/api/stats')

// --- diccionario personal ---
export const getDictionary = () => request('/api/dictionary')

export const addDictionaryEntry = (term, meaning) =>
  request('/api/dictionary', {
    method: 'POST',
    body: JSON.stringify({ term, meaning }),
  })

export const deleteDictionaryEntry = (id) =>
  request(`/api/dictionary/${id}`, { method: 'DELETE' })

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
