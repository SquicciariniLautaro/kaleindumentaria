import { useState } from 'react'
import { borrarLote, borrarViaje } from '../datos/acciones'
import { borrar, crear, editar, restaurar } from '../datos/db'
import type { LoteVista, ViajeVista } from '../datos/derivar'
import type { ViajeGasto } from '../datos/tipos'
import { useApp } from '../datos/useApp'
import { cotizacionDesdeCambio, type ModoProrrateo } from '../nucleo/costos'
import {
  formatearCotizacion,
  formatearMonto,
  formatearPesos,
  MONEDAS,
  montoParaEditar,
  type Moneda,
} from '../nucleo/dinero'
import { fechaLocal, fechaParaMostrar } from '../nucleo/fecha'
import { describirUnidades, type UnidadMedida } from '../nucleo/unidades'
import { ir, volver } from '../ruta'
import { useAvisos } from '../ui/avisos'
import { Boton, Campo, Dato, Dos, Etiqueta, Seccion, Selector, Tarjeta, Vacio } from '../ui/base'
import { Hoja } from '../ui/Dialogo'
import { exigirCotizacion, exigirEntero, exigirMonto, exigirTexto, useCampos } from '../ui/formulario'
import { Pagina } from '../ui/Pagina'

const MODOS = [
  ['unidad', 'Por unidad'],
  ['valor', 'Por valor de compra'],
  ['peso', 'Por peso o volumen'],
] as const

const OPCIONES_MONEDA = MONEDAS.map((m) => [m, m] as const)

const porcentaje = (parte: number, total: number): string => (total > 0 ? `${Math.round((parte * 100) / total)} %` : '—')

export function Viajes() {
  const { vista } = useApp()
  const [nuevo, setNuevo] = useState(false)
  return (
    <Pagina titulo="Viajes" atras fab={{ texto: '+ Viaje', alTocar: () => setNuevo(true) }}>
      {vista.viajes.length === 0 && (
        <Vacio titulo="Sin viajes" texto="Cada viaje guarda la cotización que pagaste, sus gastos y la mercadería comprada." />
      )}
      {vista.viajes.map((v) => (
        <Tarjeta key={v.viaje.id} alTocar={() => ir('viaje', v.viaje.id)}>
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold">{v.viaje.destino}</p>
              <p className="text-sm text-suave">{fechaParaMostrar(v.viaje.fecha)}</p>
            </div>
            {v.viaje.cerrado && <Etiqueta tono="suave">Cerrado</Etiqueta>}
          </div>
          <Dato nombre="Invertido" valor={formatearPesos(v.totalCompra + v.totalGastos)} />
          <Dato nombre="Vendido" valor={formatearPesos(v.vendido)} detalle={`${porcentaje(v.unidadesVendidas, v.unidades)} de las unidades`} />
          <Dato
            nombre="Ganancia real"
            valor={formatearPesos(v.ganancia)}
            tono={v.ganancia < 0 ? 'mal' : 'bien'}
            detalle={`${porcentaje(v.ganancia, v.vendido - v.ganancia)} sobre el costo de lo vendido`}
          />
        </Tarjeta>
      ))}
      {nuevo && <HojaViaje alCerrar={() => setNuevo(false)} />}
    </Pagina>
  )
}

