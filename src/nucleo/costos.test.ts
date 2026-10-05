import { describe, expect, it } from 'vitest'
import { costearViaje, cotizacionDesdeCambio, type CostoViaje, type Viaje } from './costos'
import { VIAJE_EJEMPLO } from './ejemplo'
import { Fraccion } from './fraccion'
import { precioSugerido } from './precios'

function lote(costo: CostoViaje, id: string) {
  const encontrado = costo.lotes.find((l) => l.loteId === id)
  if (!encontrado) throw new Error(`No existe el lote ${id}`)
  return encontrado
}

/** Los gastos repartidos entre todas las unidades tienen que sumar exactamente el total. */
function gastoRepartido(costo: CostoViaje): Fraccion {
  return Fraccion.suma(costo.lotes.map((l) => l.gastoUnitario.por(l.unidades)))
}

describe('regla 1: costo histórico (ejemplo del prototipo)', () => {
  const costo = costearViaje(VIAJE_EJEMPLO)

  it('suma los gastos en pesos: 60.000 + 15.000 + 200 BOB × 200 = 115.000', () => {
    expect(costo.gastos.redondear()).toBe(11_500_000)
  })

  it('las unidades salen de los lotes: 2 docenas + 10 = 34', () => {
    expect(costo.unidades).toBe(34)
  })

  it('zapatillas: 1.800 BOB ÷ 12 × 200 = 30.000 + 3.382,35 de gasto = 33.382,35', () => {
    const z = lote(costo, 'zapatillas')
    expect(z.origenUnitario.redondear()).toBe(3_000_000)
    expect(z.gastoUnitario.redondear()).toBe(338_235)
    expect(z.costoUnitario.redondear()).toBe(3_338_235)
  })

  it('parlante: 12 USD × 1.400 = 16.800 + 3.382,35 de gasto = 20.182,35', () => {
    const p = lote(costo, 'parlante')
    expect(p.origenUnitario.redondear()).toBe(1_680_000)
    expect(p.costoUnitario.redondear()).toBe(2_018_235)
  })
})

describe('regla 2: costo de reposición', () => {
  it('recalcula con la cotización de hoy sin tocar el histórico', () => {
    const hoy = { BOB: 250_000_000, USD: 1_500_000_000 }
    const reposicion = costearViaje(VIAJE_EJEMPLO, hoy)

    // Gastos: 75.000 ARS quedan igual; los 200 BOB pasan a 50.000 → 125.000.
    expect(reposicion.gastos.redondear()).toBe(12_500_000)
    expect(lote(reposicion, 'zapatillas').costoUnitario.redondear()).toBe(4_117_647)
    expect(lote(reposicion, 'parlante').costoUnitario.redondear()).toBe(2_167_647)
    expect(lote(costearViaje(VIAJE_EJEMPLO), 'zapatillas').costoUnitario.redondear()).toBe(3_338_235)
  })
})

describe('regla 3: prorrateo de gastos', () => {
  const modos = ['unidad', 'valor', 'peso'] as const

  it.each(modos)('por %s: lo repartido suma exactamente el total de gastos', (modoProrrateo) => {
    const costo = costearViaje({ ...VIAJE_EJEMPLO, modoProrrateo })
    expect(gastoRepartido(costo).igual(costo.gastos)).toBe(true)
  })

  it('por valor: el producto más caro carga más gasto', () => {
    const costo = costearViaje({ ...VIAJE_EJEMPLO, modoProrrateo: 'valor' })
    // Valor comprado: 24 × 30.000 + 10 × 16.800 = 888.000.
    expect(lote(costo, 'zapatillas').gastoUnitario.redondear()).toBe(388_514)
    expect(lote(costo, 'parlante').gastoUnitario.redondear()).toBe(217_568)
  })

  it('por peso: 30 y 10 de peso reparten 75 % y 25 %', () => {
    const costo = costearViaje({ ...VIAJE_EJEMPLO, modoProrrateo: 'peso' })
    expect(lote(costo, 'zapatillas').gastoUnitario.igual(359_375)).toBe(true)
    expect(lote(costo, 'parlante').gastoUnitario.igual(287_500)).toBe(true)
  })

  it('por peso sin ningún peso cargado: reparte por unidad en vez de perder los gastos', () => {
    const sinPeso: Viaje = {
      ...VIAJE_EJEMPLO,
      modoProrrateo: 'peso',
      lotes: VIAJE_EJEMPLO.lotes.map(({ peso: _peso, ...resto }) => resto),
    }
    expect(lote(costearViaje(sinPeso), 'zapatillas').gastoUnitario.redondear()).toBe(338_235)
  })

  it('un viaje sin lotes no falla', () => {
    const costo = costearViaje({ ...VIAJE_EJEMPLO, lotes: [] })
    expect(costo.unidades).toBe(0)
    expect(costo.lotes).toEqual([])
  })

  it('avisa si falta la cotización o la cantidad no es válida', () => {
    expect(() => costearViaje(VIAJE_EJEMPLO, { BOB: 0, USD: 1_400_000_000 })).toThrow('Falta la cotización de BOB')
    const cantidadCero: Viaje = {
      ...VIAJE_EJEMPLO,
      lotes: [{ id: 'x', cantidad: 0, unidadCompra: 'unidad', costoOrigen: 100, moneda: 'ARS' }],
    }
    expect(() => costearViaje(cantidadCero)).toThrow(RangeError)
  })
})

describe('cotización realmente pagada', () => {
  it('cambié 1.000.000 de pesos por 4.900 bolivianos → 204,081633', () => {
    expect(cotizacionDesdeCambio(100_000_000, 490_000)).toBe(204_081_633)
  })

  it('rechaza montos en cero', () => {
    expect(() => cotizacionDesdeCambio(0, 490_000)).toThrow(RangeError)
  })
})

describe('regla 4: precio de venta sugerido', () => {
  const costo = costearViaje(VIAJE_EJEMPLO)
  const zapatillas = lote(costo, 'zapatillas').costoUnitario
  const parlante = lote(costo, 'parlante').costoUnitario

  it('zapatillas con 30 %: 43.397,06 → $ 43.400 la unidad', () => {
    expect(precioSugerido(zapatillas, 30, 'unidad', 100)).toBe(4_340_000)
  })

  it('zapatillas por docena: 520.764,71 → $ 520.800', () => {
    expect(precioSugerido(zapatillas, 30, 'docena', 100)).toBe(52_080_000)
  })

  it('parlante con 40 % (28.255,29) según el múltiplo elegido', () => {
    expect(precioSugerido(parlante, 40, 'unidad', 100)).toBe(2_830_000)
    expect(precioSugerido(parlante, 40, 'unidad', 50)).toBe(2_825_000)
    expect(precioSugerido(parlante, 40, 'unidad', 25)).toBe(2_825_000)
    expect(precioSugerido(parlante, 40, 'unidad', 20)).toBe(2_826_000)
  })

  it('acepta márgenes con decimales: 32,5 % sobre $ 1.000 = $ 1.325', () => {
    expect(precioSugerido(Fraccion.de(100_000), 32.5, 'unidad', 25)).toBe(132_500)
  })

  it('un producto muy barato nunca queda en precio cero', () => {
    expect(precioSugerido(Fraccion.de(3_000), 30, 'unidad', 100)).toBe(10_000)
  })
})
