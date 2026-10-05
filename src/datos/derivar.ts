import { costearViaje, type CostoViaje, type Cotizaciones } from '../nucleo/costos'
import { calcularCuenta, type EstadoVenta } from '../nucleo/cuenta'
import type { Centavos, MonedaExtranjera } from '../nucleo/dinero'
import { diasEntre } from '../nucleo/fecha'
import { Fraccion } from '../nucleo/fraccion'
import { precioSugerido } from '../nucleo/precios'
import { aUnidades, UNIDADES_POR, type UnidadMedida } from '../nucleo/unidades'
import { asignarFifo, totalLinea, type Asignacion } from '../nucleo/ventas'
import type {
  Cliente,
  Comprobante,
  Config,
  Cotizacion,
  Envio,
  Lote,
  Movimiento,
  Pago,
  PlantillaGasto,
  Producto,
  Venta,
  VentaItem,
  Viaje,
  ViajeGasto,
} from './tipos'

/** Todo lo guardado que no está en la papelera. */
export type Datos = {
  config: Config
  cotizaciones: Cotizacion[]
  viajes: Viaje[]
  gastos: ViajeGasto[]
  plantillas: PlantillaGasto[]
  productos: Producto[]
  lotes: Lote[]
  movimientos: Movimiento[]
  clientes: Cliente[]
  ventas: Venta[]
  items: VentaItem[]
  pagos: Pago[]
  envios: Envio[]
  comprobantes: Comprobante[]
}

export type LoteVista = {
  lote: Lote
  viaje: Viaje
  producto: Producto | undefined
  unidades: number
  vendidas: number
  ajustes: number
  disponible: number
  origenUnitario: Fraccion
  gastoUnitario: Fraccion
  costoHistorico: Fraccion
  costoReposicion: Fraccion
}

export type Lista = 'minorista' | 'mayorista'

export type ProductoVista = {
  producto: Producto
  /** Del viaje más viejo al más nuevo. */
  lotes: LoteVista[]
  stock: number
  margen: number
  margenMayorista: number
  /** null si todavía no se compró en ningún viaje. */
  precios: Record<Lista, Record<UnidadMedida, Centavos>> | null
  valorStock: Centavos
  bajoMinimo: boolean
}

export type ItemVista = {
  item: VentaItem
  producto: Producto | undefined
  unidades: number
  total: Centavos
  costo: Centavos
  ganancia: Centavos
}

export type VentaVista = {
  venta: Venta
  cliente: Cliente | undefined
  items: ItemVista[]
  envio: Envio | undefined
  total: Centavos
  /** Ganancia real: total − costo histórico − envío si lo paga el negocio. */
  ganancia: Centavos
  pagado: Centavos
  saldo: Centavos
  estado: EstadoVenta
}

export type Antiguedad = { hasta30: Centavos; hasta60: Centavos; masDe60: Centavos }

export type ClienteVista = {
  cliente: Cliente
  ventas: VentaVista[]
  pagos: Pago[]
  deuda: Centavos
  saldoAFavor: Centavos
  antiguedad: Antiguedad
  superaLimite: boolean
}

export type ViajeVista = {
  viaje: Viaje
  gastos: ViajeGasto[]
  lotes: LoteVista[]
  /** Mensaje si no se pudo calcular el costo (por ejemplo, falta una cotización). */
  error: string | null
  totalGastos: Centavos
  totalCompra: Centavos
  unidades: number
  unidadesVendidas: number
  vendido: Centavos
  ganancia: Centavos
  valorStock: Centavos
  tieneSalidas: boolean
}

export type Vista = {
  cotizacionesHoy: Cotizaciones
  lotes: Map<string, LoteVista>
  productos: ProductoVista[]
  ventas: VentaVista[]
  clientes: ClienteVista[]
  viajes: ViajeVista[]
  totales: { ganancia: Centavos; porCobrar: Centavos; cobrado: Centavos; valorStock: Centavos; antiguedad: Antiguedad }
}

