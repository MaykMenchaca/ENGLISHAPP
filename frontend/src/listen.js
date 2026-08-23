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
 * Escucha una sola intervención — se detiene sola tras una pausa, como una
 * conversación real por turnos, no una grabación abierta.
 *
 * @param {{
 *   onInterim?: (text: string) => void,  // mientras habla, texto parcial
 *   onResult: (text: string) => void,    // al terminar, texto final (no vacío)
 *   onEnd?: () => void,                  // siempre se llama al cerrar, haya o no resultado
 *   onError?: (message: string) => void, // en español, listo para mostrar
 * }} handlers
 * @returns {() => void} stop — cancela la escucha en curso
 */
export function listen({ onInterim, onResult, onEnd, onError }) {
  if (!SpeechRecognitionImpl) {
    onError?.('Tu navegador no puede escuchar por voz. Usa Chrome o Edge.')
    return () => {}
  }

  const recognition = new SpeechRecognitionImpl()
  recognition.lang = 'en-US'
  recognition.interimResults = true
  recognition.maxAlternatives = 1
  recognition.continuous = false

  let finalText = ''

  recognition.onresult = (event) => {
    let interim = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript
      if (event.results[i].isFinal) finalText += transcript
      else interim += transcript
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
    if (finalText.trim()) onResult(finalText.trim())
    onEnd?.()
  }

  recognition.start()

  return () => recognition.stop()
}
