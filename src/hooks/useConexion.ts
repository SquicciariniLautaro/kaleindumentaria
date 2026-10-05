import { useSyncExternalStore } from 'react'

function suscribir(avisar: () => void): () => void {
  window.addEventListener('online', avisar)
  window.addEventListener('offline', avisar)
  return () => {
    window.removeEventListener('online', avisar)
    window.removeEventListener('offline', avisar)
  }
}

/** true si el dispositivo tiene conexión. Se actualiza solo al perder o recuperar señal. */
export function useConexion(): boolean {
  return useSyncExternalStore(suscribir, () => navigator.onLine)
}
