import { fechaLocal, sumarDias } from '../nucleo/fecha'
import { armar, db, tabla } from './db'

/** Carga un viaje, productos, clientes y ventas de muestra para probar la app. */
export async function cargarEjemplo(): Promise<void> {
  const hoy = fechaLocal()
  const haceDias = (n: number) => sumarDias(hoy, -n)

  const cotizaciones = [
    armar<'cotizaciones'>({ fecha: hoy, moneda: 'BOB', tipo: 'Oficial', valor: 200_000_000 }),
    armar<'cotizaciones'>({ fecha: hoy, moneda: 'USD', tipo: 'Oficial', valor: 1_400_000_000 }),
  ]
  const jean = armar<'productos'>({
    nombre: 'Jean mujer (ejemplo)',
    sku: 'JEA-001',
    margenPct: null,
    margenMayoristaPct: null,
    stockMinimo: 12,
    fotoId: null,
  })
  const remera = armar<'productos'>({
    nombre: 'Remera estampada (ejemplo)',
    sku: 'REM-001',
    margenPct: 35,
    margenMayoristaPct: null,
    stockMinimo: 48,
    fotoId: null,
  })
  const campera = armar<'productos'>({
    nombre: 'Campera puffer (ejemplo)',
    sku: 'CAM-001',
    margenPct: 45,
    margenMayoristaPct: 30,
    stockMinimo: 3,
    fotoId: null,
  })
  const viaje = armar<'viajes'>({
    fecha: haceDias(45),
    destino: 'Villazón (ejemplo)',
    modoProrrateo: 'valor',
    cotizaciones: { BOB: 195_000_000, USD: 1_380_000_000 },
    cerrado: false,
    notas: '',
  })
  const gastos = [
    armar<'gastos'>({ viajeId: viaje.id, concepto: 'Pasajes', monto: 6_000_000, moneda: 'ARS' }),
    armar<'gastos'>({ viajeId: viaje.id, concepto: 'Peajes', monto: 1_500_000, moneda: 'ARS' }),
    armar<'gastos'>({ viajeId: viaje.id, concepto: 'Viáticos', monto: 20_000, moneda: 'BOB' }),
  ]
  const plantillas = gastos.map((g) => armar<'plantillas'>({ concepto: g.concepto, monto: g.monto, moneda: g.moneda }))
  const loteJean = armar<'lotes'>({
    viajeId: viaje.id,
    productoId: jean.id,
    cantidad: 3,
    unidadCompra: 'docena',
    costoOrigen: 150_000,
    moneda: 'BOB',
    peso: 0,
  })
  const loteRemera = armar<'lotes'>({
    viajeId: viaje.id,
    productoId: remera.id,
    cantidad: 5,
    unidadCompra: 'docena',
    costoOrigen: 48_000,
    moneda: 'BOB',
    peso: 0,
  })
  const loteCampera = armar<'lotes'>({
    viajeId: viaje.id,
    productoId: campera.id,
    cantidad: 10,
    unidadCompra: 'unidad',
    costoOrigen: 2_500,
    moneda: 'USD',
    peso: 0,
  })
  const maria = armar<'clientes'>({
    nombre: 'María López (ejemplo)',
    documento: '30123456',
    telefono: '388 412-3456',
    direccion: 'Av. Belgrano 123, San Salvador de Jujuy',
    limiteCredito: null,
    notas: '',
  })
  const boutique = armar<'clientes'>({
    nombre: 'Boutique Centro (ejemplo)',
    documento: '27-28999111-4',
    telefono: '381 555-0199',
    direccion: 'San Martín 450, San Miguel de Tucumán',
    limiteCredito: 50_000_000,
    notas: 'Paga por transferencia a fin de mes.',
  })
  const venta1 = armar<'ventas'>({ fecha: haceDias(35), clienteId: maria.id, notas: '' })
  const venta2 = armar<'ventas'>({ fecha: haceDias(5), clienteId: boutique.id, notas: '' })
  const items = [
    armar<'items'>({
      ventaId: venta1.id,
      productoId: jean.id,
      cantidad: 1,
      unidadVenta: 'docena',
      precio: 43_000_000,
      descuento: 0,
      asignaciones: [{ loteId: loteJean.id, unidades: 12 }],
    }),
    armar<'items'>({
      ventaId: venta2.id,
      productoId: remera.id,
      cantidad: 2,
      unidadVenta: 'docena',
      precio: 14_500_000,
      descuento: 0,
      asignaciones: [{ loteId: loteRemera.id, unidades: 24 }],
    }),
    armar<'items'>({
      ventaId: venta2.id,
      productoId: campera.id,
      cantidad: 2,
      unidadVenta: 'unidad',
      precio: 6_200_000,
      descuento: 200_000,
      asignaciones: [{ loteId: loteCampera.id, unidades: 2 }],
    }),
  ]
  const pago = armar<'pagos'>({
    fecha: haceDias(35),
    clienteId: maria.id,
    monto: 20_000_000,
    ventaId: venta1.id,
    medio: 'transferencia',
    notas: '',
  })
  const envio = armar<'envios'>({
    ventaId: venta2.id,
    fecha: haceDias(4),
    transportista: 'Vía Cargo',
    provincia: 'Tucumán',
    localidad: 'San Miguel de Tucumán',
    guia: 'VC-000-123',
    costo: 950_000,
    pagaCliente: false,
    estado: 'despachado',
  })
  const comprobante = armar<'comprobantes'>({
    fecha: haceDias(35),
    clienteId: maria.id,
    monto: 20_000_000,
    banco: 'Mercado Pago',
    referencia: '000123456',
    fotoId: null,
    pagoId: pago.id,
    verificado: false,
    notas: '',
  })

  await db.transaction('rw', db.tables, async () => {
    await tabla('cotizaciones').bulkAdd(cotizaciones)
    await tabla('productos').bulkAdd([jean, remera, campera])
    await tabla('viajes').add(viaje)
    await tabla('gastos').bulkAdd(gastos)
    await tabla('plantillas').bulkAdd(plantillas)
    await tabla('lotes').bulkAdd([loteJean, loteRemera, loteCampera])
    await tabla('clientes').bulkAdd([maria, boutique])
    await tabla('ventas').bulkAdd([venta1, venta2])
    await tabla('items').bulkAdd(items)
    await tabla('pagos').add(pago)
    await tabla('envios').add(envio)
    await tabla('comprobantes').add(comprobante)
  })
}
