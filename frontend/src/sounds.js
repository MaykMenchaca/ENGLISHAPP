/**
 * Tonos cortos de acierto y error, generados con la Web Audio API.
 *
 * Sin archivos de audio ni CDN: se sintetizan en el momento, así que no pesan
 * nada en el bundle y funcionan sin conexión — el mismo criterio que speech.js.
 *
 * Los tonos son suaves a propósito: ondas triangulares (más redondas que la
 * cuadrada o la sierra) y una envolvente que sube y baja rápido, para que nunca
 * chasqueen ni rechinen. El de error va en registro medio, no grave: avisa que
 * fallaste sin sonar a castigo.
 */

const STORAGE_KEY = 'tutor-sounds'

let audioContext = null

export function soundsEnabled() {
  if (typeof localStorage === 'undefined') return true
  // Activados salvo que los haya apagado explícitamente.
  return localStorage.getItem(STORAGE_KEY) !== 'off'
}

export function setSoundsEnabled(enabled) {
  localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off')
}

/** El navegador bloquea el audio hasta que hay una interacción del usuario, así
 *  que el contexto se crea en el primer sonido — que siempre viene de un clic. */
function getContext() {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext || window.webkitAudioContext
  if (!Ctor) return null

  if (!audioContext) audioContext = new Ctor()
  // Si el navegador lo suspendió (pestaña en segundo plano), reactivarlo.
  if (audioContext.state === 'suspended') audioContext.resume()
  return audioContext
}

/**
 * Toca una nota.
 * @param {number} freq frecuencia en Hz
 * @param {number} startAt segundos de retraso desde ahora
 * @param {number} duration segundos que dura
 * @param {number} peak volumen máximo (0-1)
 */
function tone(ctx, freq, startAt, duration, peak = 0.18) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'triangle'
  osc.frequency.value = freq

  // Envolvente: un ataque muy corto evita el "clic" de empezar de golpe, y la
  // caída exponencial hace que la nota se apague sola en vez de cortarse seco.
  const t0 = ctx.currentTime + startAt
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)

  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + duration + 0.02)
}

/** Dos notas ascendentes: mi → sol de la quinta octava. Corto y alegre. */
export function playCorrect() {
  if (!soundsEnabled()) return
  const ctx = getContext()
  if (!ctx) return
  tone(ctx, 659.25, 0, 0.12) // E5
  tone(ctx, 783.99, 0.09, 0.18) // G5
}

/** Dos notas descendentes en registro medio: se nota el fallo sin ser hostil. */
export function playWrong() {
  if (!soundsEnabled()) return
  const ctx = getContext()
  if (!ctx) return
  tone(ctx, 392.0, 0, 0.12, 0.14) // G4
  tone(ctx, 329.63, 0.1, 0.2, 0.14) // E4
}

/** Arpegio de tres notas para cerrar una ronda del juego. */
export function playFinish() {
  if (!soundsEnabled()) return
  const ctx = getContext()
  if (!ctx) return
  tone(ctx, 523.25, 0, 0.12) // C5
  tone(ctx, 659.25, 0.1, 0.12) // E5
  tone(ctx, 783.99, 0.2, 0.28) // G5
}
