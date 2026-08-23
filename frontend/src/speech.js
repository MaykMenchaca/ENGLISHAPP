/**
 * Pronunciación con la Web Speech API del navegador.
 *
 * Sin costo ni API externa: las voces vienen del sistema operativo. En Windows
 * hay voces en-US instaladas localmente, así que funciona incluso sin internet.
 */

// Una voz cacheada por idioma ('en' | 'es'). El resto de la app solo pide inglés
// (vocabulario, oraciones de ejemplo); el chat de voz es el único que también
// pide español, para leer sus propias respuestas bilingües.
const cachedVoices = {}
let voicesReady = false

/** Elige la mejor voz disponible para el prefijo de idioma dado. Prioriza la
 *  variante regional más común y las voces locales (las remotas de Google no
 *  funcionan sin conexión). */
function pickVoice(langPrefix) {
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null

  const matches = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith(langPrefix))
  if (!matches.length) return null

  const preferred = langPrefix === 'es' ? 'es-mx' : 'en-us'
  return (
    matches.find((v) => v.lang.toLowerCase() === preferred && v.localService) ||
    matches.find((v) => v.lang.toLowerCase() === preferred) ||
    matches.find((v) => v.localService) ||
    matches[0]
  )
}

/** El navegador carga las voces de forma asíncrona: al primer getVoices() suele
 *  devolver una lista vacía. Se resuelve escuchando voiceschanged. */
function ensureVoices() {
  if (voicesReady) return
  cachedVoices.en = pickVoice('en')
  cachedVoices.es = pickVoice('es')
  if (cachedVoices.en) {
    voicesReady = true
    return
  }
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices.en = pickVoice('en')
    cachedVoices.es = pickVoice('es')
    voicesReady = !!cachedVoices.en
  }
}

export function speechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/**
 * Lee un texto en voz alta.
 * @param {string} text
 * @param {{rate?: number, lang?: 'en'|'es'}} [options] rate por debajo de 1 = más
 *   lento, útil para aprender. lang por default es 'en' — el resto de la app nunca
 *   necesita tocar esto, solo el chat de voz pide 'es'.
 */
export function speak(text, { rate = 0.9, lang = 'en' } = {}) {
  if (!speechSupported() || !text) return

  ensureVoices()
  if (!cachedVoices[lang]) cachedVoices[lang] = pickVoice(lang)
  const voice = cachedVoices[lang]

  // Sin esto, tocar varias veces seguidas encola los audios y se acumulan.
  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = voice?.lang || (lang === 'es' ? 'es-MX' : 'en-US')
  // Marcar el idioma no basta: sin voz explícita el navegador puede leer inglés
  // con la voz en español del sistema, y suena incomprensible.
  if (voice) utterance.voice = voice
  utterance.rate = rate
  window.speechSynthesis.speak(utterance)
}

// Se dispara temprano para que la primera pulsación ya tenga la voz lista.
if (speechSupported()) ensureVoices()
