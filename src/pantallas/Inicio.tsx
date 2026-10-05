import { cargarEjemplo } from '../datos/ejemplo'
import { useApp } from '../datos/useApp'
import { formatearCotizacion, formatearPesos } from '../nucleo/dinero'
import { ir } from '../ruta'
import { useAvisos } from '../ui/avisos'
import { Boton, Tarjeta, Vacio } from '../ui/base'
import { Pagina } from '../ui/Pagina'

function Indicador({ nombre, valor, tono = '' }: { nombre: string; valor: string; tono?: string }) {
  return (
    <div className="rounded-2xl border border-borde bg-tarjeta p-4">
      <p className="text-sm text-suave">{nombre}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${tono}`}>{valor}</p>
    </div>
  )
}

function Alerta({ texto, destino }: { texto: string; destino: string }) {
  return (
    <Tarjeta alTocar={() => ir(destino)} className="flex items-center justify-between gap-3 border-marca py-3">
      <span>{texto}</span>
      <span className="text-suave">›</span>
    </Tarjeta>
  )
}

export function Inicio() {
  const { vista, datos } = useApp()
  const { intentar } = useAvisos()
  const { totales, cotizacionesHoy } = vista
  const stockBajo = vista.productos.filter((p) => p.bajoMinimo).length
  const enviosPendientes = datos.envios.filter((e) => e.estado !== 'entregado').length
  const sinVerificar = datos.comprobantes.filter((c) => !c.verificado).length
  const sinCotizacion = cotizacionesHoy.BOB === 0 || cotizacionesHoy.USD === 0
  const sinDatos = datos.viajes.length === 0 && datos.clientes.length === 0 && datos.productos.length === 0

  return (
    <Pagina
      titulo={
        <span className="flex items-center gap-2.5">
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt=""
            className="h-10 w-10 rounded-full bg-[#1d1a16] p-1"
          />
          {datos.config.nombreNegocio}
        </span>
      }
    >
      {sinDatos && (
        <Vacio
          titulo="Todavía no hay nada cargado"
          texto="Empezá por la cotización de hoy y tu primer viaje, o cargá datos de ejemplo para recorrer la app."
        >
          <Boton variante="secundario" onClick={() => void intentar(cargarEjemplo)}>
            Cargar datos de ejemplo
          </Boton>
        </Vacio>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Indicador nombre="Ganancia real" valor={formatearPesos(totales.ganancia)} tono={totales.ganancia < 0 ? 'text-mal' : 'text-bien'} />
        <Indicador nombre="Por cobrar" valor={formatearPesos(totales.porCobrar)} tono={totales.porCobrar > 0 ? 'text-mal' : ''} />
        <Indicador nombre="Cobrado" valor={formatearPesos(totales.cobrado)} />
        <Indicador nombre="Stock a costo real" valor={formatearPesos(totales.valorStock)} />
      </div>

      <Boton onClick={() => ir('venta-nueva')}>Nueva venta</Boton>
      <div className="grid grid-cols-2 gap-3">
        <Boton variante="secundario" onClick={() => ir('clientes')}>
          Registrar cobro
        </Boton>
        <Boton variante="secundario" onClick={() => ir('comprobantes')}>
          Comprobantes
        </Boton>
        <Boton variante="secundario" onClick={() => ir('viajes')}>
          Viajes
        </Boton>
        <Boton variante="secundario" onClick={() => ir('envios')}>
          Envíos
        </Boton>
      </div>

      {sinCotizacion && <Alerta texto="Falta cargar la cotización de hoy" destino="config" />}
      {stockBajo > 0 && <Alerta texto={`${stockBajo} producto${stockBajo === 1 ? '' : 's'} con stock bajo`} destino="stock" />}
      {enviosPendientes > 0 && (
        <Alerta texto={`${enviosPendientes} envío${enviosPendientes === 1 ? '' : 's'} sin entregar`} destino="envios" />
      )}
      {sinVerificar > 0 && (
        <Alerta texto={`${sinVerificar} comprobante${sinVerificar === 1 ? '' : 's'} sin verificar`} destino="comprobantes" />
      )}

      <Tarjeta alTocar={() => ir('config')} className="flex items-center justify-between gap-3 py-3 text-sm">
        <span className="text-suave">Cotización en uso</span>
        <span className="font-semibold tabular-nums">
          BOB {cotizacionesHoy.BOB ? formatearCotizacion(cotizacionesHoy.BOB) : '—'} · USD{' '}
          {cotizacionesHoy.USD ? formatearCotizacion(cotizacionesHoy.USD) : '—'}
        </span>
      </Tarjeta>
    </Pagina>
  )
}
