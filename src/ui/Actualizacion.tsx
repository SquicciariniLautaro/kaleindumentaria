import { useRegisterSW } from 'virtual:pwa-register/react'
import { Boton } from './base'

/**
 * Activa el funcionamiento sin conexión al abrir la app y avisa cuando hay una
 * versión nueva. La app nunca se recarga sola en medio de una carga de datos.
 */
export function Actualizacion() {
  const {
    needRefresh: [hayVersionNueva],
    updateServiceWorker,
  } = useRegisterSW()

  if (!hayVersionNueva) return null
  return (
    <div className="fixed inset-x-0 top-[env(safe-area-inset-top)] z-30 mx-auto max-w-xl px-4 pt-2 print:hidden">
      <div role="status" className="flex items-center gap-3 rounded-xl border border-marca bg-tarjeta px-4 py-2 shadow-lg">
        <p className="flex-1 text-sm">Hay una versión nueva de la app.</p>
        <Boton chico onClick={() => void updateServiceWorker(true)}>
          Actualizar
        </Boton>
      </div>
    </div>
  )
}