function agrupar<T>(filas: T[], clave: (fila: T) => string): Map<string, T[]> {
  const grupos = new Map<string, T[]>()
  for (const fila of filas) {
    const k = clave(fila)
    const grupo = grupos.get(k)
    if (grupo) grupo.push(fila)
    else grupos.set(k, [fila])
  }
  return grupos
}

const comparar = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)
const sumar = (mapa: Map<string, number>, clave: string, valor: number) =>
  mapa.set(clave, (mapa.get(clave) ?? 0) + valor)

/** Última cotización cargada del tipo elegido en Configuración. 0 si no hay ninguna. */
export function cotizacionesDeHoy(d: Pick<Datos, 'config' | 'cotizaciones'>): Cotizaciones {
  const ultima = (moneda: MonedaExtranjera): number =>
    d.cotizaciones
      .filter((c) => c.moneda === moneda && c.tipo === d.config.tipoCotizacion[moneda])
      .sort((a, b) => comparar(b.fecha, a.fecha) || comparar(b.creadoEn, a.creadoEn))[0]?.valor ?? 0
  return { BOB: ultima('BOB'), USD: ultima('USD') }
}

const ANTIGUEDAD_CERO: Antiguedad = { hasta30: 0, hasta60: 0, masDe60: 0 }

function antiguedadDe(ventas: VentaVista[], hoy: string): Antiguedad {
  const a = { ...ANTIGUEDAD_CERO }
  for (const v of ventas) {
    const dias = diasEntre(v.venta.fecha, hoy)
    if (dias <= 30) a.hasta30 += v.saldo
    else if (dias <= 60) a.hasta60 += v.saldo
    else a.masDe60 += v.saldo
  }
  return a
}