function HojaViaje({ viaje, alCerrar }: { viaje?: ViajeVista['viaje']; alCerrar: () => void }) {
  const { vista } = useApp()
  const cot = viaje?.cotizaciones ?? vista.cotizacionesHoy
  const { v, poner } = useCampos({
    fecha: viaje?.fecha ?? fechaLocal(),
    destino: viaje?.destino ?? 'Villazón',
    modo: (viaje?.modoProrrateo ?? 'unidad') as string,
    bob: cot.BOB ? formatearCotizacion(cot.BOB) : '',
    usd: cot.USD ? formatearCotizacion(cot.USD) : '',
    pesos: '',
    recibido: '',
  })

  const cambio = v.pesos.trim() !== '' || v.recibido.trim() !== ''

  async function guardar() {
    const datos = {
      fecha: v.fecha,
      destino: exigirTexto(v.destino, 'Destino'),
      modoProrrateo: v.modo as ModoProrrateo,
      cotizaciones: {
        // Si cargó lo que cambió, manda eso: es la cotización realmente pagada.
        BOB: cambio
          ? cotizacionDesdeCambio(exigirMonto(v.pesos, 'Pesos entregados'), exigirMonto(v.recibido, 'Bolivianos recibidos'))
          : exigirCotizacion(v.bob, 'Cotización BOB'),
        USD: exigirCotizacion(v.usd, 'Cotización USD'),
      },
    }
    if (viaje) await editar('viajes', viaje.id, datos, 'Datos del viaje')
    else {
      const creado = await crear('viajes', { ...datos, cerrado: false, notas: '' }, `Viaje a ${datos.destino}`)
      ir('viaje', creado.id)
    }
    alCerrar()
  }

  return (
    <Hoja titulo={viaje ? 'Editar viaje' : 'Nuevo viaje'} alCerrar={alCerrar} alGuardar={guardar}>
      <Dos>
        <Campo etiqueta="Fecha" tipo="fecha" valor={v.fecha} alCambiar={poner('fecha')} />
        <Campo etiqueta="Destino" valor={v.destino} alCambiar={poner('destino')} />
      </Dos>
      <Selector etiqueta="Reparto de los gastos" valor={v.modo} alCambiar={poner('modo')} opciones={MODOS} />
      <Dos>
        <Campo etiqueta="1 BOB = pesos" tipo="monto" valor={v.bob} alCambiar={poner('bob')} />
        <Campo etiqueta="1 USD = pesos" tipo="monto" valor={v.usd} alCambiar={poner('usd')} />
      </Dos>
      <p className="text-sm text-suave">
        Cargá la cotización que realmente pagaste. Si preferís, completá lo que cambiaste y se calcula sola:
      </p>
      <Dos>
        <Campo etiqueta="Pesos entregados" tipo="monto" valor={v.pesos} alCambiar={poner('pesos')} />
        <Campo etiqueta="Bolivianos recibidos" tipo="monto" valor={v.recibido} alCambiar={poner('recibido')} />
      </Dos>
    </Hoja>
  )
}

