import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { borrarVenta, registrarVenta } from '../datos/acciones'
import { borrar, crear, db, editar, restaurar } from '../datos/db'
import type { Lista, LineaNueva, VentaVista } from '../datos/derivar'
import { PROVINCIAS, type Envio, type EstadoEnvio, type MedioPago } from '../datos/tipos'
import { useApp } from '../datos/useApp'
import type { EstadoVenta } from '../nucleo/cuenta'
import { formatearPesos, montoParaEditar } from '../nucleo/dinero'
import { fechaLocal, fechaParaMostrar } from '../nucleo/fecha'
import { coincide } from '../nucleo/texto'
import { describirCantidad, describirUnidades, UNIDADES_POR, type UnidadMedida } from '../nucleo/unidades'
import { totalLinea } from '../nucleo/ventas'
import { ir, volver } from '../ruta'
import { useAvisos } from '../ui/avisos'
import { Boton, Campo, Dato, Dos, Etiqueta, Seccion, Segmentos, Selector, Tarjeta, Vacio } from '../ui/base'
import { compartir } from '../ui/compartir'
import { Hoja } from '../ui/Dialogo'
import { exigirEntero, exigirMonto, exigirTexto, useCampos } from '../ui/formulario'
import { Pagina } from '../ui/Pagina'

const ESTADOS: Record<EstadoVenta, [texto: string, tono: 'bien' | 'mal' | 'normal']> = {
  pagada: ['Pagada', 'bien'],
  parcial: ['Pago parcial', 'normal'],
  debe: ['Debe', 'mal'],
}

export function EtiquetaEstado({ v }: { v: VentaVista }) {
  const [texto, tono] = ESTADOS[v.estado]
  return <Etiqueta tono={tono}>{v.estado === 'pagada' ? texto : `${texto} · ${formatearPesos(v.saldo)}`}</Etiqueta>
}

const resumenItems = (v: VentaVista): string =>
  v.items.map((i) => `${describirCantidad(i.item.cantidad, i.item.unidadVenta)} ${i.producto?.nombre ?? 'producto borrado'}`).join(', ')

