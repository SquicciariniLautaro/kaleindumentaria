import { redondearAMultiplo, type Centavos } from './dinero'
import { Fraccion } from './fraccion'
import { UNIDADES_POR, type UnidadMedida } from './unidades'

/**
 * Precio de venta sugerido (regla 4) = costo de reposición × (1 + margen %),
 * redondeado al múltiplo de pesos elegido. El margen es un recargo sobre el
 * costo: 30 % sobre costo equivale a 23 % del precio.
 */
export function precioSugerido(
  costoReposicionUnitario: Fraccion,
  margenPct: number,
  unidadVenta: UnidadMedida,
  multiploPesos: number,
): Centavos {
  const margen = Fraccion.razon(Math.round(margenPct * 100), 10_000)
  const exacto = costoReposicionUnitario.por(UNIDADES_POR[unidadVenta]).por(margen.mas(1))
  const redondeado = redondearAMultiplo(exacto, multiploPesos)
  // Un producto muy barato no puede quedar con precio cero por el redondeo.
  return redondeado === 0 && exacto.signo() > 0 ? multiploPesos * 100 : redondeado
}