export function ViajeDetalle({ id }: { id: string | undefined }) {
  const { vista } = useApp()
  const { confirmar, avisar, intentar } = useAvisos()
  const [editando, setEditando] = useState(false)
  const [gasto, setGasto] = useState<ViajeGasto | 'nuevo' | null>(null)
  const [lote, setLote] = useState<LoteVista | 'nuevo' | null>(null)
  const v = vista.viajes.find((x) => x.viaje.id === id)

  if (!v) {
    return (
      <Pagina titulo="Viaje" atras>
        <Vacio titulo="Este viaje ya no existe" texto="Puede estar en la papelera." />
      </Pagina>
    )
  }
  const { viaje } = v
  const abierto = !viaje.cerrado

  const alternarCierre = () =>
    intentar(async () => {
      if (
        abierto &&
        !(await confirmar({
          titulo: '¿Cerrar el viaje?',
          texto: 'No se van a poder cambiar gastos, compras ni cotización, así la ganancia de lo vendido no cambia. Se puede reabrir.',
          aceptar: 'Cerrar viaje',
        }))
      )
        return
      await editar('viajes', viaje.id, { cerrado: abierto }, abierto ? 'Viaje cerrado' : 'Viaje reabierto')
    })

  const eliminar = () =>
    intentar(async () => {
      if (!(await confirmar({ titulo: '¿Borrar el viaje?', texto: 'Va a la papelera con sus gastos y compras.', aceptar: 'Borrar', peligro: true }))) return
      const marca = await borrarViaje(vista, viaje.id)
      volver()
      avisar('Viaje borrado', () => restaurar(marca))
    })

  const eliminarGasto = (g: ViajeGasto) =>
    intentar(async () => {
      const marca = await borrar([{ tabla: 'gastos', ids: [g.id] }], `Gasto ${g.concepto}`)
      avisar('Gasto borrado', () => restaurar(marca))
    })

  const eliminarLote = (l: LoteVista) =>
    intentar(async () => {
      const marca = await borrarLote(vista, l.lote.id)
      avisar('Compra borrada', () => restaurar(marca))
    })

  return (
    <Pagina titulo={viaje.destino} atras>
      {v.error && <p className="rounded-xl bg-mal/10 px-3 py-2 text-sm text-mal">{v.error}. Revisá las cotizaciones del viaje.</p>}
      <Tarjeta>
        <Dato nombre="Fecha" valor={fechaParaMostrar(viaje.fecha)} />
        <Dato
          nombre="Cotización pagada"
          valor={`BOB ${formatearCotizacion(viaje.cotizaciones.BOB)} · USD ${formatearCotizacion(viaje.cotizaciones.USD)}`}
        />
        <Dato nombre="Reparto de gastos" valor={MODOS.find(([m]) => m === viaje.modoProrrateo)?.[1]} />
        <Dato nombre="Mercadería" valor={formatearPesos(v.totalCompra)} detalle={describirUnidades(v.unidades)} />
        <Dato nombre="Gastos" valor={formatearPesos(v.totalGastos)} />
        <Dato nombre="Vendido" valor={formatearPesos(v.vendido)} />
        <Dato nombre="Ganancia real" valor={formatearPesos(v.ganancia)} tono={v.ganancia < 0 ? 'mal' : 'bien'} />
        <Dato nombre="Stock que queda" valor={formatearPesos(v.valorStock)} detalle="a costo real" />
      </Tarjeta>
      <div className="grid grid-cols-3 gap-2">
        <Boton variante="secundario" chico disabled={!abierto} onClick={() => setEditando(true)}>
          Editar
        </Boton>
        <Boton variante="secundario" chico onClick={() => void alternarCierre()}>
          {abierto ? 'Cerrar' : 'Reabrir'}
        </Boton>
        <Boton variante="secundario" chico className="text-mal" onClick={() => void eliminar()}>
          Borrar
        </Boton>
      </div>
      {!abierto && <p className="text-sm text-suave">Viaje cerrado: reabrilo para modificar gastos o compras.</p>}

      <Seccion
        titulo="Gastos del viaje"
        accion={abierto && <Boton variante="texto" chico onClick={() => setGasto('nuevo')}>+ Agregar</Boton>}
      >
        {v.gastos.length === 0 && <p className="text-sm text-suave">Pasajes, peajes, viáticos, fletes…</p>}
        {v.gastos.map((g) => (
          <Tarjeta key={g.id} className="flex items-center justify-between gap-2 py-3">
            <span>
              {g.concepto}
              <span className="block text-sm text-suave">
                {formatearMonto(g.monto)} {g.moneda}
              </span>
            </span>
            {abierto && (
              <span className="flex shrink-0">
                <Boton variante="texto" chico onClick={() => setGasto(g)}>Editar</Boton>
                <Boton variante="texto" chico className="text-mal" onClick={() => void eliminarGasto(g)}>Borrar</Boton>
              </span>
            )}
          </Tarjeta>
        ))}
      </Seccion>

      <Seccion
        titulo="Mercadería comprada"
        accion={abierto && <Boton variante="texto" chico onClick={() => setLote('nuevo')}>+ Agregar</Boton>}
      >
        {v.lotes.length === 0 && <p className="text-sm text-suave">Cargá cada producto con su cantidad y su costo de origen.</p>}
        {v.lotes.map((l) => (
          <Tarjeta key={l.lote.id}>
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="font-semibold">{l.producto?.nombre ?? 'Producto borrado'}</p>
              <span className="shrink-0 text-sm text-suave">{describirUnidades(l.unidades)}</span>
            </div>
            <Dato
              nombre="Costo de origen"
              valor={formatearPesos(l.origenUnitario.redondear())}
              detalle={`${formatearMonto(l.lote.costoOrigen)} ${l.lote.moneda} por ${l.lote.unidadCompra}`}
            />
            <Dato nombre="Gasto de viaje" valor={formatearPesos(l.gastoUnitario.redondear())} detalle="por unidad" />
            <Dato
              nombre="Costo real"
              valor={formatearPesos(l.costoHistorico.redondear())}
              detalle={`${formatearPesos(l.costoHistorico.por(12).redondear())} la docena`}
            />
            <Dato nombre="Quedan" valor={describirUnidades(l.disponible)} />
            {abierto && (
              <div className="mt-2 flex justify-end">
                <Boton variante="texto" chico onClick={() => setLote(l)}>Editar</Boton>
                <Boton variante="texto" chico className="text-mal" onClick={() => void eliminarLote(l)}>Borrar</Boton>
              </div>
            )}
          </Tarjeta>
        ))}
      </Seccion>

      {editando && <HojaViaje viaje={viaje} alCerrar={() => setEditando(false)} />}
      {gasto && <HojaGasto viajeId={viaje.id} gasto={gasto === 'nuevo' ? undefined : gasto} alCerrar={() => setGasto(null)} />}
      {lote && <HojaLote viaje={v} lote={lote === 'nuevo' ? undefined : lote} alCerrar={() => setLote(null)} />}
    </Pagina>
  )
}

