import { useState } from 'react'
import { editar } from '../datos/db'
import type { Envio, EstadoEnvio } from '../datos/tipos'
import { useApp } from '../datos/useApp'
import { formatearPesos } from '../nucleo/dinero'
import { fechaParaMostrar } from '../nucleo/fecha'
import { coincide } from '../nucleo/texto'
import { ir } from '../ruta'
import { Boton, Campo, Etiqueta, Segmentos, Tarjeta, Vacio } from '../ui/base'
import { Pagina } from '../ui/Pagina'

const SIGUIENTE: Record<EstadoEnvio, { estado: EstadoEnvio; texto: string } | null> = {
  preparado: { estado: 'despachado', texto: 'Marcar despachado' },
  despachado: { estado: 'entregado', texto: 'Marcar entregado' },
  entregado: null,
}

const NOMBRE: Record<EstadoEnvio, string> = { preparado: 'Preparado', despachado: 'Despachado', entregado: 'Entregado' }

export const textoEnvio = (e: Envio): string => `${e.transportista} ${e.guia} ${e.provincia} ${e.localidad}`

export function Envios() {
  const { vista, datos } = useApp()
  const [cuales, setCuales] = useState<'pendientes' | 'entregados' | 'todos'>('pendientes')
  const [filtro, setFiltro] = useState('')
  const ventaPorId = new Map(vista.ventas.map((v) => [v.venta.id, v]))
  const lista = datos.envios
    .filter((e) => cuales === 'todos' || (cuales === 'entregados') === (e.estado === 'entregado'))
    .filter((e) => coincide(`${textoEnvio(e)} ${ventaPorId.get(e.ventaId)?.cliente?.nombre ?? ''}`, filtro))
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))

  return (
    <Pagina titulo="Envíos" atras>
      <Campo etiqueta="Filtrar por guía, transportista, destino o cliente" tipo="buscar" valor={filtro} alCambiar={setFiltro} />
      <Segmentos valor={cuales} alCambiar={setCuales} opciones={[['pendientes', 'Pendientes'], ['entregados', 'Entregados'], ['todos', 'Todos']]} />
      {lista.length === 0 && (
        <Vacio titulo="Sin envíos acá" texto="Los envíos se cargan desde el detalle de cada venta, con el botón «+ Agregar» de la sección Envío." />
      )}
      {lista.map((e) => {
        const siguiente = SIGUIENTE[e.estado]
        return (
          <Tarjeta key={e.id}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">{ventaPorId.get(e.ventaId)?.cliente?.nombre ?? 'Venta sin cliente'}</p>
                <p className="text-sm text-suave">
                  {[e.localidad, e.provincia].filter(Boolean).join(', ')} · {fechaParaMostrar(e.fecha)}
                </p>
              </div>
              <Etiqueta tono={e.estado === 'entregado' ? 'bien' : 'normal'}>{NOMBRE[e.estado]}</Etiqueta>
            </div>
            <p className="mt-2 text-sm">
              {e.transportista}
              {e.guia && ` · guía ${e.guia}`} · {formatearPesos(e.costo)} ({e.pagaCliente ? 'paga el cliente' : 'paga el negocio'})
            </p>
            <div className="mt-3 flex gap-2">
              <Boton variante="secundario" chico className="flex-1" onClick={() => ir('venta', e.ventaId)}>
                Ver venta
              </Boton>
              {siguiente && (
                <Boton chico className="flex-1" onClick={() => void editar('envios', e.id, { estado: siguiente.estado }, `Envío ${NOMBRE[siguiente.estado].toLowerCase()}`)}>
                  {siguiente.texto}
                </Boton>
              )}
            </div>
          </Tarjeta>
        )
      })}
    </Pagina>
  )
}
