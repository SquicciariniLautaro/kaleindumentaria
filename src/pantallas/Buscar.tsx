import { useState } from 'react'
import { useApp } from '../datos/useApp'
import { formatearPesos } from '../nucleo/dinero'
import { fechaParaMostrar } from '../nucleo/fecha'
import { coincide } from '../nucleo/texto'
import { describirUnidades } from '../nucleo/unidades'
import { ir } from '../ruta'
import { Campo, Seccion, Tarjeta, Vacio } from '../ui/base'
import { Pagina } from '../ui/Pagina'
import { textoCliente } from './Clientes'
import { textoComprobante } from './Comprobantes'
import { textoEnvio } from './Envios'

type Resultado = { clave: string; titulo: string; detalle: string; destino: [pantalla: string, id?: string] }

const MAXIMO = 8

export function Buscar() {
  const { vista, datos } = useApp()
  const [q, setQ] = useState('')
  const hay = q.trim().length > 0
  const nombreCliente = (id: string | null) => vista.clientes.find((c) => c.cliente.id === id)?.cliente.nombre

  const grupos: [string, Resultado[]][] = !hay
    ? []
    : [
        [
          'Clientes',
          vista.clientes
            .filter((c) => coincide(textoCliente(c.cliente), q))
            .map((c) => ({
              clave: c.cliente.id,
              titulo: c.cliente.nombre,
              detalle: [c.cliente.documento, c.cliente.telefono, c.cliente.direccion].filter(Boolean).join(' · ') + (c.deuda > 0 ? ` · debe ${formatearPesos(c.deuda)}` : ''),
              destino: ['cliente', c.cliente.id],
            })),
        ],
        [
          'Productos',
          vista.productos
            .filter((p) => coincide(`${p.producto.nombre} ${p.producto.sku}`, q))
            .map((p) => ({
              clave: p.producto.id,
              titulo: p.producto.nombre,
              detalle: `${p.producto.sku || 'sin código'} · ${describirUnidades(p.stock)}`,
              destino: ['producto', p.producto.id],
            })),
        ],
        [
          'Envíos',
          datos.envios
            .filter((e) => coincide(textoEnvio(e), q))
            .map((e) => ({
              clave: e.id,
              titulo: `${e.transportista}${e.guia ? ` · guía ${e.guia}` : ''}`,
              detalle: `${[e.localidad, e.provincia].filter(Boolean).join(', ')} · ${e.estado}`,
              destino: ['venta', e.ventaId],
            })),
        ],
        [
          'Ventas',
          vista.ventas
            .filter((v) => coincide(`${v.cliente?.nombre ?? ''} ${v.venta.fecha} ${fechaParaMostrar(v.venta.fecha)} ${v.venta.notas}`, q))
            .map((v) => ({
              clave: v.venta.id,
              titulo: `${fechaParaMostrar(v.venta.fecha)} · ${v.cliente?.nombre ?? 'Sin cliente'}`,
              detalle: `${formatearPesos(v.total)}${v.saldo > 0 ? ` · debe ${formatearPesos(v.saldo)}` : ' · pagada'}`,
              destino: ['venta', v.venta.id],
            })),
        ],
        [
          'Comprobantes',
          datos.comprobantes
            .filter((c) => coincide(`${textoComprobante(c)} ${nombreCliente(c.clienteId) ?? ''} ${fechaParaMostrar(c.fecha)}`, q))
            .map((c) => ({
              clave: c.id,
              titulo: `${formatearPesos(c.monto)} · ${nombreCliente(c.clienteId) ?? 'sin identificar'}`,
              detalle: `${fechaParaMostrar(c.fecha)}${c.referencia ? ` · op. ${c.referencia}` : ''}`,
              destino: ['comprobantes'],
            })),
        ],
      ]
  const conResultados = grupos.filter(([, r]) => r.length > 0)

  return (
    <Pagina titulo="Buscar" atras>
      <Campo
        etiqueta="Nombre, documento, teléfono, dirección, guía, producto o fecha"
        tipo="buscar"
        valor={q}
        alCambiar={setQ}
        autoFocus
      />
      {!hay && <p className="text-sm text-suave">No importan las tildes, los espacios ni los guiones: «388412» encuentra «388 412-3456».</p>}
      {hay && conResultados.length === 0 && <Vacio titulo="Sin resultados" texto="Probá con menos letras o con otro dato." />}
      {conResultados.map(([nombre, resultados]) => (
        <Seccion key={nombre} titulo={`${nombre} (${resultados.length})`}>
          {resultados.slice(0, MAXIMO).map((r) => (
            <Tarjeta key={r.clave} alTocar={() => ir(...r.destino)} className="py-3">
              <p className="font-semibold">{r.titulo}</p>
              <p className="truncate text-sm text-suave">{r.detalle}</p>
            </Tarjeta>
          ))}
          {resultados.length > MAXIMO && <p className="text-sm text-suave">Y {resultados.length - MAXIMO} más: escribí algo más para afinar.</p>}
        </Seccion>
      ))}
    </Pagina>
  )
}