/** Calcula todo lo que muestran las pantallas a partir de lo guardado. No guarda nada. */
export function derivar(d: Datos, hoy: string): Vista {
  const cotizacionesHoy = cotizacionesDeHoy(d)
  const productoPorId = new Map(d.productos.map((p) => [p.id, p]))
  const clientePorId = new Map(d.clientes.map((c) => [c.id, c]))
  const gastosPorViaje = agrupar(d.gastos, (g) => g.viajeId)
  const lotesPorViaje = agrupar(d.lotes, (l) => l.viajeId)

  const vendidasPorLote = new Map<string, number>()
  for (const item of d.items) for (const a of item.asignaciones) sumar(vendidasPorLote, a.loteId, a.unidades)
  const ajustesPorLote = new Map<string, number>()
  for (const m of d.movimientos) sumar(ajustesPorLote, m.loteId, m.unidades)

  // 1. Costos de cada lote: histórico (cotización del viaje) y reposición (cotización de hoy).
  const lotes = new Map<string, LoteVista>()
  const erroresDeViaje = new Map<string, string>()
  for (const viaje of d.viajes) {
    const lotesViaje = lotesPorViaje.get(viaje.id) ?? []
    const paraCostear = {
      cotizaciones: viaje.cotizaciones,
      modoProrrateo: viaje.modoProrrateo,
      gastos: gastosPorViaje.get(viaje.id) ?? [],
      lotes: lotesViaje,
    }
    let historico: CostoViaje | null = null
    let reposicion: CostoViaje | null = null
    try {
      historico = costearViaje(paraCostear)
      // Sin cotización de hoy cargada, la reposición usa la del viaje.
      reposicion = costearViaje(paraCostear, {
        BOB: cotizacionesHoy.BOB || viaje.cotizaciones.BOB,
        USD: cotizacionesHoy.USD || viaje.cotizaciones.USD,
      })
    } catch (error) {
      erroresDeViaje.set(viaje.id, error instanceof Error ? error.message : 'No se pudo calcular el costo')
    }
    lotesViaje.forEach((lote, i) => {
      const h = historico?.lotes[i]
      const unidades = lote.cantidad * UNIDADES_POR[lote.unidadCompra]
      const vendidas = vendidasPorLote.get(lote.id) ?? 0
      const ajustes = ajustesPorLote.get(lote.id) ?? 0
      lotes.set(lote.id, {
        lote,
        viaje,
        producto: productoPorId.get(lote.productoId),
        unidades,
        vendidas,
        ajustes,
        disponible: unidades - vendidas + ajustes,
        origenUnitario: h?.origenUnitario ?? Fraccion.CERO,
        gastoUnitario: h?.gastoUnitario ?? Fraccion.CERO,
        costoHistorico: h?.costoUnitario ?? Fraccion.CERO,
        costoReposicion: reposicion?.lotes[i]?.costoUnitario ?? Fraccion.CERO,
      })
    })
  }

  // 2. Productos: stock sumando lotes; precio a partir del último lote comprado.
  const todosLosLotes = [...lotes.values()]
  const ordenLote = (a: LoteVista, b: LoteVista) =>
    comparar(a.viaje.fecha, b.viaje.fecha) || comparar(a.lote.creadoEn, b.lote.creadoEn)
  const lotesPorProducto = agrupar(todosLosLotes, (l) => l.lote.productoId)
  const valorDeStock = (ls: LoteVista[]): Centavos =>
    Fraccion.suma(ls.map((l) => l.costoHistorico.por(Math.max(l.disponible, 0)))).redondear()

  const productos = d.productos
    .map((producto): ProductoVista => {
      const propios = (lotesPorProducto.get(producto.id) ?? []).sort(ordenLote)
      const stock = propios.reduce((total, l) => total + l.disponible, 0)
      const margen = producto.margenPct ?? d.config.margenDefecto
      const margenMayorista = producto.margenMayoristaPct ?? d.config.margenMayorista
      const base = propios.at(-1)?.costoReposicion
      const precio = (m: number, u: UnidadMedida) => (base ? precioSugerido(base, m, u, d.config.multiplo) : 0)
      return {
        producto,
        lotes: propios,
        stock,
        margen,
        margenMayorista,
        precios: base
          ? {
              minorista: { unidad: precio(margen, 'unidad'), docena: precio(margen, 'docena') },
              mayorista: { unidad: precio(margenMayorista, 'unidad'), docena: precio(margenMayorista, 'docena') },
            }
          : null,
        valorStock: valorDeStock(propios),
        bajoMinimo: producto.stockMinimo > 0 && stock <= producto.stockMinimo,
      }
    })
    .sort((a, b) => a.producto.nombre.localeCompare(b.producto.nombre, 'es'))

  // 3. Ventas: total, costo histórico y ganancia de cada línea.
  const itemsPorVenta = agrupar(d.items, (i) => i.ventaId)
  const envioPorVenta = new Map(d.envios.map((e) => [e.ventaId, e]))
  const ingresoPorLote = new Map<string, number>()
  const costoVendidoPorLote = new Map<string, number>()
  const ventasSinSaldo = d.ventas.map((venta) => {
    const items = (itemsPorVenta.get(venta.id) ?? []).map((item): ItemVista => {
      const total = totalLinea(item)
      const unidades = aUnidades(item.cantidad, item.unidadVenta)
      // Costo e ingreso se reparten por lote en centavos enteros, para que la
      // ganancia sumada por viaje coincida al centavo con la sumada por venta.
      let costo = 0
      let ingresoRepartido = 0
      item.asignaciones.forEach((a, n) => {
        const costoParte = (lotes.get(a.loteId)?.costoHistorico ?? Fraccion.CERO).por(a.unidades).redondear()
        const esUltima = n === item.asignaciones.length - 1
        const ingresoParte = esUltima ? total - ingresoRepartido : Fraccion.razon(total * a.unidades, unidades).redondear()
        costo += costoParte
        ingresoRepartido += ingresoParte
        sumar(costoVendidoPorLote, a.loteId, costoParte)
        sumar(ingresoPorLote, a.loteId, ingresoParte)
      })
      return { item, producto: productoPorId.get(item.productoId), unidades, total, costo, ganancia: total - costo }
    })
    const envio = envioPorVenta.get(venta.id)
    const envioPropio = envio && !envio.pagaCliente ? envio.costo : 0
    return {
      venta,
      cliente: venta.clienteId ? clientePorId.get(venta.clienteId) : undefined,
      items,
      envio,
      total: items.reduce((t, i) => t + i.total, 0),
      ganancia: items.reduce((t, i) => t + i.ganancia, 0) - envioPropio,
    }
  })

  // 4. Cuenta corriente por cliente ('' agrupa las ventas sin cliente).
  const claveCliente = (id: string | null) => id ?? ''
  const ordenVenta = (a: { venta: Venta }, b: { venta: Venta }) =>
    comparar(a.venta.fecha, b.venta.fecha) || comparar(a.venta.creadoEn, b.venta.creadoEn)
  const ventasPorCliente = agrupar(ventasSinSaldo, (v) => claveCliente(v.venta.clienteId))
  const pagosPorCliente = agrupar(d.pagos, (p) => claveCliente(p.clienteId))
  const ventas: VentaVista[] = []
  const cuentaPorCliente = new Map<string, { ventas: VentaVista[]; deuda: Centavos; saldoAFavor: Centavos }>()
  for (const clave of new Set([...ventasPorCliente.keys(), ...pagosPorCliente.keys()])) {
    const propias = (ventasPorCliente.get(clave) ?? []).sort(ordenVenta)
    const cuenta = calcularCuenta(
      propias.map((v) => ({ id: v.venta.id, fecha: v.venta.fecha, total: v.total })),
      (pagosPorCliente.get(clave) ?? []).map((p) => ({
        id: p.id,
        fecha: p.fecha,
        monto: p.monto,
        ventaId: p.ventaId ?? undefined,
      })),
    )
    const saldoPorVenta = new Map(cuenta.ventas.map((v) => [v.id, v]))
    const conSaldo = propias.map((v): VentaVista => {
      const s = saldoPorVenta.get(v.venta.id)
      return { ...v, pagado: s?.pagado ?? 0, saldo: s?.saldo ?? v.total, estado: s?.estado ?? 'debe' }
    })
    ventas.push(...conSaldo)
    cuentaPorCliente.set(clave, { ventas: conSaldo, deuda: cuenta.deuda, saldoAFavor: cuenta.saldoAFavor })
  }
  ventas.sort((a, b) => ordenVenta(b, a))

  const clientes = d.clientes
    .map((cliente): ClienteVista => {
      const cuenta = cuentaPorCliente.get(cliente.id)
      const propias = [...(cuenta?.ventas ?? [])].reverse()
      const deuda = cuenta?.deuda ?? 0
      return {
        cliente,
        ventas: propias,
        pagos: (pagosPorCliente.get(cliente.id) ?? []).sort((a, b) => comparar(b.fecha, a.fecha)),
        deuda,
        saldoAFavor: cuenta?.saldoAFavor ?? 0,
        antiguedad: antiguedadDe(propias, hoy),
        superaLimite: cliente.limiteCredito !== null && deuda > cliente.limiteCredito,
      }
    })
    .sort((a, b) => a.cliente.nombre.localeCompare(b.cliente.nombre, 'es'))

  // 5. Viajes: cuánto se invirtió, cuánto se vendió y cuánto dejó cada uno.
  const lotesVistaPorViaje = agrupar(todosLosLotes, (l) => l.lote.viajeId)
  const viajes = d.viajes
    .map((viaje): ViajeVista => {
      const propios = (lotesVistaPorViaje.get(viaje.id) ?? []).sort((a, b) =>
        comparar(a.lote.creadoEn, b.lote.creadoEn),
      )
      const vendido = propios.reduce((t, l) => t + (ingresoPorLote.get(l.lote.id) ?? 0), 0)
      const costoVendido = propios.reduce((t, l) => t + (costoVendidoPorLote.get(l.lote.id) ?? 0), 0)
      return {
        viaje,
        gastos: [...(gastosPorViaje.get(viaje.id) ?? [])].sort((a, b) => comparar(a.creadoEn, b.creadoEn)),
        lotes: propios,
        error: erroresDeViaje.get(viaje.id) ?? null,
        totalGastos: Fraccion.suma(propios.map((l) => l.gastoUnitario.por(l.unidades))).redondear(),
        totalCompra: Fraccion.suma(propios.map((l) => l.origenUnitario.por(l.unidades))).redondear(),
        unidades: propios.reduce((t, l) => t + l.unidades, 0),
        unidadesVendidas: propios.reduce((t, l) => t + l.vendidas, 0),
        vendido,
        ganancia: vendido - costoVendido,
        valorStock: valorDeStock(propios),
        tieneSalidas: propios.some((l) => l.vendidas > 0 || l.ajustes !== 0),
      }
    })
    .sort((a, b) => comparar(b.viaje.fecha, a.viaje.fecha) || comparar(b.viaje.creadoEn, a.viaje.creadoEn))

  return {
    cotizacionesHoy,
    lotes,
    productos,
    ventas,
    clientes,
    viajes,
    totales: {
      ganancia: ventas.reduce((t, v) => t + v.ganancia, 0),
      porCobrar: ventas.reduce((t, v) => t + v.saldo, 0),
      cobrado: d.pagos.reduce((t, p) => t + p.monto, 0),
      valorStock: valorDeStock(todosLosLotes),
      antiguedad: antiguedadDe(ventas, hoy),
    },
  }
}

