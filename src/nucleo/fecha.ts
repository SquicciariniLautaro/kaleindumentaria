const dosDigitos = (n: number): string => String(n).padStart(2, '0')

/**
 * Fecha del dispositivo como AAAA-MM-DD.
 * No usar toISOString(): devuelve la fecha en UTC y, en Argentina, después de
 * las 21:00 ya es "mañana".
 */
export function fechaLocal(d: Date = new Date()): string {
  return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`
}

/** AAAA-MM-DD → DD/MM/AAAA para mostrar en pantalla. */
export function fechaParaMostrar(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-')
  if (!anio || !mes || !dia) return fecha
  return `${dia}/${mes}/${anio}`
}

function aUtc(fecha: string): number {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return Date.UTC(anio ?? 0, (mes ?? 1) - 1, dia ?? 1)
}

const MS_POR_DIA = 86_400_000

/** Días corridos entre dos fechas AAAA-MM-DD. */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aUtc(hasta) - aUtc(desde)) / MS_POR_DIA)
}

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(aUtc(fecha) + dias * MS_POR_DIA)
  return `${d.getUTCFullYear()}-${dosDigitos(d.getUTCMonth() + 1)}-${dosDigitos(d.getUTCDate())}`
}

/** Primer día del mes de una fecha: 2026-10-05 → 2026-10-01. */
export function inicioDeMes(fecha: string): string {
  return `${fecha.slice(0, 7)}-01`
}
