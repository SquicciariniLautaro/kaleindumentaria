import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useConexion } from '../hooks/useConexion'
import { ir } from '../ruta'
import { Boton, Dato, Seccion, Tarjeta } from '../ui/base'
import { Pagina } from '../ui/Pagina'

const MENU = [
  ['viajes', 'Viajes', 'Compras, gastos y rentabilidad de cada viaje'],
  ['envios', 'Envíos', 'Transportista, guía y estado'],
  ['comprobantes', 'Comprobantes', 'Transferencias recibidas y su verificación'],
  ['reportes', 'Reportes', 'Ganancia, deuda y exportaciones'],
  ['config', 'Configuración', 'Cotizaciones, márgenes y redondeo'],
  ['datos', 'Datos y backup', 'Copia de seguridad e importación'],
  ['historial', 'Historial de cambios', 'Quién tocó qué y cuándo'],
  ['papelera', 'Papelera', 'Restaurar lo borrado'],
] as const

type Guardado = 'consultando' | 'protegido' | 'sin-proteger' | 'no-disponible'

function estaInstalada(): boolean {
  // iOS viejo no soporta display-mode: usa navigator.standalone.
  const enIos = 'standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true
  return enIos || window.matchMedia('(display-mode: standalone)').matches
}

export function Mas() {
  const enLinea = useConexion()
  const [guardado, setGuardado] = useState<Guardado>('consultando')
  const {
    needRefresh: [hayVersionNueva],
    updateServiceWorker,
  } = useRegisterSW()

  useEffect(() => {
    if (!navigator.storage?.persisted) setGuardado('no-disponible')
    else void navigator.storage.persisted().then((ok) => setGuardado(ok ? 'protegido' : 'sin-proteger'))
  }, [])

  const TEXTO_GUARDADO: Record<Guardado, string> = {
    consultando: '…',
    protegido: 'Protegidos',
    'sin-proteger': 'Sin proteger',
    'no-disponible': 'No disponible',
  }

  return (
    <Pagina titulo="Más">
      {hayVersionNueva && (
        <Tarjeta className="flex items-center justify-between gap-3 border-marca">
          <span>Hay una versión nueva de la app.</span>
          <Boton chico onClick={() => void updateServiceWorker(true)}>
            Actualizar
          </Boton>
        </Tarjeta>
      )}
      {MENU.map(([destino, nombre, detalle]) => (
        <Tarjeta key={destino} alTocar={() => ir(destino)} className="flex items-center justify-between gap-3 py-3">
          <span>
            <span className="font-semibold">{nombre}</span>
            <span className="block text-sm text-suave">{detalle}</span>
          </span>
          <span className="text-suave">›</span>
        </Tarjeta>
      ))}

      <Seccion titulo="Estado de la app">
        <Tarjeta>
          <Dato nombre="Conexión" valor={enLinea ? 'En línea' : 'Sin conexión'} tono={enLinea ? 'bien' : 'mal'} />
          <Dato nombre="Instalación" valor={estaInstalada() ? 'Instalada' : 'En el navegador'} />
          <Dato nombre="Datos en este equipo" valor={TEXTO_GUARDADO[guardado]} tono={guardado === 'protegido' ? 'bien' : 'normal'} />
          <Dato nombre="Sincronización" valor="Todavía no activa" detalle="Los datos están solo en este equipo" />
          <Dato nombre="Versión" valor={__APP_VERSION__} />
        </Tarjeta>
        {guardado === 'sin-proteger' && (
          <Boton variante="secundario" onClick={() => void navigator.storage.persist().then((ok) => setGuardado(ok ? 'protegido' : 'sin-proteger'))}>
            Pedir al navegador que no borre los datos
          </Boton>
        )}
      </Seccion>
    </Pagina>
  )
}
