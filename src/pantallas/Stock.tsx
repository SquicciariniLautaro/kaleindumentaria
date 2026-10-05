import { useState } from 'react'
import { borrarProducto, registrarMovimiento } from '../datos/acciones'
import { crear, editar, restaurar } from '../datos/db'
import type { ProductoVista } from '../datos/derivar'
import { useApp } from '../datos/useApp'
import { formatearPesos } from '../nucleo/dinero'
import { fechaLocal, fechaParaMostrar } from '../nucleo/fecha'
import { coincide } from '../nucleo/texto'
import { describirUnidades } from '../nucleo/unidades'
import { ir, volver } from '../ruta'
import { useAvisos } from '../ui/avisos'
import { Boton, Campo, Dato, Dos, Etiqueta, Seccion, Segmentos, Selector, Tarjeta, Vacio } from '../ui/base'
import { Hoja } from '../ui/Dialogo'
import { exigirEntero, exigirTexto, leerPorcentaje, useCampos } from '../ui/formulario'
import { ElegirFoto, Foto, Pagina } from '../ui/Pagina'

export function Stock() {
  const { vista } = useApp()
  const [filtro, setFiltro] = useState('')
  const [soloBajo, setSoloBajo] = useState<'todos' | 'bajo'>('todos')
  const [nuevo, setNuevo] = useState(false)
  const lista = vista.productos.filter(
    (p) => coincide(`${p.producto.nombre} ${p.producto.sku}`, filtro) && (soloBajo === 'todos' || p.bajoMinimo),
  )

  return (
    <Pagina titulo="Stock y precios" fab={{ texto: '+ Producto', alTocar: () => setNuevo(true) }}>
      <Campo etiqueta="Filtrar por nombre o código" tipo="buscar" valor={filtro} alCambiar={setFiltro} />
      <Segmentos valor={soloBajo} alCambiar={setSoloBajo} opciones={[['todos', 'Todos'], ['bajo', 'Stock bajo']]} />
      {lista.length === 0 && (
        <Vacio
          titulo={vista.productos.length === 0 ? 'Sin productos' : 'Nada coincide'}
          texto={vista.productos.length === 0 ? 'Los productos aparecen al cargar la mercadería de un viaje, o creá uno acá.' : 'Probá con otro nombre o quitá el filtro.'}
        />
      )}
      {lista.map((p) => (
        <Tarjeta key={p.producto.id} alTocar={() => ir('producto', p.producto.id)}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold">{p.producto.nombre}</p>
              <p className="text-sm text-suave">{p.producto.sku || 'Sin código'}</p>
            </div>
            {p.bajoMinimo && <Etiqueta tono="mal">Stock bajo</Etiqueta>}
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className={p.stock > 0 ? '' : 'text-mal'}>{describirUnidades(p.stock)}</span>
            <span className="font-semibold tabular-nums">{p.precios ? `${formatearPesos(p.precios.minorista.unidad)} c/u` : 'Sin precio'}</span>
          </div>
        </Tarjeta>
      ))}
      {nuevo && <HojaProducto alCerrar={() => setNuevo(false)} />}
    </Pagina>
  )
}

