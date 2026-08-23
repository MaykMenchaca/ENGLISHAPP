/**
 * Reconocimiento de voz con la Web Speech API del navegador.
 *
 * Es la otra mitad de speech.js: ahí el navegador HABLA, aquí ESCUCHA. Mismo
 * principio — sin costo ni API externa — pero con una limitación real: solo
 * funciona en Chrome y Edge (no Firefox) y exige HTTPS. VoiceChat.jsx cae a
 * un cuadro de texto cuando listenSupported() da false, en vez de romperse.
 */

const SpeechRecognitionImpl =
  typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

export function listenSupported() {
  return !!SpeechRecognitionImpl
}

/**
 * Escucha una sola intervención — sigue escuchando hasta que el propio
 * llamador la detiene (llamando al `stop` que devuelve), no se corta sola
 * con una pausa. Al construir frases en un idioma nuevo, pausar a media
 * oración para pensar la siguiente palabra es normal; con `continuous:
 * false` el navegador interpretaba esa pausa como "ya terminó" y cortaba la
 * frase, lo que se sentía como que la app "no entendía".
 *
 * @param {{
 *   lang?: string,                       // 'en-US' | 'es-MX'; default 'en-US'
 *   onInterim?: (text: string) => void,  // mientras habla, texto parcial
 *   onResult: (text: string, alternatives: string[]) => void, // al terminar,
 *     // texto final (no vacío) y otras interpretaciones que el navegador
 *     // consideró, para ofrecerlas como sugerencias rápidas si la principal
 *     // vino mal — vacío si no hubo ninguna distinta.
 *   onEnd?: () => void,                  // siempre se llama al cerrar, haya o no resultado
 *   onError?: (message: string) => void, // en español, listo para mostrar
 * }} handlers
 * @returns {() => void} stop — termina la escucha y dispara el resultado final
 */
export function listen({ lang = 'en-US', onInterim, onResult, onEnd, onError }) {
  if (!SpeechRecognitionImpl) {
    onError?.('Tu navegador no puede escuchar por voz. Usa Chrome o Edge.')
    return () => {}
  }

  const recognition = new SpeechRecognitionImpl()
  // El navegador solo escucha UN idioma por sesión — no adivina. Si el
  // estudiante habla español con esto en inglés, la transcripción sale
  // corrupta (intenta encajar los sonidos en fonemas de inglés).
  recognition.lang = lang
  recognition.interimResults = true
  // Varias alternativas por si la principal viene mal: se ofrecen como
  // sugerencias rápidas en el paso de confirmar antes de enviar.
  recognition.maxAlternatives = 3
  recognition.continuous = true

  let finalText = ''
  let lastAlternatives = []

  recognition.onresult = (event) => {
    let interim = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]
      if (result.isFinal) {
        finalText += result[0].transcript
        lastAlternatives = Array.from(result).map((alt) => alt.transcript.trim())
      } else {
        interim += result[0].transcript
      }
    }
    if (interim) onInterim?.(interim)
  }

  recognition.onerror = (event) => {
    // 'no-speech' y 'aborted' no son errores reales: el estudiante calló o
    // canceló a propósito (p. ej. tocó el botón de nuevo). Los demás sí.
    const messages = {
      'not-allowed': 'Necesitas dar permiso de micrófono para hablar con la app.',
      'audio-capture': 'No se encontró un micrófono.',
      network: 'Se perdió la conexión mientras escuchaba.',
    }
    if (messages[event.error]) onError?.(messages[event.error])
  }

  recognition.onend = () => {
    const text = finalText.trim()
    if (text) {
      // Sin repetir el texto principal como si fuera "otra" sugerencia.
      const alternatives = lastAlternatives.filter(
        (a) => a && a.toLowerCase() !== text.toLowerCase()
      )
      onResult(text, alternatives)
    }
    onEnd?.()
  }

  recognition.start()

  return () => recognition.stop()
}
