import { useState } from 'react'
import { borrar, crear, guardarConfig, restaurar } from '../datos/db'
import { TIPOS_COTIZACION, type Tema } from '../datos/tipos'
import { useApp } from '../datos/useApp'
import { cotizacionDesdeCambio } from '../nucleo/costos'
import { formatearCotizacion, MULTIPLOS_REDONDEO, type MonedaExtranjera, type MultiploRedondeo } from '../nucleo/dinero'
import { fechaLocal, fechaParaMostrar } from '../nucleo/fecha'
import { useAvisos } from '../ui/avisos'
import { Boton, Campo, Dato, Dos, Seccion, Segmentos, Selector, Tarjeta } from '../ui/base'
import { Hoja } from '../ui/Dialogo'
import { exigirCotizacion, exigirMonto, exigirTexto, leerPorcentaje, useCampos } from '../ui/formulario'
import { Pagina } from '../ui/Pagina'

const MONEDAS_EXTRANJERAS: readonly (readonly [MonedaExtranjera, string])[] = [
  ['BOB', 'Boliviano (BOB)'],
  ['USD', 'Dólar (USD)'],
]
const OPCIONES_TIPO = TIPOS_COTIZACION.map((t) => [t, t] as const)

function HojaCotizacion({ moneda, alCerrar }: { moneda: MonedaExtranjera; alCerrar: () => void }) {
  const { datos } = useApp()
  const { v, poner } = useCampos({
    moneda: moneda as string,
    tipo: datos.config.tipoCotizacion[moneda],
    valor: '',
    fecha: fechaLocal(),
    pesos: '',
    recibido: '',
  })

  async function guardar() {
    const cambio = v.pesos.trim() !== '' || v.recibido.trim() !== ''
    const valor = cambio
      ? cotizacionDesdeCambio(exigirMonto(v.pesos, 'Pesos entregados'), exigirMonto(v.recibido, 'Moneda recibida'))
      : exigirCotizacion(v.valor, 'Cotización')
    await crear('cotizaciones', { fecha: v.fecha, moneda: v.moneda as MonedaExtranjera, tipo: v.tipo, valor }, `Cotización ${v.moneda} ${formatearCotizacion(valor)}`)
    alCerrar()
  }

  return (
    <Hoja titulo="Actualizar cotización" alCerrar={alCerrar} alGuardar={guardar}>
      <Dos>
        <Selector etiqueta="Moneda" valor={v.moneda} alCambiar={poner('moneda')} opciones={MONEDAS_EXTRANJERAS} />
        <Selector etiqueta="Tipo" valor={v.tipo} alCambiar={poner('tipo')} opciones={OPCIONES_TIPO} />
      </Dos>
      <Dos>
        <Campo etiqueta={`1 ${v.moneda} = pesos`} tipo="monto" valor={v.valor} alCambiar={poner('valor')} autoFocus />
        <Campo etiqueta="Fecha" tipo="fecha" valor={v.fecha} alCambiar={poner('fecha')} />
      </Dos>
      <p className="text-sm text-suave">O cargá lo que cambiaste y se calcula sola:</p>
      <Dos>
        <Campo etiqueta="Pesos entregados" tipo="monto" valor={v.pesos} alCambiar={poner('pesos')} />
        <Campo etiqueta={`${v.moneda} recibidos`} tipo="monto" valor={v.recibido} alCambiar={poner('recibido')} />
      </Dos>
    </Hoja>
  )
}

