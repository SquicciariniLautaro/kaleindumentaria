import { describe, expect, it } from 'vitest'
import { COTIZACIONES_EJEMPLO, VIAJE_EJEMPLO } from '../nucleo/ejemplo'
import { StockInsuficiente } from '../nucleo/ventas'
import { asignarLineas, derivar, resumirPeriodo, type Datos } from './derivar'
import type { Base, Config } from './tipos'

const base = (id: string, creadoEn = '2026-01-01T00:00:00.000Z'): Base => ({ id, creadoEn, actualizadoEn: creadoEn, borradoEn: null })

const config: Config = {
  ...base('config'),
  nombreNegocio: 'Prueba',
  margenDefecto: 30,
  margenMayorista: 20,
  multiplo: 100,
  tema: 'auto',
  tipoCotizacion: { BOB: 'Oficial', USD: 'Oficial' },
}

const HOY = '2026-10-05'

/** El viaje del prototipo más un segundo viaje de zapatillas, dos clientes, dos ventas, un cobro y un envío. */
function datosDePrueba(): Datos {
  return {
    config,
    cotizaciones: [
      { ...base('c1'), fecha: '2026-09-01', moneda: 'BOB', tipo: 'Oficial', valor: 210_000_000 },
      { ...base('c2'), fecha: HOY, moneda: 'BOB', tipo: 'Oficial', valor: 250_000_000 },
      { ...base('c3'), fecha: HOY, moneda: 'BOB', tipo: 'Blue', valor: 300_000_000 },
      { ...base('c4'), fecha: HOY, moneda: 'USD', tipo: 'Oficial', valor: 1_500_000_000 },
    ],
    viajes: [
      { ...base('v1'), fecha: '2026-08-01', destino: 'Villazón', modoProrrateo: 'unidad', cotizaciones: COTIZACIONES_EJEMPLO, cerrado: false, notas: '' },
      { ...base('v2'), fecha: '2026-09-15', destino: 'Villazón', modoProrrateo: 'unidad', cotizaciones: COTIZACIONES_EJEMPLO, cerrado: false, notas: '' },
    ],
    gastos: VIAJE_EJEMPLO.gastos.map((g, i) => ({ ...base(`g${i}`), viajeId: 'v1', concepto: 'Gasto', ...g })),
    plantillas: [],
    productos: [
      { ...base('zap'), nombre: 'Zapatillas', sku: 'ZAP-1', margenPct: null, margenMayoristaPct: null, stockMinimo: 30, fotoId: null },
      { ...base('par'), nombre: 'Parlante', sku: '', margenPct: 40, margenMayoristaPct: null, stockMinimo: 0, fotoId: null },
    ],
    lotes: [
      { ...base('l-zap'), viajeId: 'v1', productoId: 'zap', cantidad: 2, unidadCompra: 'docena', costoOrigen: 180_000, moneda: 'BOB', peso: 0 },
      { ...base('l-par'), viajeId: 'v1', productoId: 'par', cantidad: 10, unidadCompra: 'unidad', costoOrigen: 1_200, moneda: 'USD', peso: 0 },
      // Segundo viaje sin gastos: 1 docena a 2.400 BOB → 40.000 por unidad.
      { ...base('l-zap2'), viajeId: 'v2', productoId: 'zap', cantidad: 1, unidadCompra: 'docena', costoOrigen: 240_000, moneda: 'BOB', peso: 0 },
    ],
    movimientos: [{ ...base('m1'), fecha: '2026-08-10', productoId: 'par', loteId: 'l-par', unidades: -1, tipo: 'merma', motivo: 'Roto' }],
    clientes: [
      { ...base('carlos'), nombre: 'Carlos', documento: '30123456', telefono: '', direccion: '', limiteCredito: 5_000_000, notas: '' },
      { ...base('ana'), nombre: 'Ana', documento: '', telefono: '', direccion: '', limiteCredito: null, notas: '' },
    ],
    ventas: [
      { ...base('venta1'), fecha: '2026-08-05', clienteId: 'carlos', notas: '' },
      { ...base('venta2'), fecha: '2026-09-20', clienteId: 'ana', notas: '' },
    ],
    items: [
      // 3 zapatillas a 45.000: la venta del prototipo.
      { ...base('i1'), ventaId: 'venta1', productoId: 'zap', cantidad: 3, unidadVenta: 'unidad', precio: 4_500_000, descuento: 0, asignaciones: [{ loteId: 'l-zap', unidades: 3 }] },
      { ...base('i2'), ventaId: 'venta2', productoId: 'par', cantidad: 2, unidadVenta: 'unidad', precio: 2_830_000, descuento: 0, asignaciones: [{ loteId: 'l-par', unidades: 2 }] },
    ],
    pagos: [{ ...base('p1'), fecha: '2026-08-05', clienteId: 'carlos', monto: 5_000_000, ventaId: 'venta1', medio: 'efectivo', notas: '' }],
    envios: [
      { ...base('e1'), ventaId: 'venta2', fecha: '2026-09-21', transportista: 'Vía Cargo', provincia: 'Salta', localidad: 'Salta', guia: 'VC-1', costo: 500_000, pagaCliente: false, estado: 'despachado' },
    ],
    comprobantes: [],
  }
}

