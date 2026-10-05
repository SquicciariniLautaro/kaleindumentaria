import { useState } from 'react'
import { borrar, crear, editar, restaurar } from '../datos/db'
import type { Comprobante } from '../datos/tipos'
import { useApp } from '../datos/useApp'
import { formatearPesos, montoParaEditar } from '../nucleo/dinero'
import { fechaLocal, fechaParaMostrar } from '../nucleo/fecha'
import { coincide } from '../nucleo/texto'
import { useAvisos } from '../ui/avisos'
import { Boton, Campo, Dos, Etiqueta, Segmentos, Selector, Tarjeta, Vacio } from '../ui/base'
import { Dialogo, Hoja } from '../ui/Dialogo'
import { exigirMonto, useCampos } from '../ui/formulario'
import { ElegirFoto, Foto, Pagina } from '../ui/Pagina'

export const textoComprobante = (c: Comprobante): string => `${c.banco} ${c.referencia} ${c.notas}`

function HojaComprobante({ c, alCerrar }: { c?: Comprobante; alCerrar: () => void }) {
  const { vista } = useApp()
  const [fotoId, setFotoId] = useState(c?.fotoId ?? null)
  const { v, poner } = useCampos({
    fecha: c?.fecha ?? fechaLocal(),
    clienteId: c?.clienteId ?? '',
    monto: c ? montoParaEditar(c.monto) : '',
    banco: c?.banco ?? '',
    referencia: c?.referencia ?? '',
    notas: c?.notas ?? '',
  })

  async function guardar() {
    const datosComprobante = {
      fecha: v.fecha,
      clienteId: v.clienteId || null,
      monto: exigirMonto(v.monto, 'Monto'),
      banco: v.banco.trim(),
      referencia: v.referencia.trim(),
      notas: v.notas.trim(),
      fotoId,
    }
    if (c) await editar('comprobantes', c.id, datosComprobante, 'Comprobante editado')
    else await crear('comprobantes', { ...datosComprobante, pagoId: null, verificado: false }, `Comprobante de ${formatearPesos(datosComprobante.monto)}`)
    alCerrar()
  }

  return (
    <Hoja titulo={c ? 'Editar comprobante' : 'Nuevo comprobante'} alCerrar={alCerrar} alGuardar={guardar}>
      <Selector
        etiqueta="Cliente"
        valor={v.clienteId}
        alCambiar={poner('clienteId')}
        opciones={[['', 'Sin identificar todavía'], ...vista.clientes.map((x) => [x.cliente.id, x.cliente.nombre] as const)]}
      />
      <Dos>
        <Campo etiqueta="Monto (pesos)" tipo="monto" valor={v.monto} alCambiar={poner('monto')} />
        <Campo etiqueta="Fecha" tipo="fecha" valor={v.fecha} alCambiar={poner('fecha')} />
      </Dos>
      <Dos>
        <Campo etiqueta="Banco o billetera" valor={v.banco} alCambiar={poner('banco')} placeholder="Mercado Pago, Macro…" />
        <Campo etiqueta="N.º de operación" valor={v.referencia} alCambiar={poner('referencia')} />
      </Dos>
      <Campo etiqueta="Notas (opcional)" valor={v.notas} alCambiar={poner('notas')} />
      {fotoId && <Foto id={fotoId} className="max-h-48 w-full" />}
      <ElegirFoto texto={fotoId ? 'Cambiar foto del comprobante' : 'Adjuntar foto o captura'} alElegir={setFotoId} />
    </Hoja>
  )
}

