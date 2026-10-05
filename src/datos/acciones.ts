import type { Centavos } from '../nucleo/dinero'
import { describirUnidades } from '../nucleo/unidades'
import { asignarFifo, totalLinea } from '../nucleo/ventas'
import { anotar, armar, borrar, db, tabla, type Grupo } from './db'
import { asignarLineas, type LineaNueva, type Vista } from './derivar'
import type { MedioPago, Movimiento } from './tipos'

export type VentaNueva = {
  fecha: string
  clienteId: string | null
  notas: string
  lineas: LineaNueva[]
  pagaAhora: Centavos
  medio: MedioPago
}

/** Guarda la venta con sus líneas, descuenta stock (primero lo más viejo) y registra el pago inicial. */
export async function registrarVenta(vista: Vista, nueva: VentaNueva): Promise<string> {
  if (nueva.lineas.length === 0) throw new Error('Agregá al menos un producto')
  const asignaciones = asignarLineas(nueva.lineas, vista.productos)
  const venta = armar<'ventas'>({ fecha: nueva.fecha, clienteId: nueva.clienteId, notas: nueva.notas })
  const items = nueva.lineas.map((linea, i) =>
    armar<'items'>({ ...linea, ventaId: venta.id, asignaciones: asignaciones[i] ?? [] }),
  )
  const total = items.reduce((t, i) => t + totalLinea(i), 0)
  if (total < 0) throw new Error('El descuento no puede superar el total')
  // Sin cliente no hay cuenta corriente: la venta se cobra entera en el momento.
  const pagaAhora = nueva.clienteId === null ? total : Math.min(nueva.pagaAhora, total)

  await db.transaction('rw', [tabla('ventas'), tabla('items'), tabla('pagos'), db.cambios], async () => {
    await tabla('ventas').add(venta)
    await tabla('items').bulkAdd(items)
    if (pagaAhora > 0) {
      await tabla('pagos').add(
        armar<'pagos'>({
          fecha: nueva.fecha,
          clienteId: nueva.clienteId,
          monto: pagaAhora,
          ventaId: venta.id,
          medio: nueva.medio,
          notas: '',
        }),
      )
    }
    await anotar('ventas', venta.id, 'crear', 'Venta registrada')
  })
  return venta.id
}

/** Borra la venta con sus líneas, su envío y los cobros hechos a esa venta. Devuelve la marca para deshacer. */
export function borrarVenta(vista: Vista, ventaId: string, pagosDeLaVenta: string[]): Promise<string> {
  const v = vista.ventas.find((x) => x.venta.id === ventaId)
  if (!v) throw new Error('La venta ya no existe')
  const grupos: Grupo[] = [
    { tabla: 'ventas', ids: [ventaId] },
    { tabla: 'items', ids: v.items.map((i) => i.item.id) },
    { tabla: 'pagos', ids: pagosDeLaVenta },
  ]
  if (v.envio) grupos.push({ tabla: 'envios', ids: [v.envio.id] })
  return borrar(grupos, `Venta a ${v.cliente?.nombre ?? 'sin cliente'}`)
}

export function borrarViaje(vista: Vista, viajeId: string): Promise<string> {
  const v = vista.viajes.find((x) => x.viaje.id === viajeId)
  if (!v) throw new Error('El viaje ya no existe')
  if (v.tieneSalidas) {
    throw new Error('No se puede borrar: ya hay ventas o ajustes de mercadería de este viaje')
  }
  return borrar(
    [
      { tabla: 'viajes', ids: [viajeId] },
      { tabla: 'gastos', ids: v.gastos.map((g) => g.id) },
      { tabla: 'lotes', ids: v.lotes.map((l) => l.lote.id) },
    ],
    `Viaje a ${v.viaje.destino}`,
  )
}

export function borrarLote(vista: Vista, loteId: string): Promise<string> {
  const l = vista.lotes.get(loteId)
  if (!l) throw new Error('La compra ya no existe')
  if (l.vendidas > 0 || l.ajustes !== 0) {
    throw new Error('No se puede borrar: ya hay ventas o ajustes de esta mercadería')
  }
  return borrar([{ tabla: 'lotes', ids: [loteId] }], `Compra de ${l.producto?.nombre ?? 'producto'}`)
}

export function borrarProducto(vista: Vista, productoId: string): Promise<string> {
  const p = vista.productos.find((x) => x.producto.id === productoId)
  if (!p) throw new Error('El producto ya no existe')
  if (p.lotes.length > 0) throw new Error('No se puede borrar: el producto tiene compras cargadas en viajes')
  return borrar([{ tabla: 'productos', ids: [productoId] }], `Producto ${p.producto.nombre}`)
}

export function borrarCliente(vista: Vista, clienteId: string): Promise<string> {
  const c = vista.clientes.find((x) => x.cliente.id === clienteId)
  if (!c) throw new Error('El cliente ya no existe')
  if (c.ventas.length > 0 || c.pagos.length > 0) {
    throw new Error('No se puede borrar: el cliente tiene ventas o cobros registrados')
  }
  return borrar([{ tabla: 'clientes', ids: [clienteId] }], `Cliente ${c.cliente.nombre}`)
}

/**
 * Merma o ajuste de stock. unidades negativo saca del stock empezando por lo
 * más viejo; positivo suma al último lote comprado.
 */
export async function registrarMovimiento(
  vista: Vista,
  m: Pick<Movimiento, 'productoId' | 'fecha' | 'tipo' | 'motivo' | 'unidades'>,
): Promise<void> {
  const p = vista.productos.find((x) => x.producto.id === m.productoId)
  if (!p) throw new Error('El producto ya no existe')
  if (m.unidades === 0) throw new Error('La cantidad no puede ser cero')
  const ultimo = p.lotes.at(-1)
  if (!ultimo) throw new Error('El producto todavía no se compró en ningún viaje')
  const reparto =
    m.unidades < 0
      ? asignarFifo(
          p.lotes.map((l) => ({ loteId: l.lote.id, fecha: l.viaje.fecha, disponible: l.disponible })),
          -m.unidades,
        ).map((a) => ({ loteId: a.loteId, unidades: -a.unidades }))
      : [{ loteId: ultimo.lote.id, unidades: m.unidades }]
  const filas = reparto.map((r) => armar<'movimientos'>({ ...m, ...r }))
  await db.transaction('rw', [tabla('movimientos'), db.cambios], async () => {
    await tabla('movimientos').bulkAdd(filas)
    await anotar(
      'productos',
      m.productoId,
      'editar',
      `${m.tipo === 'merma' ? 'Merma' : 'Ajuste'} de ${describirUnidades(Math.abs(m.unidades))}: ${m.motivo}`,
    )
  })
}