function HojaProducto({ p, alCerrar }: { p?: ProductoVista; alCerrar: () => void }) {
  const { datos } = useApp()
  const { v, poner } = useCampos({
    nombre: p?.producto.nombre ?? '',
    sku: p?.producto.sku ?? '',
    margen: p?.producto.margenPct?.toString().replace('.', ',') ?? '',
    mayorista: p?.producto.margenMayoristaPct?.toString().replace('.', ',') ?? '',
    minimo: p ? String(p.producto.stockMinimo) : '0',
  })

  async function guardar() {
    const datosProducto = {
      nombre: exigirTexto(v.nombre, 'Nombre'),
      sku: v.sku.trim(),
      margenPct: leerPorcentaje(v.margen, 'Ganancia minorista'),
      margenMayoristaPct: leerPorcentaje(v.mayorista, 'Ganancia mayorista'),
      stockMinimo: exigirEntero(v.minimo || '0', 'Stock mínimo', 0),
    }
    if (p) await editar('productos', p.producto.id, datosProducto, `Producto ${datosProducto.nombre}`)
    else await crear('productos', { ...datosProducto, fotoId: null }, `Producto ${datosProducto.nombre}`)
    alCerrar()
  }

  return (
    <Hoja titulo={p ? 'Editar producto' : 'Nuevo producto'} alCerrar={alCerrar} alGuardar={guardar}>
      <Campo etiqueta="Nombre" valor={v.nombre} alCambiar={poner('nombre')} />
      <Campo etiqueta="Código / SKU (opcional)" valor={v.sku} alCambiar={poner('sku')} />
      <Dos>
        <Campo
          etiqueta="Ganancia minorista %"
          tipo="monto"
          valor={v.margen}
          alCambiar={poner('margen')}
          placeholder={`${datos.config.margenDefecto} (por defecto)`}
        />
        <Campo
          etiqueta="Ganancia mayorista %"
          tipo="monto"
          valor={v.mayorista}
          alCambiar={poner('mayorista')}
          placeholder={`${datos.config.margenMayorista} (por defecto)`}
        />
      </Dos>
      <p className="text-xs text-suave">El % se suma sobre el costo de reposición. Vacío = usa el de Configuración.</p>
      <Campo etiqueta="Avisar cuando queden (unidades)" tipo="entero" valor={v.minimo} alCambiar={poner('minimo')} ayuda="0 = sin aviso." />
    </Hoja>
  )
}

function HojaMovimiento({ p, alCerrar }: { p: ProductoVista; alCerrar: () => void }) {
  const { vista } = useApp()
  const { v, poner } = useCampos({ tipo: 'merma', sentido: 'sale', cantidad: '', motivo: '', fecha: fechaLocal() })

  async function guardar() {
    const cantidad = exigirEntero(v.cantidad, 'Cantidad')
    const sale = v.tipo === 'merma' || v.sentido === 'sale'
    await registrarMovimiento(vista, {
      productoId: p.producto.id,
      fecha: v.fecha,
      tipo: v.tipo === 'merma' ? 'merma' : 'ajuste',
      motivo: exigirTexto(v.motivo, 'Motivo'),
      unidades: sale ? -cantidad : cantidad,
    })
    alCerrar()
  }

  return (
    <Hoja titulo="Merma o ajuste de stock" alCerrar={alCerrar} alGuardar={guardar}>
      <Selector
        etiqueta="Qué pasó"
        valor={v.tipo}
        alCambiar={poner('tipo')}
        opciones={[['merma', 'Merma (rotura, falla, pérdida)'], ['ajuste', 'Ajuste por conteo']]}
      />
      {v.tipo === 'ajuste' && (
        <Selector etiqueta="El stock real es" valor={v.sentido} alCambiar={poner('sentido')} opciones={[['sale', 'Menor: hay que restar'], ['entra', 'Mayor: hay que sumar']]} />
      )}
      <Dos>
        <Campo etiqueta="Unidades" tipo="entero" valor={v.cantidad} alCambiar={poner('cantidad')} />
        <Campo etiqueta="Fecha" tipo="fecha" valor={v.fecha} alCambiar={poner('fecha')} />
      </Dos>
      <Campo etiqueta="Motivo" valor={v.motivo} alCambiar={poner('motivo')} placeholder="Vino fallado, se manchó…" />
      <p className="text-sm text-suave">Stock actual: {describirUnidades(p.stock)}</p>
    </Hoja>
  )
}

