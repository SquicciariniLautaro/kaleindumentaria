import { describe, expect, it } from 'vitest'
import { Fraccion } from './fraccion'

describe('Fraccion', () => {
  it('suma decimales sin el error clásico de 0,1 + 0,2', () => {
    expect(0.1 + 0.2).not.toBe(0.3)
    expect(Fraccion.razon(1, 10).mas(Fraccion.razon(2, 10)).igual(Fraccion.razon(3, 10))).toBe(true)
  })

  it('dividir por 12 y volver a multiplicar da el número original', () => {
    expect(Fraccion.de(50_000).dividido(12).por(12).igual(50_000)).toBe(true)
  })

  it('redondea la mitad alejándose de cero', () => {
    expect(Fraccion.razon(1, 2).redondear()).toBe(1)
    expect(Fraccion.razon(-1, 2).redondear()).toBe(-1)
    expect(Fraccion.razon(1, 3).redondear()).toBe(0)
    expect(Fraccion.razon(2, 3).redondear()).toBe(1)
    expect(Fraccion.razon(-2, 3).redondear()).toBe(-1)
  })

  it('no pierde precisión con números enormes', () => {
    // 1.800 BOB × 204,081633 × 10.000 docenas: el producto intermedio no entra en un número común.
    const total = Fraccion.de(180_000).por(204_081_633).por(10_000).dividido(1_000_000)
    expect(total.redondear()).toBe(367_346_939_400)
  })

  it('resta, signo y cero', () => {
    expect(Fraccion.de(5).menos(7).signo()).toBe(-1)
    expect(Fraccion.de(5).menos(5).esCero()).toBe(true)
    expect(Fraccion.suma([1, 2, Fraccion.razon(1, 2)]).igual(Fraccion.razon(7, 2))).toBe(true)
  })

  it('rechaza decimales sueltos y la división por cero', () => {
    expect(() => Fraccion.de(1.5)).toThrow(RangeError)
    expect(() => Fraccion.de(1).dividido(0)).toThrow(RangeError)
  })
})
