import { useState } from 'react'
import { borrarCliente } from '../datos/acciones'
import { borrar, crear, editar, restaurar } from '../datos/db'
import type { ClienteVista } from '../datos/derivar'
import type { MedioPago } from '../datos/tipos'
import { useApp } from '../datos/useApp'
import { formatearPesos, montoParaEditar } from '../nucleo/dinero'
import { fechaLocal, fechaParaMostrar } from '../nucleo/fecha'
import { coincide } from '../nucleo/texto'
import { ir, volver } from '../ruta'
import { useAvisos } from '../ui/avisos'
import { Boton, Campo, Dato, Dos, Etiqueta, Seccion, Segmentos, Selector, Tarjeta, Vacio } from '../ui/base'
import { compartir } from '../ui/compartir'
import { Hoja } from '../ui/Dialogo'
import { exigirMonto, exigirTexto, useCampos } from '../ui/formulario'
import { Pagina } from '../ui/Pagina'
import { TarjetaVenta } from './Ventas'

export const textoCliente = (c: ClienteVista['cliente']): string => `${c.nombre} ${c.documento} ${c.telefono} ${c.direccion}`

export function Clientes() {
  const { vista } = useApp()
  const [filtro, setFiltro] = useState('')
  const [cuales, setCuales] = useState<'todos' | 'deben'>('todos')
  const [nuevo, setNuevo] = useState(false)
  const lista = vista.clientes.filter((c) => coincide(textoCliente(c.cliente), filtro) && (cuales === 'todos' || c.deuda > 0))

  return (
    <Pagina titulo="Clientes" fab={{ texto: '+ Cliente', alTocar: () => setNuevo(true) }}>
      <Campo etiqueta="Filtrar por nombre, documento, teléfono o dirección" tipo="buscar" valor={filtro} alCambiar={setFiltro} />
      <Segmentos valor={cuales} alCambiar={setCuales} opciones={[['todos', 'Todos'], ['deben', 'Con deuda']]} />
      {lista.length === 0 && (
        <Vacio
          titulo={vista.clientes.length === 0 ? 'Sin clientes' : 'Nada coincide'}
          texto={vista.clientes.length === 0 ? 'Agregá un cliente para poder venderle fiado y llevar su cuenta.' : 'Probá con otro dato o quitá el filtro.'}
        />
      )}
      {lista.map((c) => (
        <Tarjeta key={c.cliente.id} alTocar={() => ir('cliente', c.cliente.id)}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold">{c.cliente.nombre}</p>
              <p className="truncate text-sm text-suave">{[c.cliente.telefono, c.cliente.direccion].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</p>
            </div>
            <span className="shrink-0 text-right">
              {c.deuda > 0 ? (
                <span className="font-semibold tabular-nums text-mal">Debe {formatearPesos(c.deuda)}</span>
              ) : c.saldoAFavor > 0 ? (
                <span className="font-semibold tabular-nums text-bien">A favor {formatearPesos(c.saldoAFavor)}</span>
              ) : (
                <span className="text-sm text-bien">Al día</span>
              )}
            </span>
          </div>
          {c.superaLimite && (
            <div className="mt-2">
              <Etiqueta tono="mal">Superó su límite de crédito</Etiqueta>
            </div>
          )}
        </Tarjeta>
      ))}
      {nuevo && <HojaCliente alCerrar={() => setNuevo(false)} />}
    </Pagina>
  )
}

function HojaCliente({ c, alCerrar }: { c?: ClienteVista['cliente']; alCerrar: () => void }) {
  const { v, poner } = useCampos({
    nombre: c?.nombre ?? '',
    documento: c?.documento ?? '',
    telefono: c?.telefono ?? '',
    direccion: c?.direccion ?? '',
    limite: c?.limiteCredito ? montoParaEditar(c.limiteCredito) : '',
    notas: c?.notas ?? '',
  })

  async function guardar() {
    const datosCliente = {
      nombre: exigirTexto(v.nombre, 'Nombre'),
      documento: v.documento.trim(),
      telefono: v.telefono.trim(),
      direccion: v.direccion.trim(),
      limiteCredito: v.limite.trim() ? exigirMonto(v.limite, 'Límite de crédito') : null,
      notas: v.notas.trim(),
    }
    if (c) await editar('clientes', c.id, datosCliente, `Cliente ${datosCliente.nombre}`)
    else {
      const creado = await crear('clientes', datosCliente, `Cliente ${datosCliente.nombre}`)
      ir('cliente', creado.id)
    }
    alCerrar()
  }

  return (
    <Hoja titulo={c ? 'Editar cliente' : 'Nuevo cliente'} alCerrar={alCerrar} alGuardar={guardar}>
      <Campo etiqueta="Nombre" valor={v.nombre} alCambiar={poner('nombre')} />
      <Dos>
        <Campo etiqueta="Documento (opcional)" valor={v.documento} alCambiar={poner('documento')} placeholder="DNI / CUIT" />
        <Campo etiqueta="Teléfono (opcional)" tipo="tel" valor={v.telefono} alCambiar={poner('telefono')} />
      </Dos>
      <Campo etiqueta="Dirección y localidad (opcional)" valor={v.direccion} alCambiar={poner('direccion')} />
      <Campo etiqueta="Límite de crédito en pesos (opcional)" tipo="monto" valor={v.limite} alCambiar={poner('limite')} ayuda="Avisa antes de fiarle por encima de este monto." />
      <Campo etiqueta="Notas (opcional)" valor={v.notas} alCambiar={poner('notas')} />
    </Hoja>
  )
}

function HojaCobro({ c, alCerrar }: { c: ClienteVista; alCerrar: () => void }) {
  const pendientes = c.ventas.filter((v) => v.saldo > 0).reverse()
  const { v, poner } = useCampos({
    monto: c.deuda > 0 ? montoParaEditar(c.deuda) : '',
    fecha: fechaLocal(),
    medio: 'efectivo',
    ventaId: '',
    notas: '',
  })

  async function guardar() {
    await crear(
      'pagos',
      {
        fecha: v.fecha,
        clienteId: c.cliente.id,
        monto: exigirMonto(v.monto, 'Monto'),
        ventaId: v.ventaId || null,
        medio: v.medio as MedioPago,
        notas: v.notas.trim(),
      },
      `Cobro a ${c.cliente.nombre}`,
    )
    alCerrar()
  }

  return (
    <Hoja titulo="Registrar cobro" alCerrar={alCerrar} alGuardar={guardar} guardar="Registrar cobro">
      <Dos>
        <Campo etiqueta="Monto (pesos)" tipo="monto" valor={v.monto} alCambiar={poner('monto')} />
        <Campo etiqueta="Fecha" tipo="fecha" valor={v.fecha} alCambiar={poner('fecha')} />
      </Dos>
      <Selector etiqueta="Cómo paga" valor={v.medio} alCambiar={poner('medio')} opciones={[['efectivo', 'Efectivo'], ['transferencia', 'Transferencia'], ['otro', 'Otro']]} />
      <Selector
        etiqueta="Aplicar a"
        valor={v.ventaId}
        alCambiar={poner('ventaId')}
        opciones={[
          ['', 'La deuda más antigua'],
          ...pendientes.map((p) => [p.venta.id, `Venta del ${fechaParaMostrar(p.venta.fecha)} · debe ${formatearPesos(p.saldo)}`] as const),
        ]}
      />
      <Campo etiqueta="Notas (opcional)" valor={v.notas} alCambiar={poner('notas')} />
      <p className="text-xs text-suave">Si paga de más, la diferencia queda como saldo a favor.</p>
    </Hoja>
  )
}

export function ClienteDetalle({ id }: { id: string | undefined }) {
  const { vista, datos } = useApp()
  const { confirmar, avisar, intentar } = useAvisos()
  const [editando, setEditando] = useState(false)
  const [cobrando, setCobrando] = useState(false)
  const c = vista.clientes.find((x) => x.cliente.id === id)

  if (!c) {
    return (
      <Pagina titulo="Cliente" atras>
        <Vacio titulo="Este cliente ya no existe" texto="Puede estar en la papelera." />
      </Pagina>
    )
  }
  const { cliente, antiguedad } = c

  const estadoDeCuenta = [
    `*${datos.config.nombreNegocio}*`,
    `Estado de cuenta de ${cliente.nombre} al ${fechaParaMostrar(fechaLocal())}`,
    '',
    ...c.ventas
      .filter((v) => v.saldo > 0)
      .reverse()
      .map((v) => `• ${fechaParaMostrar(v.venta.fecha)}: total ${formatearPesos(v.total)}, pagado ${formatearPesos(v.pagado)}, debe ${formatearPesos(v.saldo)}`),
    '',
    c.deuda > 0 ? `*Saldo pendiente: ${formatearPesos(c.deuda)}*` : c.saldoAFavor > 0 ? `Saldo a favor: ${formatearPesos(c.saldoAFavor)}` : 'Cuenta al día. ¡Gracias!',
  ].join('\n')

  const eliminar = () =>
    intentar(async () => {
      if (!(await confirmar({ titulo: '¿Borrar el cliente?', texto: 'Va a la papelera.', aceptar: 'Borrar', peligro: true }))) return
      const marca = await borrarCliente(vista, cliente.id)
      volver()
      avisar('Cliente borrado', () => restaurar(marca))
    })

  const quitarCobro = (pagoId: string) =>
    intentar(async () => {
      const marca = await borrar([{ tabla: 'pagos', ids: [pagoId] }], `Cobro a ${cliente.nombre}`)
      avisar('Cobro borrado', () => restaurar(marca))
    })

  return (
    <Pagina titulo={cliente.nombre} atras>
      <Tarjeta>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-suave">{c.deuda > 0 ? 'Debe' : c.saldoAFavor > 0 ? 'Saldo a favor' : 'Cuenta'}</span>
          <span className={`text-2xl font-bold tabular-nums ${c.deuda > 0 ? 'text-mal' : 'text-bien'}`}>
            {c.deuda > 0 ? formatearPesos(c.deuda) : c.saldoAFavor > 0 ? formatearPesos(c.saldoAFavor) : 'Al día'}
          </span>
        </div>
        {c.deuda > 0 && (
          <div className="mt-3">
            <Dato nombre="De 0 a 30 días" valor={formatearPesos(antiguedad.hasta30)} />
            <Dato nombre="De 31 a 60 días" valor={formatearPesos(antiguedad.hasta60)} tono={antiguedad.hasta60 > 0 ? 'mal' : 'normal'} />
            <Dato nombre="Más de 60 días" valor={formatearPesos(antiguedad.masDe60)} tono={antiguedad.masDe60 > 0 ? 'mal' : 'normal'} />
          </div>
        )}
        {cliente.limiteCredito !== null && (
          <p className={`mt-3 text-sm ${c.superaLimite ? 'text-mal' : 'text-suave'}`}>
            Límite de crédito: {formatearPesos(cliente.limiteCredito)}
            {c.superaLimite && ' (superado)'}
          </p>
        )}
      </Tarjeta>

      <div className="grid grid-cols-2 gap-2 print:hidden">
        <Boton onClick={() => setCobrando(true)}>Registrar cobro</Boton>
        <Boton variante="secundario" onClick={() => ir('venta-nueva', cliente.id)}>
          Nueva venta
        </Boton>
        <Boton variante="secundario" onClick={() => void compartir(estadoDeCuenta)}>
          Enviar cuenta
        </Boton>
        <Boton variante="secundario" onClick={() => window.print()}>
          Imprimir / PDF
        </Boton>
      </div>

      <Tarjeta>
        <Dato nombre="Documento" valor={cliente.documento || '—'} />
        <Dato nombre="Teléfono" valor={cliente.telefono || '—'} />
        <Dato nombre="Dirección" valor={cliente.direccion || '—'} />
        {cliente.notas && <p className="mt-2 border-t border-borde pt-2 text-sm text-suave">{cliente.notas}</p>}
        <div className="mt-2 flex justify-end print:hidden">
          <Boton variante="texto" chico onClick={() => setEditando(true)}>Editar datos</Boton>
          <Boton variante="texto" chico className="text-mal" onClick={() => void eliminar()}>Borrar</Boton>
        </div>
      </Tarjeta>

      <Seccion titulo="Compras">
        {c.ventas.length === 0 && <p className="text-sm text-suave">Sin compras todavía.</p>}
        {c.ventas.map((v) => (
          <TarjetaVenta key={v.venta.id} v={v} conCliente={false} />
        ))}
      </Seccion>

      <Seccion titulo="Cobros">
        {c.pagos.length === 0 && <p className="text-sm text-suave">Sin cobros registrados.</p>}
        {c.pagos.map((p) => (
          <Tarjeta key={p.id} className="flex items-center justify-between gap-2 py-3">
            <span>
              {fechaParaMostrar(p.fecha)} · {p.medio}
              <span className="block text-sm text-suave">{p.ventaId ? 'A una venta elegida' : 'A la deuda más antigua'}{p.notas && ` · ${p.notas}`}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <span className="font-semibold tabular-nums">{formatearPesos(p.monto)}</span>
              <Boton variante="texto" chico className="text-mal print:hidden" onClick={() => void quitarCobro(p.id)}>Quitar</Boton>
            </span>
          </Tarjeta>
        ))}
      </Seccion>

      {editando && <HojaCliente c={cliente} alCerrar={() => setEditando(false)} />}
      {cobrando && <HojaCobro c={c} alCerrar={() => setCobrando(false)} />}
    </Pagina>
  )
}
