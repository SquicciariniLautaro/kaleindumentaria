import { describe, expect, it } from 'vitest'
import { calcularCuenta, type Pago, type VentaCuenta } from './cuenta'

// Dos ventas fiadas: $ 100.000 en agosto y $ 50.000 en septiembre.
const agosto: VentaCuenta = { id: 'agosto', fecha: '2026-08-01', total: 10_000_000 }
const septiembre: VentaCuenta = { id: 'septiembre', fecha: '2026-09-01', total: 5_000_000 }
const ventas = [septiembre, agosto]

const estados = (pagos: Pago[]) => calcularCuenta(ventas, pagos).ventas.map((v) => [v.id, v.estado, v.saldo])

describe('regla 6: cuenta corriente', () => {
  it('sin cobros debe todo', () => {
    const cuenta = calcularCuenta(ventas, [])
    expect(cuenta.deuda).toBe(15_000_000)
    expect(cuenta.saldoAFavor).toBe(0)
    expect(estados([])).toEqual([
      ['agosto', 'debe', 10_000_000],
      ['septiembre', 'debe', 5_000_000],
    ])
  })

  it('un cobro de $ 120.000 cubre agosto entero y parte de septiembre', () => {
    const pagos: Pago[] = [{ id: 'p1', fecha: '2026-09-10', monto: 12_000_000 }]
    expect(calcularCuenta(ventas, pagos).deuda).toBe(3_000_000)
    expect(estados(pagos)).toEqual([
      ['agosto', 'pagada', 0],
      ['septiembre', 'parcial', 3_000_000],
    ])
  })

  it('varios cobros parciales se acumulan sobre la deuda más antigua', () => {
    const pagos: Pago[] = [
      { id: 'p1', fecha: '2026-08-15', monto: 4_000_000 },
      { id: 'p2', fecha: '2026-09-15', monto: 4_000_000 },
    ]
    expect(estados(pagos)).toEqual([
      ['agosto', 'parcial', 2_000_000],
      ['septiembre', 'debe', 5_000_000],
    ])
  })

  it('un cobro dirigido paga la venta elegida aunque haya una más vieja', () => {
    const pagos: Pago[] = [{ id: 'p1', fecha: '2026-09-10', monto: 5_000_000, ventaId: 'septiembre' }]
    expect(estados(pagos)).toEqual([
      ['agosto', 'debe', 10_000_000],
      ['septiembre', 'pagada', 0],
    ])
  })

  it('lo que sobra de un cobro dirigido pasa a la deuda más antigua', () => {
    const pagos: Pago[] = [{ id: 'p1', fecha: '2026-09-10', monto: 6_000_000, ventaId: 'septiembre' }]
    expect(estados(pagos)).toEqual([
      ['agosto', 'parcial', 9_000_000],
      ['septiembre', 'pagada', 0],
    ])
  })

  it('pagar de más deja saldo a favor', () => {
    const cuenta = calcularCuenta(ventas, [{ id: 'p1', fecha: '2026-09-10', monto: 16_000_000 }])
    expect(cuenta.deuda).toBe(0)
    expect(cuenta.saldoAFavor).toBe(1_000_000)
  })

  it('una seña sin ventas es saldo a favor', () => {
    const cuenta = calcularCuenta([], [{ id: 'p1', fecha: '2026-09-10', monto: 2_000_000 }])
    expect(cuenta.deuda).toBe(0)
    expect(cuenta.saldoAFavor).toBe(2_000_000)
  })

  it('un cobro dirigido a una venta que ya no existe no se pierde', () => {
    const pagos: Pago[] = [{ id: 'p1', fecha: '2026-09-10', monto: 3_000_000, ventaId: 'borrada' }]
    expect(calcularCuenta(ventas, pagos).deuda).toBe(12_000_000)
  })

  it('deuda − saldo a favor siempre es ventas − pagos', () => {
    const casos: Pago[][] = [
      [],
      [{ id: 'a', fecha: '2026-08-02', monto: 1 }],
      [
        { id: 'a', fecha: '2026-08-02', monto: 7_000_000, ventaId: 'septiembre' },
        { id: 'b', fecha: '2026-08-03', monto: 3_333_333 },
      ],
      [{ id: 'a', fecha: '2026-10-01', monto: 99_000_000 }],
    ]
    for (const pagos of casos) {
      const cuenta = calcularCuenta(ventas, pagos)
      const pagado = pagos.reduce((total, p) => total + p.monto, 0)
      expect(cuenta.deuda - cuenta.saldoAFavor).toBe(15_000_000 - pagado)
    }
  })
})
