import { useLiveQuery } from 'dexie-react-hooks'
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { fechaLocal } from '../nucleo/fecha'
import { leerDatos } from './db'
import { derivar, type Datos, type Vista } from './derivar'

type App = { datos: Datos; vista: Vista }

const Contexto = createContext<App | null>(null)

/** Lee la base local y recalcula todo cada vez que cambia algo guardado. */
export function ProveedorDatos({ children }: { children: ReactNode }) {
  const datos = useLiveQuery(leerDatos)
  const app = useMemo(() => (datos ? { datos, vista: derivar(datos, fechaLocal()) } : null), [datos])
  const tema = datos?.config.tema

  useEffect(() => {
    if (!tema || tema === 'auto') delete document.documentElement.dataset.tema
    else document.documentElement.dataset.tema = tema
  }, [tema])

  if (!app) return <p className="p-6 text-suave">Cargando…</p>
  return <Contexto.Provider value={app}>{children}</Contexto.Provider>
}

export function useApp(): App {
  const app = useContext(Contexto)
  if (!app) throw new Error('useApp se usa dentro de ProveedorDatos')
  return app
}
