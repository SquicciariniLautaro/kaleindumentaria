import { useState } from 'react'
import { leerCotizacion, leerDecimal, leerMonto, type Centavos } from '../nucleo/dinero'

/** Estado de un formulario: todos los campos son texto y se validan al guardar. */
export function useCampos<T extends Record<string, string>>(inicial: T) {
  const [valores, setValores] = useState(inicial)
  const poner =
    <K extends keyof T>(campo: K) =>
    (valor: T[K]) =>
      setValores((previos) => ({ ...previos, [campo]: valor }))
  return { v: valores, poner, setValores }
}

// Validaciones para usar dentro de alGuardar de una Hoja: si el dato está mal, lanzan el mensaje a mostrar.

export function exigirTexto(texto: string, nombre: string): string {
  const limpio = texto.trim()
  if (!limpio) throw new Error(`Falta completar: ${nombre}`)
  return limpio
}

export function exigirMonto(texto: string, nombre: string, opciones: { permiteCero?: boolean } = {}): Centavos {
  const monto = leerMonto(texto.trim() === '' && opciones.permiteCero ? '0' : texto)
  if (monto === null || (monto === 0 && !opciones.permiteCero)) throw new Error(`${nombre}: ingresá un monto válido`)
  return monto
}

export function exigirEntero(texto: string, nombre: string, minimo = 1): number {
  const numero = /^\d+$/.test(texto.trim()) ? Number(texto.trim()) : NaN
  if (!Number.isSafeInteger(numero) || numero < minimo) {
    throw new Error(`${nombre}: ingresá un número entero${minimo > 0 ? ` de ${minimo} o más` : ''}`)
  }
  return numero
}

export function exigirCotizacion(texto: string, nombre: string): number {
  const cotizacion = leerCotizacion(texto)
  if (!cotizacion) throw new Error(`${nombre}: ingresá cuántos pesos vale 1 unidad`)
  return cotizacion
}

/** Porcentaje con hasta dos decimales. Vacío = null (usar el valor por defecto). */
export function leerPorcentaje(texto: string, nombre: string): number | null {
  if (texto.trim() === '') return null
  const centesimas = leerDecimal(texto, 2)
  if (centesimas === null) throw new Error(`${nombre}: ingresá un porcentaje válido`)
  return centesimas / 100
}