export function Comprobantes() {
  const { vista, datos } = useApp()
  const { confirmar, avisar, intentar } = useAvisos()
  const [cuales, setCuales] = useState<'pendientes' | 'verificados' | 'todos'>('pendientes')
  const [filtro, setFiltro] = useState('')
  const [editando, setEditando] = useState<Comprobante | 'nuevo' | null>(null)
  const [viendo, setViendo] = useState<string | null>(null)
  const nombreCliente = (id: string | null) => vista.clientes.find((c) => c.cliente.id === id)?.cliente.nombre
  const lista = datos.comprobantes
    .filter((c) => cuales === 'todos' || (cuales === 'verificados') === c.verificado)
    .filter((c) => coincide(`${textoComprobante(c)} ${nombreCliente(c.clienteId) ?? ''} ${fechaParaMostrar(c.fecha)}`, filtro))
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))

  const registrarCobro = (c: Comprobante) =>
    intentar(async () => {
      if (!c.clienteId) throw new Error('Primero elegí de qué cliente es el comprobante (Editar)')
      const ok = await confirmar({
        titulo: '¿Registrar como cobro?',
        texto: `Se anota un cobro por transferencia de ${formatearPesos(c.monto)} a ${nombreCliente(c.clienteId) ?? 'el cliente'}, aplicado a su deuda más antigua.`,
        aceptar: 'Registrar cobro',
      })
      if (!ok) return
      const pago = await crear(
        'pagos',
        { fecha: c.fecha, clienteId: c.clienteId, monto: c.monto, ventaId: null, medio: 'transferencia', notas: c.referencia ? `Operación ${c.referencia}` : '' },
        'Cobro desde comprobante',
      )
      await editar('comprobantes', c.id, { pagoId: pago.id, verificado: true }, 'Comprobante registrado como cobro')
      avisar('Cobro registrado')
    })

  const eliminar = (c: Comprobante) =>
    intentar(async () => {
      const marca = await borrar([{ tabla: 'comprobantes', ids: [c.id] }], `Comprobante de ${formatearPesos(c.monto)}`)
      avisar('Comprobante borrado', () => restaurar(marca))
    })

  return (
    <Pagina titulo="Comprobantes" atras fab={{ texto: '+ Comprobante', alTocar: () => setEditando('nuevo') }}>
      <Campo etiqueta="Filtrar por cliente, banco, operación o fecha" tipo="buscar" valor={filtro} alCambiar={setFiltro} />
      <Segmentos valor={cuales} alCambiar={setCuales} opciones={[['pendientes', 'Sin verificar'], ['verificados', 'Verificados'], ['todos', 'Todos']]} />
      {lista.length === 0 && (
        <Vacio
          titulo="Sin comprobantes acá"
          texto="Guardá cada comprobante de transferencia que te mandan: monto, operación y foto. Después lo verificás contra tu cuenta y lo registrás como cobro."
        />
      )}
      {lista.map((c) => (
        <Tarjeta key={c.id}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold">{nombreCliente(c.clienteId) ?? 'Cliente sin identificar'}</p>
              <p className="text-sm text-suave">
                {fechaParaMostrar(c.fecha)}
                {c.banco && ` · ${c.banco}`}
                {c.referencia && ` · op. ${c.referencia}`}
              </p>
            </div>
            <span className="shrink-0 font-semibold tabular-nums">{formatearPesos(c.monto)}</span>
          </div>
          {c.notas && <p className="mt-1 text-sm text-suave">{c.notas}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <Etiqueta tono={c.verificado ? 'bien' : 'mal'}>{c.verificado ? 'Verificado' : 'Sin verificar'}</Etiqueta>
            <Etiqueta tono={c.pagoId ? 'bien' : 'suave'}>{c.pagoId ? 'Cobro registrado' : 'Sin cobro registrado'}</Etiqueta>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {!c.pagoId && (
              <Boton chico onClick={() => void registrarCobro(c)}>
                Registrar como cobro
              </Boton>
            )}
            <Boton
              variante="secundario"
              chico
              onClick={() => void editar('comprobantes', c.id, { verificado: !c.verificado }, c.verificado ? 'Comprobante sin verificar' : 'Comprobante verificado')}
            >
              {c.verificado ? 'Quitar verificado' : 'Marcar verificado'}
            </Boton>
            {c.fotoId && (
              <Boton variante="secundario" chico onClick={() => setViendo(c.fotoId)}>
                Ver foto
              </Boton>
            )}
            <Boton variante="secundario" chico onClick={() => setEditando(c)}>
              Editar
            </Boton>
            <Boton variante="secundario" chico className="text-mal" onClick={() => void eliminar(c)}>
              Borrar
            </Boton>
          </div>
        </Tarjeta>
      ))}
      {editando && <HojaComprobante c={editando === 'nuevo' ? undefined : editando} alCerrar={() => setEditando(null)} />}
      {viendo && (
        <Dialogo titulo="Comprobante" alCerrar={() => setViendo(null)}>
          <Foto id={viendo} className="mb-3 w-full" />
          <Boton variante="secundario" onClick={() => setViendo(null)}>
            Cerrar
          </Boton>
        </Dialogo>
      )}
    </Pagina>
  )
}
