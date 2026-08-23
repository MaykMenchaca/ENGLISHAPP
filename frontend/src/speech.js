/**
 * Pronunciación con la Web Speech API del navegador.
 *
 * Sin costo ni API externa: las voces vienen del sistema operativo. En Windows
 * hay voces en-US instaladas localmente, así que funciona incluso sin internet.
 */

let cachedVoice = null
let voicesReady = false

/** Elige la mejor voz en inglés disponible. Prioriza en-US y voces locales
 *  (las remotas de Google no funcionan sin conexión). */
function pickVoice() {
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null

  const english = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith('en'))
  if (!english.length) return null

  return (
    english.find((v) => v.lang.toLowerCase() === 'en-us' && v.localService) ||
    english.find((v) => v.lang.toLowerCase() === 'en-us') ||
    english.find((v) => v.localService) ||
    english[0]
  )
}

/** El navegador carga las voces de forma asíncrona: al primer getVoices() suele
 *  devolver una lista vacía. Se resuelve escuchando voiceschanged. */
function ensureVoices() {
  if (voicesReady) return
  cachedVoice = pickVoice()
  if (cachedVoice) {
    voicesReady = true
    return
  }
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = pickVoice()
    voicesReady = !!cachedVoice
  }
}

export function speechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/**
 * Lee un texto en inglés en voz alta.
 * @param {string} text
 * @param {{rate?: number}} [options] rate por debajo de 1 = más lento, útil para aprender.
 */
export function speak(text, { rate = 0.9 } = {}) {
  if (!speechSupported() || !text) return

  ensureVoices()
  if (!cachedVoice) cachedVoice = pickVoice()

  // Sin esto, tocar varias veces seguidas encola los audios y se acumulan.
  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = cachedVoice?.lang || 'en-US'
  // Marcar el idioma no basta: sin voz explícita el navegador puede leer inglés
  // con la voz en español del sistema, y suena incomprensible.
  if (cachedVoice) utterance.voice = cachedVoice
  utterance.rate = rate
  window.speechSynthesis.speak(utterance)
}

// Se dispara temprano para que la primera pulsación ya tenga la voz lista.
if (speechSupported()) ensureVoices()