export type LineaNueva = {
  productoId: string
  cantidad: number
  unidadVenta: UnidadMedida
  precio: Centavos
  descuento: Centavos
}

/**
 * Reparte cada línea de una venta entre los lotes (primero lo más viejo).
 * Si un producto aparece en dos líneas, la segunda no reutiliza el stock de la primera.
 */
export function asignarLineas(lineas: LineaNueva[], productos: ProductoVista[]): Asignacion[][] {
  const restante = new Map<string, number>()
  return lineas.map((linea) => {
    const producto = productos.find((p) => p.producto.id === linea.productoId)
    if (!producto) throw new Error('El producto ya no existe')
    const disponibles = producto.lotes.map((l) => ({
      loteId: l.lote.id,
      fecha: l.viaje.fecha,
      disponible: restante.get(l.lote.id) ?? l.disponible,
    }))
    const asignaciones = asignarFifo(disponibles, aUnidades(linea.cantidad, linea.unidadVenta))
    for (const d of disponibles) restante.set(d.loteId, d.disponible)
    for (const a of asignaciones) restante.set(a.loteId, (restante.get(a.loteId) ?? 0) - a.unidades)
    return asignaciones
  })
}

export type FilaReporte = { id: string; nombre: string; unidades: number; total: Centavos; ganancia: Centavos }

