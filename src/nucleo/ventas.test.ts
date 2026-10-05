import { describe, expect, it } from 'vitest'
import { costearViaje } from './costos'
import { VIAJE_EJEMPLO } from './ejemplo'
import { Fraccion } from './fraccion'
import { asignarFifo, gananciaLinea, StockInsuficiente, totalLinea, type LoteDisponible } from './ventas'

const costosEjemplo = new Map(costearViaje(VIAJE_EJEMPLO).lotes.map((l) => [l.loteId, l.costoUnitario]))

describe('total de una línea', () => {
  it('cantidad × precio − descuento, sin dividir por 12', () => {
    expect(totalLinea({ cantidad: 3, unidadVenta: 'unidad', precio: 4_500_000 })).toBe(13_500_000)
    expect(totalLinea({ cantidad: 2, unidadVenta: 'docena', precio: 52_080_000, descuento: 80_000 })).toBe(
      104_080_000,
    )
  })
})

describe('regla 5: ganancia real', () => {
  it('3 zapatillas a $ 45.000 con costo 33.382,35 → $ 34.852,94 (igual que el prototipo)', () => {
    const ganancia = gananciaLinea(
      { cantidad: 3, unidadVenta: 'unidad', precio: 4_500_000 },
      [{ loteId: 'zapatillas', unidades: 3 }],
      costosEjemplo,
    )
    expect(ganancia).toBe(3_485_294)
  })

  it('1 docena a $ 520.800 con $ 800 de descuento', () => {
    // Costo: 12 × 33.382,35… = 400.588,24. Ganancia: 520.800 − 800 − 400.588,24 = 119.411,76.
    const ganancia = gananciaLinea(
      { cantidad: 1, unidadVenta: 'docena', precio: 52_080_000, descuento: 80_000 },
      [{ loteId: 'zapatillas', unidades: 12 }],
      costosEjemplo,
    )
    expect(ganancia).toBe(11_941_176)
  })

  it('una venta que sale de dos viajes usa el costo de cada uno', () => {
    const costos = new Map([
      ['viejo', Fraccion.de(100_000)],
      ['nuevo', Fraccion.de(120_000)],
    ])
    // 5 × 1.000 + 3 × 1.200 = 8.600 de costo; 8 × 1.500 = 12.000 de venta.
    const ganancia = gananciaLinea(
      { cantidad: 8, unidadVenta: 'unidad', precio: 150_000 },
      [
        { loteId: 'viejo', unidades: 5 },
        { loteId: 'nuevo', unidades: 3 },
      ],
      costos,
    )
    expect(ganancia).toBe(340_000)
  })

  it('vender por debajo del costo da ganancia negativa', () => {
    const ganancia = gananciaLinea(
      { cantidad: 1, unidadVenta: 'unidad', precio: 3_000_000 },
      [{ loteId: 'zapatillas', unidades: 1 }],
      costosEjemplo,
    )
    expect(ganancia).toBe(-338_235)
  })

  it('falla si las unidades asignadas no coinciden con las vendidas', () => {
    expect(() =>
      gananciaLinea(
        { cantidad: 1, unidadVenta: 'docena', precio: 52_080_000 },
        [{ loteId: 'zapatillas', unidades: 10 }],
        costosEjemplo,
      ),
    ).toThrow('12 unidades')
  })
})

describe('reparto de stock: primero lo más viejo', () => {
  const lotes: LoteDisponible[] = [
    { loteId: 'septiembre', fecha: '2026-09-01', disponible: 10 },
    { loteId: 'agosto', fecha: '2026-08-01', disponible: 5 },
  ]

  it('consume el lote viejo y sigue con el nuevo', () => {
    expect(asignarFifo(lotes, 8)).toEqual([
      { loteId: 'agosto', unidades: 5 },
      { loteId: 'septiembre', unidades: 3 },
    ])
  })

  it('si alcanza con el viejo no toca el nuevo', () => {
    expect(asignarFifo(lotes, 4)).toEqual([{ loteId: 'agosto', unidades: 4 }])
  })

  it('saltea lotes agotados', () => {
    const conAgotado = [{ loteId: 'julio', fecha: '2026-07-01', disponible: 0 }, ...lotes]
    expect(asignarFifo(conAgotado, 6)).toEqual([
      { loteId: 'agosto', unidades: 5 },
      { loteId: 'septiembre', unidades: 1 },
    ])
  })

  it('avisa cuánto queda si no alcanza el stock', () => {
    expect(() => asignarFifo(lotes, 16)).toThrow(StockInsuficiente)
    try {
      asignarFifo(lotes, 16)
    } catch (error) {
      expect((error as StockInsuficiente).disponible).toBe(15)
    }
  })
})
