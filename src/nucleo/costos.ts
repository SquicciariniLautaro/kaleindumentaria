import type { Centavos, Moneda, MonedaExtranjera } from './dinero'
import { Fraccion } from './fraccion'
import { aUnidades, UNIDADES_POR, type UnidadMedida } from './unidades'

const MICROS = 1_000_000

/** Pesos por 1 unidad de moneda extranjera, en millonésimas: 200,50 → 200_500_000. */
export type Cotizaciones = Record<MonedaExtranjera, number>

export type ModoProrrateo = 'unidad' | 'valor' | 'peso'

export type Gasto = { monto: Centavos; moneda: Moneda }

export type Lote = {
  id: string
  /** Cantidad comprada, en la unidad de compra (2 docenas → 2). */
  cantidad: number
  unidadCompra: UnidadMedida
  /** Costo por unidad de compra, en centavos de su moneda. */
  costoOrigen: Centavos
  moneda: Moneda
  /** Peso o volumen total del lote, en cualquier unidad entera. Solo para el prorrateo por peso. */
  peso?: number
}

export type Viaje = {
  cotizaciones: Cotizaciones
  modoProrrateo: ModoProrrateo
  gastos: Gasto[]
  lotes: Lote[]
}

/** Costos por unidad en centavos de peso, exactos (sin redondear). */
export type CostoLote = {
  loteId: string
  unidades: number
  origenUnitario: Fraccion
  gastoUnitario: Fraccion
  costoUnitario: Fraccion
}

export type CostoViaje = {
  /** Total de gastos del viaje en centavos de peso. */
  gastos: Fraccion
  /** Suma de las unidades de todos los lotes: nunca se tipea. */
  unidades: number
  lotes: CostoLote[]
}

/** Cotización a partir de lo realmente pagado: "cambié X pesos por Y bolivianos". */
export function cotizacionDesdeCambio(pesosEntregados: Centavos, monedaRecibida: Centavos): number {
  if (pesosEntregados <= 0 || monedaRecibida <= 0) throw new RangeError('Los dos montos deben ser mayores a cero')
  return Fraccion.razon(pesosEntregados, monedaRecibida).por(MICROS).redondear()
}

function enPesos(monto: Centavos, moneda: Moneda, cotizaciones: Cotizaciones): Fraccion {
  if (moneda === 'ARS') return Fraccion.de(monto)
  const cotizacion = cotizaciones[moneda]
  if (!(cotizacion > 0)) throw new RangeError(`Falta la cotización de ${moneda}`)
  return Fraccion.de(monto).por(cotizacion).dividido(MICROS)
}

/**
 * Costo por unidad de cada lote = costo de origen × cotización + gasto de viaje prorrateado.
 * Con las cotizaciones del viaje da el costo histórico (regla 1); con las de hoy,
 * el costo de reposición (regla 2).
 */
export function costearViaje(viaje: Viaje, cotizaciones: Cotizaciones = viaje.cotizaciones): CostoViaje {
  const gastos = Fraccion.suma(viaje.gastos.map((g) => enPesos(g.monto, g.moneda, cotizaciones)))

  const lotes = viaje.lotes.map((lote) => {
    const unidades = aUnidades(lote.cantidad, lote.unidadCompra)
    const origenUnitario = enPesos(lote.costoOrigen, lote.moneda, cotizaciones).dividido(
      UNIDADES_POR[lote.unidadCompra],
    )
    return { lote, unidades, origenUnitario }
  })

  // Cuánto "pesa" cada lote en el reparto de gastos, según el modo del viaje.
  const pesosPorModo: Record<ModoProrrateo, Fraccion[]> = {
    unidad: lotes.map((l) => Fraccion.de(l.unidades)),
    valor: lotes.map((l) => l.origenUnitario.por(l.unidades)),
    peso: lotes.map((l) => Fraccion.de(l.lote.peso ?? 0)),
  }
  let pesos = pesosPorModo[viaje.modoProrrateo]
  // Sin base para repartir (todo sin peso o sin valor), los gastos no se pierden: van por unidad.
  if (Fraccion.suma(pesos).esCero()) pesos = pesosPorModo.unidad
  const pesoTotal = Fraccion.suma(pesos)

  return {
    gastos,
    unidades: lotes.reduce((total, l) => total + l.unidades, 0),
    lotes: lotes.map((l, i) => {
      const gastoUnitario = gastos
        .por(pesos[i] ?? 0)
        .dividido(pesoTotal)
        .dividido(l.unidades)
      return {
        loteId: l.lote.id,
        unidades: l.unidades,
        origenUnitario: l.origenUnitario,
        gastoUnitario,
        costoUnitario: l.origenUnitario.mas(gastoUnitario),
      }
    }),
  }
}