function HojaGasto({ viajeId, gasto, alCerrar }: { viajeId: string; gasto?: ViajeGasto; alCerrar: () => void }) {
  const { datos } = useApp()
  const { v, poner } = useCampos({
    concepto: gasto?.concepto ?? '',
    monto: gasto ? montoParaEditar(gasto.monto) : '',
    moneda: (gasto?.moneda ?? 'ARS') as string,
    habitual: '',
  })

  async function guardar() {
    const datosGasto = {
      concepto: exigirTexto(v.concepto, 'Concepto'),
      monto: exigirMonto(v.monto, 'Monto'),
      moneda: v.moneda as Moneda,
    }
    if (gasto) await editar('gastos', gasto.id, datosGasto, `Gasto ${datosGasto.concepto}`)
    else await crear('gastos', { ...datosGasto, viajeId }, `Gasto ${datosGasto.concepto}`)
    if (v.habitual) await crear('plantillas', datosGasto, `Gasto habitual ${datosGasto.concepto}`)
    alCerrar()
  }

  return (
    <Hoja titulo={gasto ? 'Editar gasto' : 'Nuevo gasto'} alCerrar={alCerrar} alGuardar={guardar}>
      {!gasto && datos.plantillas.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-sm text-suave">Gastos habituales (tocá para usar)</span>
          {datos.plantillas.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              <Boton
                variante="secundario"
                chico
                className="flex-1 text-left"
                onClick={async () => {
                  await crear('gastos', { viajeId, concepto: p.concepto, monto: p.monto, moneda: p.moneda }, `Gasto ${p.concepto}`)
                  alCerrar()
                }}
              >
                {p.concepto} · {formatearMonto(p.monto)} {p.moneda}
              </Boton>
              <Boton
                variante="texto"
                chico
                aria-label={`Quitar ${p.concepto} de los habituales`}
                onClick={() => void borrar([{ tabla: 'plantillas', ids: [p.id] }], `Gasto habitual ${p.concepto}`)}
              >
                Quitar
              </Boton>
            </div>
          ))}
        </div>
      )}
      <Campo etiqueta="Concepto" valor={v.concepto} alCambiar={poner('concepto')} placeholder="Pasaje, peaje, viático…" />
      <Dos>
        <Campo etiqueta="Monto total" tipo="monto" valor={v.monto} alCambiar={poner('monto')} />
        <Selector etiqueta="Moneda" valor={v.moneda} alCambiar={poner('moneda')} opciones={OPCIONES_MONEDA} />
      </Dos>
      {!gasto && (
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" className="h-5 w-5" checked={v.habitual === 'si'} onChange={(e) => poner('habitual')(e.target.checked ? 'si' : '')} />
          Guardar como gasto habitual
        </label>
      )}
    </Hoja>
  )
}

