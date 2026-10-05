export type UnidadMedida = 'unidad' | 'docena'

/** Una docena siempre son 12 unidades. El stock se lleva en unidades. */
export const UNIDADES_POR: Record<UnidadMedida, number> = { unidad: 1, docena: 12 }

export function aUnidades(cantidad: number, unidad: UnidadMedida): number {
  if (!Number.isSafeInteger(cantidad) || cantidad <= 0) {
    throw new RangeError(`La cantidad debe ser un entero mayor a cero y llegó ${cantidad}`)
  }
  return cantidad * UNIDADES_POR[unidad]
}

/** 24 → "24 u. (2 doc)"; 10 → "10 u." */
export function describirUnidades(unidades: number): string {
  return unidades >= 12 && unidades % 12 === 0 ? `${unidades} u. (${unidades / 12} doc)` : `${unidades} u.`
}

/** (2, 'docena') → "2 doc"; (3, 'unidad') → "3 u." */
export function describirCantidad(cantidad: number, unidad: UnidadMedida): string {
  return `${cantidad} ${unidad === 'docena' ? 'doc' : 'u.'}`
}
