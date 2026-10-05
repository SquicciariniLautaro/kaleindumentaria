import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Boton } from './base'
import { Dialogo } from './Dialogo'

type Confirmacion = { titulo: string; texto?: string; aceptar?: string; peligro?: boolean }
type Deshacer = () => void | Promise<void>

type Avisos = {
  /** Pregunta en pantalla. Resuelve true si la persona acepta. */
  confirmar: (c: Confirmacion) => Promise<boolean>
  /** Mensaje breve abajo. Si se pasa deshacer, muestra el botón Deshacer. */
  avisar: (texto: string, deshacer?: Deshacer) => void
  /** Ejecuta algo y, si falla, muestra el motivo en vez de romper la pantalla. */
  intentar: (accion: () => void | Promise<void>) => Promise<void>
}

const Contexto = createContext<Avisos | null>(null)

export function useAvisos(): Avisos {
  const avisos = useContext(Contexto)
  if (!avisos) throw new Error('useAvisos se usa dentro de ProveedorAvisos')
  return avisos
}

export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [pedido, setPedido] = useState<(Confirmacion & { resolver: (ok: boolean) => void }) | null>(null)
  const [aviso, setAviso] = useState<{ texto: string; deshacer?: Deshacer } | null>(null)

  const avisos = useMemo<Avisos>(() => {
    const avisar: Avisos['avisar'] = (texto, deshacer) => setAviso({ texto, deshacer })
    return {
      confirmar: (c) => new Promise((resolver) => setPedido({ ...c, resolver })),
      avisar,
      intentar: async (accion) => {
        try {
          await accion()
        } catch (e) {
          avisar(e instanceof Error ? e.message : 'Algo salió mal')
        }
      },
    }
  }, [])

  useEffect(() => {
    if (!aviso) return
    const reloj = setTimeout(() => setAviso(null), aviso.deshacer ? 8000 : 4000)
    return () => clearTimeout(reloj)
  }, [aviso])

  function responder(ok: boolean) {
    pedido?.resolver(ok)
    setPedido(null)
  }

  return (
    <Contexto.Provider value={avisos}>
      {children}
      <Dialogo abierto={pedido !== null} titulo={pedido?.titulo ?? ''} alCerrar={() => responder(false)}>
        {pedido?.texto && <p className="mb-4 text-suave">{pedido.texto}</p>}
        <div className="flex flex-col gap-2">
          <Boton variante={pedido?.peligro ? 'peligro' : 'principal'} onClick={() => responder(true)}>
            {pedido?.aceptar ?? 'Aceptar'}
          </Boton>
          <Boton variante="secundario" onClick={() => responder(false)}>
            Cancelar
          </Boton>
        </div>
      </Dialogo>
      {aviso && (
        <div
          role="status"
          className="fixed inset-x-0 bottom-[calc(9.5rem+env(safe-area-inset-bottom))] z-20 mx-auto max-w-xl px-4 print:hidden"
        >
          <div className="flex items-center gap-3 rounded-xl bg-texto px-4 py-2 text-fondo shadow-lg">
            <p className="flex-1 py-1 text-sm">{aviso.texto}</p>
            {aviso.deshacer && (
              <button
                type="button"
                className="min-h-10 px-2 text-sm font-bold underline"
                onClick={() => {
                  void aviso.deshacer?.()
                  setAviso(null)
                }}
              >
                Deshacer
              </button>
            )}
          </div>
        </div>
      )}
    </Contexto.Provider>
  )
}
