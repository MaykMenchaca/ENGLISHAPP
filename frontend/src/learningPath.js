// El orden recomendado para estudiar, no la única forma de hacerlo — todos los
// bloques siguen abiertos desde el selector normal. Cruza tracks a propósito:
// la gramática de "Estructura" hace falta antes que cualquier vocabulario, y
// los conectores viven en el bloque 10 de "Inglés básico" — aquí se adelantan
// sin renumerar nada, solo cambiando el orden en que se sugieren.
//
// "reason" se muestra como una línea de contexto bajo cada paso. Se deja vacío
// en los bloques que ya no necesitan explicación (siguen el tema del anterior).
export const LEARNING_PATH = [
  { track: 'structure', week: 1, reason: 'La base: quién hace la acción en la oración.' },
  { track: 'structure', week: 2, reason: 'El verbo más usado del inglés: to be.' },
  { track: 'structure', week: 3, reason: 'Para nombrar y señalar cosas con precisión.' },
  { track: 'basic', week: 1, reason: 'Tu primera conversación real: saludos.' },
  { track: 'structure', week: 4, reason: 'Para ubicar lugares, tiempos y personas.' },
  { track: 'basic', week: 10, reason: 'Los conectores: el pegamento entre tus ideas.' },
  { track: 'structure', week: 5, reason: 'Para poder preguntar cualquier cosa.' },
  { track: 'structure', week: 6, reason: "Preguntas, negaciones y decir que “hay” algo." },
  { track: 'basic', week: 3, reason: 'Números, días y hora — los usas todos los días.' },
  { track: 'basic', week: 2, reason: '' },
  { track: 'basic', week: 4, reason: '' },
  { track: 'basic', week: 5, reason: '' },
  { track: 'basic', week: 6, reason: '' },
  { track: 'basic', week: 7, reason: '' },
  { track: 'basic', week: 8, reason: '' },
  { track: 'basic', week: 9, reason: '' },
  { track: 'engineering', week: 1, reason: 'Empieza tu vocabulario técnico de ingeniería.' },
  { track: 'engineering', week: 2, reason: '' },
  { track: 'engineering', week: 3, reason: '' },
  { track: 'engineering', week: 4, reason: '' },
  { track: 'engineering', week: 5, reason: '' },
  { track: 'engineering', week: 6, reason: '' },
  { track: 'engineering', week: 7, reason: '' },
  { track: 'engineering', week: 8, reason: '' },
  { track: 'engineering', week: 9, reason: '' },
  { track: 'engineering', week: 10, reason: '' },
  { track: 'academic', week: 1, reason: 'Vocabulario formal para el TOEFL y los reportes.' },
  { track: 'academic', week: 2, reason: '' },
  { track: 'academic', week: 3, reason: '' },
  { track: 'academic', week: 4, reason: '' },
  { track: 'academic', week: 5, reason: '' },
]

// Mismos umbrales en toda la app: coincide con lo que ya usa /api/stats para
// que "dominado" signifique lo mismo aquí que en la pantalla de Progreso.
export function isMastered(sectionStats) {
  if (!sectionStats) return false
  return sectionStats.coverage >= 0.8 && sectionStats.accuracy !== null && sectionStats.accuracy >= 0.7
}
