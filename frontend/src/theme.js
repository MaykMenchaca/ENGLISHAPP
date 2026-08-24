/**
 * Modo claro / oscuro.
 *
 * Interruptor MANUAL que se recuerda entre sesiones — a propósito no sigue
 * `prefers-color-scheme`, para que la elección sea siempre la misma y no
 * cambie sola según la hora o el sistema del estudiante.
 *
 * Mismo patrón que sounds.js: estado en localStorage, aplicado directo al
 * DOM (`document.documentElement.dataset.theme`) para que CSS lo lea con
 * `:root[data-theme="light"]`. Se aplica al importarse, no solo al llamar
 * setTheme(), para que el tema ya esté puesto antes del primer render de
 * React y no haya parpadeo del oscuro por defecto.
 */

const STORAGE_KEY = 'tutor-theme'

export function getTheme() {
  return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark'
}

export function setTheme(theme) {
  localStorage.setItem(STORAGE_KEY, theme)
  document.documentElement.dataset.theme = theme
}

if (typeof document !== 'undefined') {
  document.documentElement.dataset.theme = getTheme()
}
