import { describe, expect, it } from 'vitest'
import { formatearMonto, formatearPesos, leerMonto, redondearAMultiplo } from './dinero'

describe('formatearPesos', () => {
  it('muestra pesos enteros con punto de miles', () => {
    expect(formatearPesos(4_339_706)).toBe('$ 43.397')
    expect(formatearPesos(12_345_678_900)).toBe('$ 123.456.789')
    expect(formatearPesos(0)).toBe('$ 0')
  })

  it('redondea los centavos: 50 centavos sube', () => {
    expect(formatearPesos(4_339_750)).toBe('$ 43.398')
    expect(formatearPesos(4_339_749)).toBe('$ 43.397')
  })

  it('pone el signo adelante en los negativos', () => {
    expect(formatearPesos(-150_000)).toBe('-$ 1.500')
  })
})

describe('formatearMonto', () => {
  it('muestra centavos solo si los hay', () => {
    expect(formatearMonto(180_000)).toBe('1.800')
    expect(formatearMonto(1_250)).toBe('12,50')
    expect(formatearMonto(1_205)).toBe('12,05')
    expect(formatearMonto(-1_250)).toBe('-12,50')
  })
})

describe('leerMonto', () => {
  it('lee el formato argentino', () => {
    expect(leerMonto('1.234,50')).toBe(123_450)
    expect(leerMonto('1234,5')).toBe(123_450)
    expect(leerMonto('$ 45.000')).toBe(4_500_000)
    expect(leerMonto('1.234.567')).toBe(123_456_700)
  })

  it('acepta el punto como decimal cuando no hay coma', () => {
    expect(leerMonto('1234.5')).toBe(123_450)
    expect(leerMonto('12.50')).toBe(1_250)
  })

  it('devuelve null si no es un monto válido', () => {
    expect(leerMonto('')).toBeNull()
    expect(leerMonto('abc')).toBeNull()
    expect(leerMonto('-50')).toBeNull()
    expect(leerMonto('1,234')).toBeNull()
    expect(leerMonto('1,2,3')).toBeNull()
  })
})

describe('redondearAMultiplo', () => {
  it('redondea al múltiplo de pesos más cercano', () => {
    expect(redondearAMultiplo(4_339_706, 100)).toBe(4_340_000)
    expect(redondearAMultiplo(2_825_529, 50)).toBe(2_825_000)
    expect(redondearAMultiplo(2_825_529, 25)).toBe(2_825_000)
    expect(redondearAMultiplo(2_825_529, 20)).toBe(2_826_000)
  })

  it('la mitad exacta sube', () => {
    expect(redondearAMultiplo(5_000, 100)).toBe(10_000)
    expect(redondearAMultiplo(4_999, 100)).toBe(0)
  })
})
