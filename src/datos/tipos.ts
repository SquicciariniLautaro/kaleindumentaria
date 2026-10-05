import type { Cotizaciones, ModoProrrateo } from '../nucleo/costos'
import type { Centavos, Moneda, MonedaExtranjera, MultiploRedondeo } from '../nucleo/dinero'
import type { UnidadMedida } from '../nucleo/unidades'
import type { Asignacion } from '../nucleo/ventas'

/** Campos comunes. borradoEn distinto de null = está en la papelera. */
export type Base = { id: string; creadoEn: string; actualizadoEn: string; borradoEn: string | null }

export type Tema = 'auto' | 'claro' | 'oscuro'
export const TIPOS_COTIZACION = ['Oficial', 'Blue', 'Otra'] as const

export type Config = Base & {
  nombreNegocio: string
  /** Recargo sobre el costo, en %, para el precio minorista. */
  margenDefecto: number
  margenMayorista: number
  multiplo: MultiploRedondeo
  tema: Tema
  /** Qué tipo de cotización se usa para calcular precios, por moneda. */
  tipoCotizacion: Record<MonedaExtranjera, string>
}

export type Cotizacion = Base & { fecha: string; moneda: MonedaExtranjera; tipo: string; valor: number }

export type Viaje = Base & {
  fecha: string
  destino: string
  modoProrrateo: ModoProrrateo
  /** Cotización realmente pagada en este viaje. */
  cotizaciones: Cotizaciones
  cerrado: boolean
  notas: string
}

export type ViajeGasto = Base & { viajeId: string; concepto: string; monto: Centavos; moneda: Moneda }
export type PlantillaGasto = Base & { concepto: string; monto: Centavos; moneda: Moneda }

export type Producto = Base & {
  nombre: string
  sku: string
  /** null = usa el margen por defecto de Configuración. */
  margenPct: number | null
  margenMayoristaPct: number | null
  stockMinimo: number
  fotoId: string | null
}

/** Lo comprado de un producto en un viaje. */
export type Lote = Base & {
  viajeId: string
  productoId: string
  cantidad: number
  unidadCompra: UnidadMedida
  costoOrigen: Centavos
  moneda: Moneda
  peso: number
}

/** Merma o ajuste de stock. unidades negativo = sale del stock. */
export type Movimiento = Base & {
  fecha: string
  productoId: string
  loteId: string
  unidades: number
  tipo: 'merma' | 'ajuste'
  motivo: string
}

export type Cliente = Base & {
  nombre: string
  documento: string
  telefono: string
  direccion: string
  limiteCredito: Centavos | null
  notas: string
}

export type Venta = Base & { fecha: string; clienteId: string | null; notas: string }

export type VentaItem = Base & {
  ventaId: string
  productoId: string
  cantidad: number
  unidadVenta: UnidadMedida
  precio: Centavos
  descuento: Centavos
  /** De qué lotes salieron las unidades (primero lo más viejo). */
  asignaciones: Asignacion[]
}

export type MedioPago = 'efectivo' | 'transferencia' | 'otro'

export type Pago = Base & {
  fecha: string
  clienteId: string | null
  monto: Centavos
  /** null = se aplica a la deuda más antigua. */
  ventaId: string | null
  medio: MedioPago
  notas: string
}

export type EstadoEnvio = 'preparado' | 'despachado' | 'entregado'

export type Envio = Base & {
  ventaId: string
  fecha: string
  transportista: string
  provincia: string
  localidad: string
  guia: string
  costo: Centavos
  /** false = el envío lo paga el negocio y se descuenta de la ganancia. */
  pagaCliente: boolean
  estado: EstadoEnvio
}

/** Comprobante de transferencia recibido de un cliente. */
export type Comprobante = Base & {
  fecha: string
  clienteId: string | null
  monto: Centavos
  banco: string
  referencia: string
  fotoId: string | null
  /** Cobro que se registró a partir de este comprobante. */
  pagoId: string | null
  verificado: boolean
  notas: string
}

export type Foto = { id: string; dataUrl: string }

export type Cambio = {
  id: string
  fecha: string
  tabla: string
  registroId: string
  accion: 'crear' | 'editar' | 'borrar'
  resumen: string
  /** En un borrado: marca compartida por todo lo que se borró junto. */
  marca: string | null
  restaurado: boolean
}

export const PROVINCIAS = [
  'Buenos Aires',
  'CABA',
  'Catamarca',
  'Chaco',
  'Chubut',
  'Córdoba',
  'Corrientes',
  'Entre Ríos',
  'Formosa',
  'Jujuy',
  'La Pampa',
  'La Rioja',
  'Mendoza',
  'Misiones',
  'Neuquén',
  'Río Negro',
  'Salta',
  'San Juan',
  'San Luis',
  'Santa Cruz',
  'Santa Fe',
  'Santiago del Estero',
  'Tierra del Fuego',
  'Tucumán',
] as const
