import type { Centavos } from './dinero'

export type VentaCuenta = { id: string; fecha: string; total: Centavos }

/** Un cobro. Con ventaId va a esa venta; sin ventaId, a la deuda más antigua. */
export type Pago = { id: string; fecha: string; monto: Centavos; ventaId?: string }

export type EstadoVenta = 'pagada' | 'parcial' | 'debe'

export type VentaConSaldo = VentaCuenta & { pagado: Centavos; saldo: Centavos; estado: EstadoVenta }

export type Cuenta = {
  /** Ventas de la más vieja a la más nueva, con lo pagado y lo que falta. */
  ventas: VentaConSaldo[]
  deuda: Centavos
  saldoAFavor: Centavos
}

const porFecha = (a: { fecha: string }, b: { fecha: string }): number =>
  a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0

/**
 * Cuenta corriente de un cliente (regla 6). El estado de cada venta se calcula
 * acá y nunca se guarda. deuda − saldoAFavor = suma de ventas − suma de pagos.
 */
export function calcularCuenta(ventas: VentaCuenta[], pagos: Pago[]): Cuenta {
  const ordenadas = [...ventas].sort(porFecha)
  const pagado = new Map(ordenadas.map((v) => [v.id, 0]))
  let sinAplicar = 0

  const aplicar = (venta: VentaCuenta, monto: Centavos): Centavos => {
    const ya = pagado.get(venta.id) ?? 0
    const aplicado = Math.min(monto, venta.total - ya)
    pagado.set(venta.id, ya + aplicado)
    return monto - aplicado
  }

  // 1. Cobros dirigidos a una venta. Lo que sobra (o apunta a una venta borrada) queda para repartir.
  for (const pago of [...pagos].sort(porFecha)) {
    const venta = ordenadas.find((v) => v.id === pago.ventaId)
    sinAplicar += venta ? aplicar(venta, pago.monto) : pago.monto
  }

  // 2. El resto cubre la deuda más antigua primero.
  for (const venta of ordenadas) sinAplicar = aplicar(venta, sinAplicar)

  const conSaldo = ordenadas.map((v): VentaConSaldo => {
    const cobrado = pagado.get(v.id) ?? 0
    const saldo = v.total - cobrado
    return { ...v, pagado: cobrado, saldo, estado: saldo === 0 ? 'pagada' : cobrado === 0 ? 'debe' : 'parcial' }
  })

  return {
    ventas: conSaldo,
    deuda: conSaldo.reduce((total, v) => total + v.saldo, 0),
    saldoAFavor: sinAplicar,
  }
}