describe('derivar', () => {
  const vista = derivar(datosDePrueba(), HOY)
  const producto = (id: string) => vista.productos.find((p) => p.producto.id === id)!
  const venta = (id: string) => vista.ventas.find((v) => v.venta.id === id)!
  const cliente = (id: string) => vista.clientes.find((c) => c.cliente.id === id)!

  it('usa la última cotización del tipo elegido en Configuración', () => {
    expect(vista.cotizacionesHoy).toEqual({ BOB: 250_000_000, USD: 1_500_000_000 })
  })

  it('calcula el stock restando ventas y mermas', () => {
    expect(producto('zap').stock).toBe(24 - 3 + 12)
    expect(producto('par').stock).toBe(10 - 2 - 1)
  })

  it('avisa stock bajo solo si hay mínimo cargado', () => {
    expect(producto('zap').bajoMinimo).toBe(false)
    expect(producto('par').bajoMinimo).toBe(false)
    const conMinimoAlto = datosDePrueba()
    conMinimoAlto.productos[0]!.stockMinimo = 40
    expect(derivar(conMinimoAlto, HOY).productos.find((p) => p.producto.id === 'zap')!.bajoMinimo).toBe(true)
  })

  it('el precio sale del último viaje con la cotización de hoy', () => {
    // Último lote de zapatillas: 2.400 BOB ÷ 12 × 250 = 50.000; +30 % = 65.000; +20 % = 60.000.
    expect(producto('zap').precios).toEqual({
      minorista: { unidad: 6_500_000, docena: 78_000_000 },
      mayorista: { unidad: 6_000_000, docena: 72_000_000 },
    })
  })

  it('un producto sin compras no tiene precio', () => {
    const d = datosDePrueba()
    d.productos.push({ ...base('nuevo'), nombre: 'Nuevo', sku: '', margenPct: null, margenMayoristaPct: null, stockMinimo: 0, fotoId: null })
    expect(derivar(d, HOY).productos.find((p) => p.producto.id === 'nuevo')!.precios).toBeNull()
  })

  it('la ganancia de la venta usa el costo histórico del lote', () => {
    expect(venta('venta1').ganancia).toBe(3_485_294)
  })

  it('el envío que paga el negocio se descuenta de la ganancia', () => {
    // 2 parlantes a 28.300 = 56.600; costo 2 × 20.182,35 = 40.364,71; envío 5.000.
    expect(venta('venta2').total).toBe(5_660_000)
    expect(venta('venta2').ganancia).toBe(5_660_000 - 4_036_471 - 500_000)
  })

  it('calcula deuda, estado y antigüedad por cliente', () => {
    expect(venta('venta1').estado).toBe('parcial')
    expect(cliente('carlos').deuda).toBe(8_500_000)
    expect(cliente('carlos').superaLimite).toBe(true)
    // Venta del 05/08 vista el 05/10: 61 días.
    expect(cliente('carlos').antiguedad).toEqual({ hasta30: 0, hasta60: 0, masDe60: 8_500_000 })
    expect(cliente('ana').antiguedad).toEqual({ hasta30: 5_660_000, hasta60: 0, masDe60: 0 })
  })

  it('totales del negocio', () => {
    expect(vista.totales.porCobrar).toBe(8_500_000 + 5_660_000)
    expect(vista.totales.cobrado).toBe(5_000_000)
    expect(vista.totales.ganancia).toBe(3_485_294 + 1_123_529)
  })

  it('rentabilidad por viaje: lo vendido menos su costo, sin contar envíos', () => {
    const v1 = vista.viajes.find((v) => v.viaje.id === 'v1')!
    expect(v1.totalGastos).toBe(11_500_000)
    expect(v1.vendido).toBe(13_500_000 + 5_660_000)
    expect(v1.ganancia).toBe(3_485_294 + 1_623_529)
    expect(v1.tieneSalidas).toBe(true)
    expect(vista.viajes.find((v) => v.viaje.id === 'v2')!.tieneSalidas).toBe(false)
  })

  it('un viaje sin cotización no rompe el resto: avisa el error', () => {
    const d = datosDePrueba()
    d.viajes[1]!.cotizaciones = { BOB: 0, USD: 0 }
    const conError = derivar(d, HOY)
    expect(conError.viajes.find((v) => v.viaje.id === 'v2')!.error).toBe('Falta la cotización de BOB')
    expect(conError.ventas.find((v) => v.venta.id === 'venta1')!.ganancia).toBe(3_485_294)
  })
})