export type ResumenPeriodo = {
  ventas: VentaVista[]
  total: Centavos
  ganancia: Centavos
  porProducto: FilaReporte[]
  porCliente: FilaReporte[]
}

/** Ventas de un período ('' = sin límite) agrupadas por producto y por cliente. */
export function resumirPeriodo(vista: Vista, desde: string, hasta: string): ResumenPeriodo {
  const ventas = vista.ventas.filter(
    (v) => (!desde || v.venta.fecha >= desde) && (!hasta || v.venta.fecha <= hasta),
  )
  const acumular = (mapa: Map<string, FilaReporte>, id: string, nombre: string, f: Omit<FilaReporte, 'id' | 'nombre'>) => {
    const fila = mapa.get(id) ?? { id, nombre, unidades: 0, total: 0, ganancia: 0 }
    fila.unidades += f.unidades
    fila.total += f.total
    fila.ganancia += f.ganancia
    mapa.set(id, fila)
  }
  const porProducto = new Map<string, FilaReporte>()
  const porCliente = new Map<string, FilaReporte>()
  for (const v of ventas) {
    const unidades = v.items.reduce((t, i) => t + i.unidades, 0)
    acumular(porCliente, v.venta.clienteId ?? '', v.cliente?.nombre ?? 'Sin cliente', {
      unidades,
      total: v.total,
      ganancia: v.ganancia,
    })
    for (const i of v.items) {
      acumular(porProducto, i.item.productoId, i.producto?.nombre ?? 'Producto borrado', i)
    }
  }
  const ordenados = (mapa: Map<string, FilaReporte>) => [...mapa.values()].sort((a, b) => b.ganancia - a.ganancia)
  return {
    ventas,
    total: ventas.reduce((t, v) => t + v.total, 0),
    ganancia: ventas.reduce((t, v) => t + v.ganancia, 0),
    porProducto: ordenados(porProducto),
    porCliente: ordenados(porCliente),
  }
}