export function TarjetaVenta({ v, conCliente = true }: { v: VentaVista; conCliente?: boolean }) {
  return (
    <Tarjeta alTocar={() => ir('venta', v.venta.id)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{conCliente ? (v.cliente?.nombre ?? 'Sin cliente') : fechaParaMostrar(v.venta.fecha)}</p>
          {conCliente && <p className="text-sm text-suave">{fechaParaMostrar(v.venta.fecha)}</p>}
        </div>
        <span className="shrink-0 font-semibold tabular-nums">{formatearPesos(v.total)}</span>
      </div>
      <p className="mt-1 truncate text-sm text-suave">{resumenItems(v)}</p>
      <div className="mt-2">
        <EtiquetaEstado v={v} />
      </div>
    </Tarjeta>
  )
}

export function Ventas() {
  const { vista } = useApp()
  const [filtro, setFiltro] = useState('')
  const lista = vista.ventas.filter((v) =>
    coincide(`${v.cliente?.nombre ?? 'sin cliente'} ${resumenItems(v)} ${v.venta.fecha} ${fechaParaMostrar(v.venta.fecha)}`, filtro),
  )
  return (
    <Pagina titulo="Ventas" fab={{ texto: '+ Venta', alTocar: () => ir('venta-nueva') }}>
      <Campo etiqueta="Filtrar por cliente, producto o fecha" tipo="buscar" valor={filtro} alCambiar={setFiltro} />
      {lista.length === 0 && (
        <Vacio
          titulo={vista.ventas.length === 0 ? 'Sin ventas' : 'Nada coincide'}
          texto={vista.ventas.length === 0 ? 'Registrá la primera con el botón de abajo. Puede ser al contado o fiada.' : 'Probá con otra palabra o con la fecha (por ejemplo 05/10).'}
        />
      )}
      {lista.map((v) => (
        <TarjetaVenta key={v.venta.id} v={v} />
      ))}
    </Pagina>
  )
}

type LineaEnPantalla = LineaNueva & { nombre: string }

function HojaLinea({ lineas, alAgregar, alCerrar }: { lineas: LineaEnPantalla[]; alAgregar: (l: LineaEnPantalla) => void; alCerrar: () => void }) {
  const { vista } = useApp()
  // Stock que queda descontando lo ya agregado a esta venta.
  const usado = (productoId: string) =>
    lineas.filter((l) => l.productoId === productoId).reduce((t, l) => t + l.cantidad * UNIDADES_POR[l.unidadVenta], 0)
  const conStock = vista.productos.filter((p) => p.stock - usado(p.producto.id) > 0)
  const sugerido = (productoId: string, unidad: string, lista: string): string => {
    const precio = vista.productos.find((p) => p.producto.id === productoId)?.precios?.[lista as Lista][unidad as UnidadMedida]
    return precio ? montoParaEditar(precio) : ''
  }
  const primero = conStock[0]?.producto.id ?? ''
  const { v, setValores, poner } = useCampos({
    productoId: primero,
    unidad: 'unidad',
    lista: 'minorista',
    cantidad: '1',
    precio: sugerido(primero, 'unidad', 'minorista'),
    descuento: '',
  })
  const elegido = vista.productos.find((p) => p.producto.id === v.productoId)

  const cambiar = (campo: 'productoId' | 'unidad' | 'lista') => (valor: string) =>
    setValores((previos) => {
      const nuevos = { ...previos, [campo]: valor }
      return { ...nuevos, precio: sugerido(nuevos.productoId, nuevos.unidad, nuevos.lista) }
    })

  function agregar() {
    if (!elegido) throw new Error('No hay productos con stock')
    const unidadVenta = v.unidad as UnidadMedida
    const cantidad = exigirEntero(v.cantidad, 'Cantidad')
    const queda = elegido.stock - usado(elegido.producto.id)
    if (cantidad * UNIDADES_POR[unidadVenta] > queda) throw new Error(`Stock insuficiente: quedan ${describirUnidades(queda)}`)
    const precio = exigirMonto(v.precio, 'Precio')
    const descuento = exigirMonto(v.descuento, 'Descuento', { permiteCero: true })
    if (descuento > cantidad * precio) throw new Error('El descuento no puede superar el total de la línea')
    alAgregar({ productoId: elegido.producto.id, nombre: elegido.producto.nombre, cantidad, unidadVenta, precio, descuento })
    alCerrar()
  }

  return (
    <Hoja titulo="Agregar producto" alCerrar={alCerrar} alGuardar={agregar} guardar="Agregar">
      {conStock.length === 0 ? (
        <p className="text-suave">No hay productos con stock. Cargá mercadería en un viaje.</p>
      ) : (
        <>
          <Selector
            etiqueta="Producto"
            valor={v.productoId}
            alCambiar={cambiar('productoId')}
            opciones={conStock.map((p) => [p.producto.id, `${p.producto.nombre} · ${describirUnidades(p.stock - usado(p.producto.id))}`] as const)}
          />
          <Dos>
            <Selector etiqueta="Vender por" valor={v.unidad} alCambiar={cambiar('unidad')} opciones={[['unidad', 'Unidad'], ['docena', 'Docena']]} />
            <Selector etiqueta="Lista de precios" valor={v.lista} alCambiar={cambiar('lista')} opciones={[['minorista', 'Minorista'], ['mayorista', 'Mayorista']]} />
          </Dos>
          <Dos>
            <Campo etiqueta={v.unidad === 'docena' ? 'Docenas' : 'Unidades'} tipo="entero" valor={v.cantidad} alCambiar={poner('cantidad')} />
            <Campo etiqueta={`Precio por ${v.unidad}`} tipo="monto" valor={v.precio} alCambiar={poner('precio')} />
          </Dos>
          <Campo etiqueta="Descuento en pesos (opcional)" tipo="monto" valor={v.descuento} alCambiar={poner('descuento')} />
        </>
      )}
    </Hoja>
  )
}

export function VentaNueva({ clienteInicial }: { clienteInicial: string | undefined }) {
  const { vista } = useApp()
  const { confirmar, avisar } = useAvisos()
  const [lineas, setLineas] = useState<LineaEnPantalla[]>([])
  const [agregando, setAgregando] = useState(false)
  const [pago, setPago] = useState<'todo' | 'nada' | 'parte'>('todo')
  const { v, poner } = useCampos({ clienteId: clienteInicial ?? '', fecha: fechaLocal(), monto: '', medio: 'efectivo', notas: '' })
  const total = lineas.reduce((t, l) => t + totalLinea(l), 0)
  const cliente = vista.clientes.find((c) => c.cliente.id === v.clienteId)
  const sinCliente = !cliente

  async function guardar() {
    try {
      const pagaAhora = sinCliente || pago === 'todo' ? total : pago === 'nada' ? 0 : exigirMonto(v.monto, 'Monto que paga ahora')
      const fiado = total - Math.min(pagaAhora, total)
      if (cliente && cliente.cliente.limiteCredito !== null && fiado > 0 && cliente.deuda + fiado > cliente.cliente.limiteCredito) {
        const seguir = await confirmar({
          titulo: 'Supera el límite de crédito',
          texto: `${cliente.cliente.nombre} quedaría debiendo ${formatearPesos(cliente.deuda + fiado)} y su límite es ${formatearPesos(cliente.cliente.limiteCredito)}.`,
          aceptar: 'Vender igual',
        })
        if (!seguir) return
      }
      const id = await registrarVenta(vista, {
        fecha: v.fecha,
        clienteId: cliente?.cliente.id ?? null,
        notas: v.notas.trim(),
        lineas: lineas.map(({ nombre: _nombre, ...linea }) => linea),
        pagaAhora,
        medio: v.medio as MedioPago,
      })
      ir('venta', id, { reemplazar: true })
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo guardar la venta')
    }
  }

  return (
    <Pagina titulo="Nueva venta" atras>
      <Selector
        etiqueta="Cliente"
        valor={v.clienteId}
        alCambiar={poner('clienteId')}
        opciones={[['', 'Sin cliente (venta al contado)'], ...vista.clientes.map((c) => [c.cliente.id, c.cliente.nombre] as const)]}
      />
      {cliente && cliente.deuda > 0 && <p className="text-sm text-mal">Ya debe {formatearPesos(cliente.deuda)}.</p>}
      <Campo etiqueta="Fecha" tipo="fecha" valor={v.fecha} alCambiar={poner('fecha')} />

      <Seccion titulo="Productos">
        {lineas.map((l, n) => (
          <Tarjeta key={n} className="flex items-center justify-between gap-2 py-3">
            <span className="min-w-0">
              {describirCantidad(l.cantidad, l.unidadVenta)} {l.nombre}
              <span className="block text-sm text-suave">
                a {formatearPesos(l.precio)}
                {l.descuento > 0 && ` · descuento ${formatearPesos(l.descuento)}`}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <span className="font-semibold tabular-nums">{formatearPesos(totalLinea(l))}</span>
              <Boton variante="texto" chico className="text-mal" onClick={() => setLineas(lineas.filter((_, i) => i !== n))}>
                Quitar
              </Boton>
            </span>
          </Tarjeta>
        ))}
        <Boton variante="secundario" onClick={() => setAgregando(true)}>
          + Agregar producto
        </Boton>
      </Seccion>

      {lineas.length > 0 && (
        <>
          <Tarjeta className="flex items-baseline justify-between">
            <span className="text-suave">Total</span>
            <span className="text-2xl font-bold tabular-nums">{formatearPesos(total)}</span>
          </Tarjeta>
          {sinCliente ? (
            <p className="text-sm text-suave">Sin cliente la venta se cobra entera ahora. Para fiar, elegí un cliente.</p>
          ) : (
            <Segmentos valor={pago} alCambiar={setPago} opciones={[['todo', 'Paga todo'], ['parte', 'Paga una parte'], ['nada', 'Fiado']]} />
          )}
          {!sinCliente && pago === 'parte' && <Campo etiqueta="Paga ahora (pesos)" tipo="monto" valor={v.monto} alCambiar={poner('monto')} />}
          {(sinCliente || pago !== 'nada') && (
            <Selector etiqueta="Cómo paga" valor={v.medio} alCambiar={poner('medio')} opciones={[['efectivo', 'Efectivo'], ['transferencia', 'Transferencia'], ['otro', 'Otro']]} />
          )}
          <Campo etiqueta="Notas (opcional)" valor={v.notas} alCambiar={poner('notas')} />
          <Boton onClick={() => void guardar()}>Registrar venta</Boton>
        </>
      )}
      {agregando && <HojaLinea lineas={lineas} alAgregar={(l) => setLineas([...lineas, l])} alCerrar={() => setAgregando(false)} />}
    </Pagina>
  )
}

const ESTADOS_ENVIO: readonly (readonly [EstadoEnvio, string])[] = [
  ['preparado', 'Preparado'],
  ['despachado', 'Despachado'],
  ['entregado', 'Entregado'],
]

export function HojaEnvio({ ventaId, envio, alCerrar }: { ventaId: string; envio?: Envio; alCerrar: () => void }) {
  const { v, poner } = useCampos({
    fecha: envio?.fecha ?? fechaLocal(),
    transportista: envio?.transportista ?? '',
    provincia: envio?.provincia ?? 'Jujuy',
    localidad: envio?.localidad ?? '',
    guia: envio?.guia ?? '',
    costo: envio ? montoParaEditar(envio.costo) : '',
    paga: envio?.pagaCliente === false ? 'negocio' : 'cliente',
    estado: (envio?.estado ?? 'preparado') as string,
  })

  async function guardar() {
    const datosEnvio = {
      fecha: v.fecha,
      transportista: exigirTexto(v.transportista, 'Transportista'),
      provincia: v.provincia,
      localidad: v.localidad.trim(),
      guia: v.guia.trim(),
      costo: exigirMonto(v.costo, 'Costo del envío', { permiteCero: true }),
      pagaCliente: v.paga === 'cliente',
      estado: v.estado as EstadoEnvio,
    }
    if (envio) await editar('envios', envio.id, datosEnvio, 'Envío editado')
    else await crear('envios', { ...datosEnvio, ventaId }, `Envío por ${datosEnvio.transportista}`)
    alCerrar()
  }

  return (
    <Hoja titulo={envio ? 'Editar envío' : 'Nuevo envío'} alCerrar={alCerrar} alGuardar={guardar}>
      <Campo etiqueta="Transportista" valor={v.transportista} alCambiar={poner('transportista')} placeholder="Vía Cargo, Andreani, Correo…" />
      <Dos>
        <Selector etiqueta="Provincia" valor={v.provincia} alCambiar={poner('provincia')} opciones={PROVINCIAS.map((p) => [p, p] as const)} />
        <Campo etiqueta="Localidad" valor={v.localidad} alCambiar={poner('localidad')} />
      </Dos>
      <Campo etiqueta="Guía de seguimiento" valor={v.guia} alCambiar={poner('guia')} />
      <Dos>
        <Campo etiqueta="Costo del envío" tipo="monto" valor={v.costo} alCambiar={poner('costo')} />
        <Selector etiqueta="Lo paga" valor={v.paga} alCambiar={poner('paga')} opciones={[['cliente', 'El cliente'], ['negocio', 'El negocio']]} />
      </Dos>
      <Dos>
        <Selector etiqueta="Estado" valor={v.estado} alCambiar={poner('estado')} opciones={ESTADOS_ENVIO} />
        <Campo etiqueta="Fecha" tipo="fecha" valor={v.fecha} alCambiar={poner('fecha')} />
      </Dos>
      <p className="text-xs text-suave">Si lo paga el negocio, el costo se descuenta de la ganancia de la venta.</p>
    </Hoja>
  )
}

function HojaEditarVenta({ venta, alCerrar }: { venta: VentaVista; alCerrar: () => void }) {
  const { vista } = useApp()
  const { v, poner } = useCampos({ fecha: venta.venta.fecha, clienteId: venta.venta.clienteId ?? '', notas: venta.venta.notas })

  async function guardar() {
    if (v.clienteId === '' && venta.saldo > 0) throw new Error('Una venta con saldo pendiente necesita un cliente')
    await editar('ventas', venta.venta.id, { fecha: v.fecha, clienteId: v.clienteId || null, notas: v.notas.trim() }, 'Fecha, cliente o notas')
    alCerrar()
  }

  return (
    <Hoja titulo="Editar venta" alCerrar={alCerrar} alGuardar={guardar}>
      <Campo etiqueta="Fecha" tipo="fecha" valor={v.fecha} alCambiar={poner('fecha')} />
      <Selector
        etiqueta="Cliente"
        valor={v.clienteId}
        alCambiar={poner('clienteId')}
        opciones={[['', 'Sin cliente'], ...vista.clientes.map((c) => [c.cliente.id, c.cliente.nombre] as const)]}
      />
      <Campo etiqueta="Notas" valor={v.notas} alCambiar={poner('notas')} />
      <p className="text-xs text-suave">Los productos y precios quedan fijos. Para cambiarlos, borrá la venta y cargala de nuevo.</p>
    </Hoja>
  )
}

export function VentaDetalle({ id }: { id: string | undefined }) {
  const { vista, datos } = useApp()
  const { confirmar, avisar, intentar } = useAvisos()
  const [editando, setEditando] = useState(false)
  const [envioAbierto, setEnvioAbierto] = useState(false)
  const cambios = useLiveQuery(() => db.cambios.where('registroId').equals(id ?? '').sortBy('fecha'), [id])
  const v = vista.ventas.find((x) => x.venta.id === id)

  if (!v) {
    return (
      <Pagina titulo="Venta" atras>
        <Vacio titulo="Esta venta ya no existe" texto="Puede estar en la papelera." />
      </Pagina>
    )
  }
  const { venta, envio } = v
  const pagos = datos.pagos.filter((p) => p.ventaId === venta.id)

  const texto = [
    `*${datos.config.nombreNegocio}*`,
    `Comprobante de venta · ${fechaParaMostrar(venta.fecha)}`,
    v.cliente ? `Cliente: ${v.cliente.nombre}` : '',
    '',
    ...v.items.map((i) => `• ${describirCantidad(i.item.cantidad, i.item.unidadVenta)} ${i.producto?.nombre ?? 'producto'}: ${formatearPesos(i.total)}`),
    '',
    `Total: ${formatearPesos(v.total)}`,
    `Pagado: ${formatearPesos(v.pagado)}`,
    v.saldo > 0 ? `Saldo pendiente: ${formatearPesos(v.saldo)}` : 'Venta pagada. ¡Gracias!',
    envio ? `Envío: ${envio.transportista}${envio.guia ? ` · guía ${envio.guia}` : ''}` : '',
    '',
    'Comprobante no fiscal.',
  ]
    .filter((linea, i, todas) => linea !== '' || todas[i - 1] !== '')
    .join('\n')

  const eliminar = () =>
    intentar(async () => {
      const ok = await confirmar({
        titulo: '¿Borrar la venta?',
        texto: 'Va a la papelera junto con su envío y los cobros hechos a esta venta. El stock vuelve.',
        aceptar: 'Borrar',
        peligro: true,
      })
      if (!ok) return
      const marca = await borrarVenta(vista, venta.id, pagos.map((p) => p.id))
      volver()
      avisar('Venta borrada', () => restaurar(marca))
    })

  return (
    <Pagina titulo={v.cliente?.nombre ?? 'Venta sin cliente'} atras>
      <Tarjeta>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-suave">{fechaParaMostrar(venta.fecha)}</span>
          <EtiquetaEstado v={v} />
        </div>
        {v.items.map((i) => (
          <Dato
            key={i.item.id}
            nombre={`${describirCantidad(i.item.cantidad, i.item.unidadVenta)} ${i.producto?.nombre ?? 'Producto borrado'}`}
            detalle={`a ${formatearPesos(i.item.precio)}${i.item.descuento > 0 ? ` · descuento ${formatearPesos(i.item.descuento)}` : ''}`}
            valor={formatearPesos(i.total)}
          />
        ))}
        <Dato nombre="Total" valor={formatearPesos(v.total)} />
        <Dato nombre="Pagado" valor={formatearPesos(v.pagado)} />
        {v.saldo > 0 && <Dato nombre="Saldo" valor={formatearPesos(v.saldo)} tono="mal" />}
        <Dato
          nombre="Ganancia real"
          valor={formatearPesos(v.ganancia)}
          tono={v.ganancia < 0 ? 'mal' : 'bien'}
          detalle={envio && !envio.pagaCliente ? `ya descontado el envío (${formatearPesos(envio.costo)})` : undefined}
        />
        {venta.notas && <p className="mt-2 border-t border-borde pt-2 text-sm text-suave">{venta.notas}</p>}
      </Tarjeta>

      <Boton onClick={() => void compartir(texto)}>Compartir comprobante</Boton>
      <div className="grid grid-cols-3 gap-2">
        <Boton variante="secundario" chico disabled={!v.cliente} onClick={() => v.cliente && ir('cliente', v.cliente.id)}>
          Ver cliente
        </Boton>
        <Boton variante="secundario" chico onClick={() => setEditando(true)}>
          Editar
        </Boton>
        <Boton variante="secundario" chico className="text-mal" onClick={() => void eliminar()}>
          Borrar
        </Boton>
      </div>

      <Seccion titulo="Envío" accion={<Boton variante="texto" chico onClick={() => setEnvioAbierto(true)}>{envio ? 'Editar' : '+ Agregar'}</Boton>}>
        {envio ? (
          <Tarjeta>
            <Dato nombre="Transportista" valor={envio.transportista} />
            <Dato nombre="Destino" valor={[envio.localidad, envio.provincia].filter(Boolean).join(', ')} />
            <Dato nombre="Guía" valor={envio.guia || '—'} />
            <Dato nombre="Costo" valor={formatearPesos(envio.costo)} detalle={envio.pagaCliente ? 'lo paga el cliente' : 'lo paga el negocio'} />
            <Dato nombre="Estado" valor={ESTADOS_ENVIO.find(([e]) => e === envio.estado)?.[1]} />
            <div className="mt-2 flex justify-end">
              <Boton
                variante="texto"
                chico
                className="text-mal"
                onClick={() =>
                  void intentar(async () => {
                    const marca = await borrar([{ tabla: 'envios', ids: [envio.id] }], `Envío por ${envio.transportista}`)
                    avisar('Envío borrado', () => restaurar(marca))
                  })
                }
              >
                Quitar envío
              </Boton>
            </div>
          </Tarjeta>
        ) : (
          <p className="text-sm text-suave">Esta venta no tiene envío cargado.</p>
        )}
      </Seccion>

      {pagos.length > 0 && (
        <Seccion titulo="Cobros de esta venta">
          <Tarjeta>
            {pagos.map((p) => (
              <Dato key={p.id} nombre={fechaParaMostrar(p.fecha)} detalle={p.medio} valor={formatearPesos(p.monto)} />
            ))}
          </Tarjeta>
          <p className="text-xs text-suave">Los cobros sin venta elegida se ven en la cuenta del cliente.</p>
        </Seccion>
      )}

      {cambios && cambios.length > 0 && (
        <Seccion titulo="Historial de cambios">
          <Tarjeta>
            {cambios.map((c) => (
              <Dato key={c.id} nombre={c.resumen} valor={new Date(c.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })} tono="suave" />
            ))}
          </Tarjeta>
        </Seccion>
      )}

      {editando && <HojaEditarVenta venta={v} alCerrar={() => setEditando(false)} />}
      {envioAbierto && <HojaEnvio ventaId={venta.id} envio={envio} alCerrar={() => setEnvioAbierto(false)} />}
    </Pagina>
  )
}