describe('asignarLineas', () => {
  const vista = derivar(datosDePrueba(), HOY)
  const linea = (cantidad: number, unidadVenta: 'unidad' | 'docena' = 'unidad') => ({ productoId: 'zap', cantidad, unidadVenta, precio: 100, descuento: 0 })

  it('toma primero del viaje más viejo y sigue con el nuevo', () => {
    // Quedan 21 del viaje de agosto y 12 del de septiembre.
    expect(asignarLineas([linea(2, 'docena')], vista.productos)).toEqual([
      [
        { loteId: 'l-zap', unidades: 21 },
        { loteId: 'l-zap2', unidades: 3 },
      ],
    ])
  })

  it('dos líneas del mismo producto no usan dos veces el mismo stock', () => {
    expect(asignarLineas([linea(20), linea(5)], vista.productos)).toEqual([
      [{ loteId: 'l-zap', unidades: 20 }],
      [
        { loteId: 'l-zap', unidades: 1 },
        { loteId: 'l-zap2', unidades: 4 },
      ],
    ])
    expect(() => asignarLineas([linea(20), linea(14)], vista.productos)).toThrow(StockInsuficiente)
  })
})

describe('resumirPeriodo', () => {
  const vista = derivar(datosDePrueba(), HOY)

  it('filtra por fechas y agrupa por producto y por cliente', () => {
    const septiembre = resumirPeriodo(vista, '2026-09-01', '2026-09-30')
    expect(septiembre.ventas).toHaveLength(1)
    expect(septiembre.total).toBe(5_660_000)
    expect(septiembre.porProducto).toEqual([{ id: 'par', nombre: 'Parlante', unidades: 2, total: 5_660_000, ganancia: 1_623_529 }])
    expect(septiembre.porCliente[0]).toMatchObject({ nombre: 'Ana', ganancia: 1_123_529 })
  })

  it('sin fechas incluye todo', () => {
    expect(resumirPeriodo(vista, '', '').ventas).toHaveLength(2)
  })
})
