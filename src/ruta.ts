import { useSyncExternalStore } from 'react'

export type Ruta = { pantalla: string; id: string | undefined }

const leer = (): string => window.location.hash.replace(/^#\/?/, '')

function suscribir(avisar: () => void): () => void {
  window.addEventListener('hashchange', avisar)
  return () => window.removeEventListener('hashchange', avisar)
}

/** Navegación por la parte #/... de la dirección: funciona el botón atrás y sin conexión. */
export function useRuta(): Ruta {
  const [pantalla, id] = useSyncExternalStore(suscribir, leer).split('/')
  return { pantalla: pantalla || 'inicio', id: id || undefined }
}

export function ir(pantalla: string, id?: string, opciones: { reemplazar?: boolean } = {}): void {
  const destino = `#/${pantalla}${id ? `/${id}` : ''}`
  if (opciones.reemplazar) window.location.replace(destino)
  else window.location.hash = destino
}

export function volver(): void {
  if (window.history.length > 1) window.history.back()
  else ir('inicio')
}