export function Configuracion() {
  const { datos, vista } = useApp()
  const { avisar, intentar } = useAvisos()
  const { config } = datos
  const [cotizando, setCotizando] = useState<MonedaExtranjera | null>(null)
  const { v, poner } = useCampos({
    nombre: config.nombreNegocio,
    margen: String(config.margenDefecto).replace('.', ','),
    mayorista: String(config.margenMayorista).replace('.', ','),
  })
  const historial = [...datos.cotizaciones].sort((a, b) => (a.fecha + a.creadoEn < b.fecha + b.creadoEn ? 1 : -1)).slice(0, 30)

  const guardar = () =>
    intentar(async () => {
      await guardarConfig(config, {
        nombreNegocio: exigirTexto(v.nombre, 'Nombre del negocio'),
        margenDefecto: leerPorcentaje(v.margen, 'Ganancia minorista') ?? 0,
        margenMayorista: leerPorcentaje(v.mayorista, 'Ganancia mayorista') ?? 0,
      })
      avisar('Configuración guardada')
    })

  return (
    <Pagina titulo="Configuración" atras>
      <Seccion titulo="Cotizaciones">
        {MONEDAS_EXTRANJERAS.map(([moneda, nombre]) => (
          <Tarjeta key={moneda}>
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <span className="text-suave">{nombre}</span>
              <span className="text-xl font-bold tabular-nums">
                {vista.cotizacionesHoy[moneda] ? `$ ${formatearCotizacion(vista.cotizacionesHoy[moneda])}` : 'Sin cargar'}
              </span>
            </div>
            <Selector
              etiqueta="Tipo que se usa para calcular precios"
              valor={config.tipoCotizacion[moneda]}
              alCambiar={(tipo) => void guardarConfig(config, { tipoCotizacion: { ...config.tipoCotizacion, [moneda]: tipo } })}
              opciones={OPCIONES_TIPO}
            />
            <Boton className="mt-3" onClick={() => setCotizando(moneda)}>
              Actualizar {moneda}
            </Boton>
          </Tarjeta>
        ))}
      </Seccion>

      <Seccion titulo="Negocio y precios">
        <Campo etiqueta="Nombre del negocio" valor={v.nombre} alCambiar={poner('nombre')} />
        <Dos>
          <Campo etiqueta="Ganancia minorista %" tipo="monto" valor={v.margen} alCambiar={poner('margen')} />
          <Campo etiqueta="Ganancia mayorista %" tipo="monto" valor={v.mayorista} alCambiar={poner('mayorista')} />
        </Dos>
        <p className="text-xs text-suave">
          Es el porcentaje que se suma sobre el costo de reposición. Cada producto puede tener el suyo.
        </p>
        <Boton onClick={() => void guardar()}>Guardar</Boton>
      </Seccion>

      <Seccion titulo="Redondeo del precio sugerido (pesos)">
        <Segmentos
          valor={String(config.multiplo)}
          alCambiar={(m) => void guardarConfig(config, { multiplo: Number(m) as MultiploRedondeo })}
          opciones={MULTIPLOS_REDONDEO.map((m) => [String(m), `$ ${m}`] as const)}
        />
      </Seccion>

      <Seccion titulo="Apariencia">
        <Segmentos<Tema>
          valor={config.tema}
          alCambiar={(tema) => void guardarConfig(config, { tema })}
          opciones={[['auto', 'Según el celular'], ['claro', 'Claro'], ['oscuro', 'Oscuro']]}
        />
      </Seccion>

      <Seccion titulo="Historial de cotizaciones">
        {historial.length === 0 && <p className="text-sm text-suave">Todavía no cargaste ninguna.</p>}
        {historial.length > 0 && (
          <Tarjeta>
            {historial.map((c) => (
              <Dato
                key={c.id}
                nombre={`${c.moneda} · ${c.tipo}`}
                detalle={fechaParaMostrar(c.fecha)}
                valor={
                  <span className="flex items-center gap-1">
                    $ {formatearCotizacion(c.valor)}
                    <Boton
                      variante="texto"
                      chico
                      className="text-mal"
                      onClick={() =>
                        void intentar(async () => {
                          const marca = await borrar([{ tabla: 'cotizaciones', ids: [c.id] }], `Cotización ${c.moneda}`)
                          avisar('Cotización borrada', () => restaurar(marca))
                        })
                      }
                    >
                      Quitar
                    </Boton>
                  </span>
                }
              />
            ))}
          </Tarjeta>
        )}
      </Seccion>

      {cotizando && <HojaCotizacion moneda={cotizando} alCerrar={() => setCotizando(null)} />}
    </Pagina>
  )
}
