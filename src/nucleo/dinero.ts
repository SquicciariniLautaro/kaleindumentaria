import { Fraccion, type Numero } from './fraccion'

/** Todo monto se guarda como entero en centavos de su moneda (45.000 pesos = 4_500_000). */
export type Centavos = number

export type Moneda = 'ARS' | 'BOB' | 'USD'
export type MonedaExtranjera = Exclude<Moneda, 'ARS'>
export const MONEDAS: Moneda[] = ['ARS', 'BOB', 'USD']

/** Múltiplos (en pesos) a los que se puede redondear el precio de venta sugerido. */
export const MULTIPLOS_REDONDEO = [100, 50, 25, 20] as const
export type MultiploRedondeo = (typeof MULTIPLOS_REDONDEO)[number]

/** Redondea un monto en centavos al múltiplo de pesos más cercano. Devuelve centavos. */
export function redondearAMultiplo(centavos: Numero, multiploPesos: number): Centavos {
  const paso = multiploPesos * 100
  return Fraccion.de(centavos).dividido(paso).redondear() * paso
}

const conMiles = (entero: number): string => String(entero).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

/** Pesos enteros con formato argentino: 4_339_706 → "$ 43.397". */
export function formatearPesos(centavos: Centavos): string {
  const pesos = Fraccion.razon(centavos, 100).redondear()
  return `${pesos < 0 ? '-' : ''}$ ${conMiles(Math.abs(pesos))}`
}

/** Monto con centavos solo si los tiene: 180_000 → "1.800"; 1_250 → "12,50". Para BOB y USD. */
export function formatearMonto(centavos: Centavos): string {
  const abs = Math.abs(centavos)
  const resto = abs % 100
  const texto = conMiles(Math.trunc(abs / 100)) + (resto ? `,${String(resto).padStart(2, '0')}` : '')
  return centavos < 0 ? `-${texto}` : texto
}

/** Monto para precargar un campo editable, sin puntos de miles: 123_450 → "1234,50". */
export function montoParaEditar(centavos: Centavos): string {
  const resto = centavos % 100
  return String(Math.trunc(centavos / 100)) + (resto ? `,${String(resto).padStart(2, '0')}` : '')
}

/** Cotización (millonésimas de peso) para mostrar o editar: 200_500_000 → "200,5". */
export function formatearCotizacion(micros: number): string {
  const fraccion = String(micros % 1_000_000)
    .padStart(6, '0')
    .replace(/0+$/, '')
  return String(Math.trunc(micros / 1_000_000)) + (fraccion ? `,${fraccion}` : '')
}

/**
 * Lee un número tipeado y lo devuelve como entero con esa cantidad de decimales,
 * o null si no es válido. Acepta "1.234,50", "1234,5", "1234.5" y "1.234"
 * (punto como separador de miles).
 */
export function leerDecimal(texto: string, decimales: number): number | null {
  let t = texto.replace(/[\s$]/g, '')
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '')
  if (!new RegExp(`^\\d+(\\.\\d{1,${decimales}})?$`).test(t)) return null
  const [entero = '0', fraccion = ''] = t.split('.')
  const valor = Number(entero) * 10 ** decimales + Number(fraccion.padEnd(decimales, '0'))
  return Number.isSafeInteger(valor) ? valor : null
}

/** Monto tipeado → centavos. */
export const leerMonto = (texto: string): Centavos | null => leerDecimal(texto, 2)

/** Cotización tipeada → millonésimas de peso. */
export const leerCotizacion = (texto: string): number | null => leerDecimal(texto, 6)
