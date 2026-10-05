import Dexie, { type Table } from 'dexie'
import type { Datos } from './derivar'
import type {
  Base,
  Cambio,
  Cliente,
  Comprobante,
  Config,
  Cotizacion,
  Envio,
  Foto,
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

export type Tablas = {
  config: Config
  cotizaciones: Cotizacion
  viajes: Viaje
  gastos: ViajeGasto
  plantillas: PlantillaGasto
  productos: Producto
  lotes: Lote
  movimientos: Movimiento
  clientes: Cliente
  ventas: Venta
  items: VentaItem
  pagos: Pago
  envios: Envio
  comprobantes: Comprobante
}

export type NombreTabla = keyof Tablas

export const TABLAS = [
  'config',
  'cotizaciones',
  'viajes',
  'gastos',
  'plantillas',
  'productos',
  'lotes',
  'movimientos',
  'clientes',
  'ventas',
  'items',
  'pagos',
  'envios',
  'comprobantes',
] as const satisfies readonly NombreTabla[]

class BaseDatos extends Dexie {
  cambios!: Table<Cambio, string>
  fotos!: Table<Foto, string>

  constructor() {
    super('gestion-comercial')
    this.version(1).stores({
      ...Object.fromEntries(TABLAS.map((t) => [t, 'id'])),
      cambios: 'id, fecha, registroId',
      fotos: 'id',
    })
  }
}

export const db = new BaseDatos()

// Las tablas de datos comparten los campos de Base; el tipo exacto lo ponen las funciones de abajo.
export const tabla = (nombre: NombreTabla) => db.table(nombre) as Table<any, string>

export const nuevoId = (): string => crypto.randomUUID()
const ahora = (): string => new Date().toISOString()

export type Nuevo<T extends NombreTabla> = Omit<Tablas[T], keyof Base>

export const CONFIG_INICIAL: Config = {
  id: 'config',
  creadoEn: '',
  actualizadoEn: '',
  borradoEn: null,
  nombreNegocio: 'Kale Indumentaria',
  margenDefecto: 30,
  margenMayorista: 20,
  multiplo: 100,
  tema: 'auto',
  tipoCotizacion: { BOB: 'Oficial', USD: 'Oficial' },
}

async function vivos<T extends NombreTabla>(nombre: T): Promise<Tablas[T][]> {
  const filas = (await tabla(nombre).toArray()) as Tablas[T][]
  return filas.filter((f) => f.borradoEn === null)
}

/** Lee todo lo que no está en la papelera. */
export async function leerDatos(): Promise<Datos> {
  const [config, cotizaciones, viajes, gastos, plantillas, productos, lotes, movimientos] = await Promise.all([
    tabla('config').get('config') as Promise<Config | undefined>,
    vivos('cotizaciones'),
    vivos('viajes'),
    vivos('gastos'),
    vivos('plantillas'),
    vivos('productos'),
    vivos('lotes'),
    vivos('movimientos'),
  ])
  const [clientes, ventas, items, pagos, envios, comprobantes] = await Promise.all([
    vivos('clientes'),
    vivos('ventas'),
    vivos('items'),
    vivos('pagos'),
    vivos('envios'),
    vivos('comprobantes'),
  ])
  return {
    config: config ?? CONFIG_INICIAL,
    cotizaciones,
    viajes,
    gastos,
    plantillas,
    productos,
    lotes,
    movimientos,
    clientes,
    ventas,
    items,
    pagos,
    envios,
    comprobantes,
  }
}

/** Arma una fila nueva con id y fechas, sin guardarla. */
export function armar<T extends NombreTabla>(datos: Nuevo<T>): Tablas[T] {
  const fecha = ahora()
  return { ...datos, id: nuevoId(), creadoEn: fecha, actualizadoEn: fecha, borradoEn: null } as Tablas[T]
}

export function anotar(
  nombre: NombreTabla,
  registroId: string,
  accion: Cambio['accion'],
  resumen: string,
  marca: string | null = null,
) {
  return db.cambios.add({
    id: nuevoId(),
    fecha: ahora(),
    tabla: nombre,
    registroId,
    accion,
    resumen,
    marca,
    restaurado: false,
  })
}

export async function crear<T extends NombreTabla>(nombre: T, datos: Nuevo<T>, resumen: string): Promise<Tablas[T]> {
  const fila = armar<T>(datos)
  await db.transaction('rw', [tabla(nombre), db.cambios], async () => {
    await tabla(nombre).add(fila)
    await anotar(nombre, fila.id, 'crear', resumen)
  })
  return fila
}

export async function editar<T extends NombreTabla>(
  nombre: T,
  id: string,
  cambios: Partial<Nuevo<T>>,
  resumen: string,
): Promise<void> {
  await db.transaction('rw', [tabla(nombre), db.cambios], async () => {
    await tabla(nombre).update(id, { ...cambios, actualizadoEn: ahora() })
    await anotar(nombre, id, 'editar', resumen)
  })
}

export async function guardarConfig(actual: Config, cambios: Partial<Nuevo<'config'>>): Promise<void> {
  const fecha = ahora()
  await tabla('config').put({ ...actual, ...cambios, id: 'config', creadoEn: actual.creadoEn || fecha, actualizadoEn: fecha })
}

export type Grupo = { tabla: NombreTabla; ids: string[] }

/**
 * Manda filas a la papelera. Todo lo que se borra junto comparte una marca,
 * que sirve para restaurarlo de una sola vez. El primer grupo es el principal.
 */
export async function borrar(grupos: Grupo[], resumen: string): Promise<string> {
  const marca = ahora()
  const tablas = [...new Set(grupos.map((g) => g.tabla))].map(tabla)
  await db.transaction('rw', [...tablas, db.cambios], async () => {
    for (const g of grupos) {
      await tabla(g.tabla).where('id').anyOf(g.ids).modify({ borradoEn: marca, actualizadoEn: marca })
    }
    const principal = grupos[0]
    if (principal?.ids[0]) await anotar(principal.tabla, principal.ids[0], 'borrar', resumen, marca)
  })
  return marca
}

export async function restaurar(marca: string): Promise<void> {
  await db.transaction('rw', [...TABLAS.map(tabla), db.cambios], async () => {
    for (const nombre of TABLAS) {
      await tabla(nombre)
        .filter((f: Base) => f.borradoEn === marca)
        .modify({ borradoEn: null, actualizadoEn: ahora() })
    }
    await db.cambios.filter((c) => c.marca === marca).modify({ restaurado: true })
  })
}

export async function guardarFoto(dataUrl: string): Promise<string> {
  const id = nuevoId()
  await db.fotos.add({ id, dataUrl })
  return id
}
