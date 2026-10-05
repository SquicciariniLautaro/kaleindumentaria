function mcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) [a, b] = [b, a % b]
  return a < 0n ? -a : a
}

export type Numero = number | bigint | Fraccion

/**
 * Número exacto (numerador / denominador con enteros grandes).
 * Los cálculos intermedios (dividir por 12, prorratear gastos, aplicar la
 * cotización) se hacen con esto para no arrastrar errores de punto flotante.
 * Solo se redondea al final, con redondear().
 */
export class Fraccion {
  static readonly CERO = new Fraccion(0n, 1n)

  readonly n: bigint
  readonly d: bigint

  private constructor(n: bigint, d: bigint) {
    if (d === 0n) throw new RangeError('División por cero')
    if (d < 0n) [n, d] = [-n, -d]
    const m = mcd(n, d)
    this.n = n / m
    this.d = d / m
  }

  /** Solo acepta enteros: los decimales se pasan como razon(numerador, denominador). */
  static de(valor: Numero): Fraccion {
    if (valor instanceof Fraccion) return valor
    if (typeof valor === 'bigint') return new Fraccion(valor, 1n)
    if (!Number.isSafeInteger(valor)) throw new RangeError(`Se esperaba un número entero y llegó ${valor}`)
    return new Fraccion(BigInt(valor), 1n)
  }

  static razon(numerador: Numero, denominador: Numero): Fraccion {
    return Fraccion.de(numerador).dividido(denominador)
  }

  static suma(valores: Numero[]): Fraccion {
    return valores.reduce<Fraccion>((total, v) => total.mas(v), Fraccion.CERO)
  }

  mas(otro: Numero): Fraccion {
    const b = Fraccion.de(otro)
    return new Fraccion(this.n * b.d + b.n * this.d, this.d * b.d)
  }

  menos(otro: Numero): Fraccion {
    const b = Fraccion.de(otro)
    return new Fraccion(this.n * b.d - b.n * this.d, this.d * b.d)
  }

  por(otro: Numero): Fraccion {
    const b = Fraccion.de(otro)
    return new Fraccion(this.n * b.n, this.d * b.d)
  }

  dividido(otro: Numero): Fraccion {
    const b = Fraccion.de(otro)
    return new Fraccion(this.n * b.d, this.d * b.n)
  }

  igual(otro: Numero): boolean {
    const b = Fraccion.de(otro)
    return this.n === b.n && this.d === b.d
  }

  esCero(): boolean {
    return this.n === 0n
  }

  signo(): -1 | 0 | 1 {
    return this.n === 0n ? 0 : this.n < 0n ? -1 : 1
  }

  /** Redondeo comercial al entero más cercano: la mitad se aleja de cero (0,5 → 1; -0,5 → -1). */
  redondear(): number {
    const negativo = this.n < 0n
    const abs = negativo ? -this.n : this.n
    const cociente = (abs * 2n + this.d) / (this.d * 2n)
    const resultado = Number(negativo ? -cociente : cociente)
    if (!Number.isSafeInteger(resultado)) throw new RangeError('El resultado es demasiado grande')
    return resultado
  }
}