function HojaLote({ viaje, lote, alCerrar }: { viaje: ViajeVista; lote?: LoteVista; alCerrar: () => void }) {
  const { vista } = useApp()
  const { v, poner } = useCampos({
    productoId: lote?.lote.productoId ?? vista.productos[0]?.producto.id ?? 'nuevo',
    nombre: '',
    unidad: (lote?.lote.unidadCompra ?? 'docena') as string,
    cantidad: lote ? String(lote.lote.cantidad) : '',
    costo: lote ? montoParaEditar(lote.lote.costoOrigen) : '',
    moneda: (lote?.lote.moneda ?? 'BOB') as string,
    peso: lote?.lote.peso ? String(lote.lote.peso) : '',
  })
  const porDocena = v.unidad === 'docena'

  async function guardar() {
    const unidadCompra = v.unidad as UnidadMedida
    const cantidad = exigirEntero(v.cantidad, 'Cantidad')
    if (lote && cantidad * (porDocena ? 12 : 1) < lote.vendidas - lote.ajustes) {
      throw new Error(`Ya salieron ${describirUnidades(lote.vendidas - lote.ajustes)} de esta compra: la cantidad no puede ser menor`)
    }
    const datosLote = {
      cantidad,
      unidadCompra,
      costoOrigen: exigirMonto(v.costo, 'Costo'),
      moneda: v.moneda as Moneda,
      peso: viaje.viaje.modoProrrateo === 'peso' ? exigirEntero(v.peso || '0', 'Peso o volumen', 0) : (lote?.lote.peso ?? 0),
    }
    if (lote) {
      await editar('lotes', lote.lote.id, datosLote, 'Compra editada')
    } else {
      let productoId = v.productoId
      if (productoId === 'nuevo') {
        const nombre = exigirTexto(v.nombre, 'Nombre del producto')
        const producto = await crear(
          'productos',
          { nombre, sku: '', margenPct: null, margenMayoristaPct: null, stockMinimo: 0, fotoId: null },
          `Producto ${nombre}`,
        )
        productoId = producto.id
      }
      await crear('lotes', { ...datosLote, viajeId: viaje.viaje.id, productoId }, 'Compra cargada')
    }
    alCerrar()
  }

  return (
    <Hoja titulo={lote ? 'Editar compra' : 'Mercadería comprada'} alCerrar={alCerrar} alGuardar={guardar}>
      {lote ? (
        <p className="font-semibold">{lote.producto?.nombre}</p>
      ) : (
        <Selector
          etiqueta="Producto"
          valor={v.productoId}
          alCambiar={poner('productoId')}
          opciones={[...vista.productos.map((p) => [p.producto.id, p.producto.nombre] as const), ['nuevo', '+ Producto nuevo']]}
        />
      )}
      {!lote && v.productoId === 'nuevo' && <Campo etiqueta="Nombre del producto" valor={v.nombre} alCambiar={poner('nombre')} />}
      <Dos>
        <Selector etiqueta="Comprado por" valor={v.unidad} alCambiar={poner('unidad')} opciones={[['docena', 'Docena'], ['unidad', 'Unidad']]} />
        <Selector etiqueta="Moneda" valor={v.moneda} alCambiar={poner('moneda')} opciones={OPCIONES_MONEDA} />
      </Dos>
      <Dos>
        <Campo etiqueta={porDocena ? 'Cantidad de docenas' : 'Cantidad de unidades'} tipo="entero" valor={v.cantidad} alCambiar={poner('cantidad')} />
        <Campo etiqueta={porDocena ? 'Costo por docena' : 'Costo por unidad'} tipo="monto" valor={v.costo} alCambiar={poner('costo')} />
      </Dos>
      {viaje.viaje.modoProrrateo === 'peso' && (
        <Campo
          etiqueta="Peso o volumen total de esta compra"
          tipo="entero"
          valor={v.peso}
          alCambiar={poner('peso')}
          ayuda="En la unidad que quieras (kilos, bultos…), pero la misma para todo el viaje."
        />
      )}
    </Hoja>
  )
}
