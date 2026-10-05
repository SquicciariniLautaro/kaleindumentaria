import { describe, expect, it } from 'vitest'
import { fechaLocal, fechaParaMostrar } from './fecha'

describe('fechaLocal', () => {
  it('usa el día del dispositivo aunque sea de noche', () => {
    // 5 de octubre a las 22:30 hora local: en UTC-3, toISOString() daría el día 6.
    expect(fechaLocal(new Date(2026, 9, 5, 22, 30))).toBe('2026-10-05')
  })

  it('rellena con ceros el mes y el día', () => {
    expect(fechaLocal(new Date(2026, 0, 3, 8, 0))).toBe('2026-01-03')
  })

  it('no cambia de día en el primer minuto', () => {
    expect(fechaLocal(new Date(2026, 11, 31, 0, 1))).toBe('2026-12-31')
  })
})

describe('fechaParaMostrar', () => {
  it('convierte a formato argentino', () => {
    expect(fechaParaMostrar('2026-10-05')).toBe('05/10/2026')
  })

  it('devuelve el texto tal cual si no es una fecha', () => {
    expect(fechaParaMostrar('sin fecha')).toBe('sin fecha')
  })
})