export function ProductoDetalle({ id }: { id: string | undefined }) {
  const { vista, datos } = useApp()
  const { confirmar, avisar, intentar } = useAvisos()
  const [editando, setEditando] = useState(false)
  const [moviendo, setMoviendo] = useState(false)
  const p = vista.productos.find((x) => x.producto.id === id)

  if (!p) {
    return (
      <Pagina titulo="Producto" atras>
        <Vacio titulo="Este producto ya no existe" texto="Puede estar en la papelera." />
      </Pagina>
    )
  }
  const { producto, precios } = p
  const movimientos = datos.movimientos.filter((m) => m.productoId === producto.id).sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
  const ultimo = p.lotes.at(-1)

  const eliminar = () =>
    intentar(async () => {
      if (!(await confirmar({ titulo: '¿Borrar el producto?', texto: 'Va a la papelera.', aceptar: 'Borrar', peligro: true }))) return
      const marca = await borrarProducto(vista, producto.id)
      volver()
      avisar('Producto borrado', () => restaurar(marca))
    })

  return (
    <Pagina titulo={producto.nombre} atras>
      {producto.fotoId && <Foto id={producto.fotoId} className="max-h-64 w-full" />}
      <Tarjeta>
        <Dato nombre="Código" valor={producto.sku || '—'} />
        <Dato nombre="Stock" valor={describirUnidades(p.stock)} tono={p.bajoMinimo || p.stock <= 0 ? 'mal' : 'normal'} detalle={producto.stockMinimo > 0 ? `Avisa con ${producto.stockMinimo} u. o menos` : undefined} />
        <Dato nombre="Stock a costo real" valor={formatearPesos(p.valorStock)} />
        {ultimo && <Dato nombre="Costo de reposición" valor={formatearPesos(ultimo.costoReposicion.redondear())} detalle="por unidad, con la cotización de hoy" />}
      </Tarjeta>

      <Seccion titulo="Precios de venta sugeridos">
        {precios ? (
          <Tarjeta>
            <Dato nombre={`Minorista (+${p.margen} %)`} valor={`${formatearPesos(precios.minorista.unidad)} c/u`} detalle={`${formatearPesos(precios.minorista.docena)} la docena`} />
            <Dato nombre={`Mayorista (+${p.margenMayorista} %)`} valor={`${formatearPesos(precios.mayorista.unidad)} c/u`} detalle={`${formatearPesos(precios.mayorista.docena)} la docena`} />
          </Tarjeta>
        ) : (
          <p className="text-sm text-suave">Todavía no se compró en ningún viaje: cargalo en la mercadería de un viaje para tener costo y precio.</p>
        )}
      </Seccion>

      <div className="grid grid-cols-2 gap-2">
        <Boton variante="secundario" onClick={() => setEditando(true)}>Editar</Boton>
        <Boton variante="secundario" disabled={p.lotes.length === 0} onClick={() => setMoviendo(true)}>Merma / ajuste</Boton>
        <ElegirFoto texto={producto.fotoId ? 'Cambiar foto' : 'Agregar foto'} alElegir={(fotoId) => void editar('productos', producto.id, { fotoId }, 'Foto del producto')} />
        <Boton variante="secundario" className="text-mal" onClick={() => void eliminar()}>Borrar</Boton>
      </div>

      <Seccion titulo="Compras por viaje">
        {p.lotes.length === 0 && <p className="text-sm text-suave">Sin compras.</p>}
        {[...p.lotes].reverse().map((l) => (
          <Tarjeta key={l.lote.id} alTocar={() => ir('viaje', l.viaje.id)} className="py-3">
            <div className="flex items-baseline justify-between gap-2">
              <span>
                {l.viaje.destino}
                <span className="block text-sm text-suave">{fechaParaMostrar(l.viaje.fecha)} · compró {describirUnidades(l.unidades)}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="font-semibold tabular-nums">{formatearPesos(l.costoHistorico.redondear())}</span>
                <span className="block text-sm text-suave">quedan {l.disponible}</span>
              </span>
            </div>
          </Tarjeta>
        ))}
      </Seccion>

      {movimientos.length > 0 && (
        <Seccion titulo="Mermas y ajustes">
          <Tarjeta>
            {movimientos.map((m) => (
              <Dato key={m.id} nombre={m.motivo} detalle={`${fechaParaMostrar(m.fecha)} · ${m.tipo}`} valor={`${m.unidades > 0 ? '+' : ''}${m.unidades} u.`} tono={m.unidades < 0 ? 'mal' : 'bien'} />
            ))}
          </Tarjeta>
        </Seccion>
      )}

      {editando && <HojaProducto p={p} alCerrar={() => setEditando(false)} />}
      {moviendo && <HojaMovimiento p={p} alCerrar={() => setMoviendo(false)} />}
    </Pagina>
  )
}
