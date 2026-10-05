import type { Cotizaciones, Viaje } from './costos'

/** Cotizaciones del ejemplo del prototipo: 1 BOB = 200 ARS, 1 USD = 1.400 ARS. */
export const COTIZACIONES_EJEMPLO: Cotizaciones = { BOB: 200_000_000, USD: 1_400_000_000 }

/**
 * Viaje de ejemplo (el mismo del prototipo), con montos en centavos:
 * pasajes 60.000 ARS, peajes 15.000 ARS, viáticos 200 BOB;
 * 2 docenas de zapatillas a 1.800 BOB la docena y 10 parlantes a 12 USD.
 */
export const VIAJE_EJEMPLO: Viaje = {
  cotizaciones: COTIZACIONES_EJEMPLO,
  modoProrrateo: 'unidad',
  gastos: [
    { monto: 6_000_000, moneda: 'ARS' },
    { monto: 1_500_000, moneda: 'ARS' },
    { monto: 20_000, moneda: 'BOB' },
  ],
  lotes: [
    { id: 'zapatillas', cantidad: 2, unidadCompra: 'docena', costoOrigen: 180_000, moneda: 'BOB', peso: 30 },
    { id: 'parlante', cantidad: 10, unidadCompra: 'unidad', costoOrigen: 1_200, moneda: 'USD', peso: 10 },
  ],
}
