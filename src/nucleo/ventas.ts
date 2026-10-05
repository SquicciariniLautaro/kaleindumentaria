import type { Centavos } from './dinero'
import { Fraccion } from './fraccion'
import { aUnidades, type UnidadMedida } from './unidades'

export type LineaVenta = {
  /** Cantidad vendida, en la unidad de venta (3 docenas → 3). */
  cantidad: number
  unidadVenta: UnidadMedida
  /** Precio por unidad de venta, en centavos. Queda fijo al registrar la venta. */
  precio: Centavos
  /** Descuento sobre el total de la línea, en centavos. */
  descuento?: Centavos
}

export type LoteDisponible = { loteId: string; fecha: string; disponible: number }
export type Asignacion = { loteId: string; unidades: number }

export class StockInsuficiente extends Error {
  readonly disponible: number

  constructor(disponible: number, pedido: number) {
    super(`Stock insuficiente: quedan ${disponible} unidades y se pidieron ${pedido}`)
    this.name = 'StockInsuficiente'
    this.disponible = disponible
  }
}

export function totalLinea(linea: LineaVenta): Centavos {
  return linea.cantidad * linea.precio - (linea.descuento ?? 0)
}

/** Reparte las unidades vendidas entre los lotes, empezando por el más viejo. */
export function asignarFifo(lotes: LoteDisponible[], unidades: number): Asignacion[] {
  const disponible = lotes.reduce((total, l) => total + Math.max(l.disponible, 0), 0)
  if (unidades > disponible) throw new StockInsuficiente(disponible, unidades)

  const asignaciones: Asignacion[] = []
  let faltan = unidades
  // sort es estable: a igual fecha se respeta el orden de carga.
  for (const lote of [...lotes].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0))) {
    if (faltan === 0) break
    const tomar = Math.min(faltan, Math.max(lote.disponible, 0))
    if (tomar > 0) asignaciones.push({ loteId: lote.loteId, unidades: tomar })
    faltan -= tomar
  }
  return asignaciones
}

/**
 * Costo histórico de lo vendido, sumando cada lote del que salió.
 * Se redondea al centavo por lote: así la ganancia sumada por venta y la
 * sumada por viaje dan exactamente lo mismo.
 */
export function costoDeAsignaciones(asignaciones: Asignacion[], costoUnitario: Map<string, Fraccion>): Centavos {
  return asignaciones.reduce((total, a) => {
    const costo = costoUnitario.get(a.loteId)
    if (!costo) throw new Error(`No se encontró el costo del lote ${a.loteId}`)
    return total + costo.por(a.unidades).redondear()
  }, 0)
}

/** Ganancia real de una línea (regla 5) = total cobrado − costo histórico de esas unidades. */
export function gananciaLinea(
  linea: LineaVenta,
  asignaciones: Asignacion[],
  costoUnitario: Map<string, Fraccion>,
): Centavos {
  const vendidas = aUnidades(linea.cantidad, linea.unidadVenta)
  const asignadas = asignaciones.reduce((total, a) => total + a.unidades, 0)
  if (vendidas !== asignadas) {
    throw new Error(`La línea vende ${vendidas} unidades pero tiene ${asignadas} asignadas a lotes`)
  }
  return totalLinea(linea) - costoDeAsignaciones(asignaciones, costoUnitario)
}
