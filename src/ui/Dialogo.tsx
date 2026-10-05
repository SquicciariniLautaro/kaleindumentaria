import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Boton } from './base'

type Props = {
  abierto?: boolean
  titulo: string
  alCerrar: () => void
  children: ReactNode
}

/**
 * Diálogo propio en pantalla. Reemplaza a alert() y confirm(), que no funcionan
 * en páginas incrustadas. En el celular aparece pegado abajo, al alcance del pulgar.
 */
export function Dialogo({ abierto = true, titulo, alCerrar, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialogo = ref.current
    if (!dialogo) return
    if (abierto && !dialogo.open) dialogo.showModal()
    if (!abierto && dialogo.open) dialogo.close()
  }, [abierto])

  return (
    <dialog
      ref={ref}
      onClose={alCerrar}
      onClick={(e) => {
        if (e.target === ref.current) alCerrar()
      }}
      className="m-auto mb-0 max-h-[92dvh] w-full max-w-full overflow-y-auto rounded-t-3xl bg-tarjeta p-0 text-texto backdrop:bg-black/50 sm:mb-auto sm:max-w-md sm:rounded-3xl"
    >
      {abierto && (
        <div className="p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <h2 className="mb-4 text-lg font-semibold">{titulo}</h2>
          {children}
        </div>
      )}
    </dialog>
  )
}

type HojaProps = {
  titulo: string
  alCerrar: () => void
  /** Guarda y cierra. Si algo no es válido, lanza un Error y el mensaje se muestra en la hoja. */
  alGuardar: () => void | Promise<void>
  guardar?: string
  children: ReactNode
}

/** Formulario dentro de un diálogo, con Guardar y Cancelar abajo. */
export function Hoja({ titulo, alCerrar, alGuardar, guardar = 'Guardar', children }: HojaProps) {
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function enviar() {
    setGuardando(true)
    setError('')
    try {
      await alGuardar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
      setGuardando(false)
    }
  }

  return (
    <Dialogo titulo={titulo} alCerrar={alCerrar}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          void enviar()
        }}
      >
        {children}
        {error && (
          <p role="alert" className="rounded-xl bg-mal/10 px-3 py-2 text-sm text-mal">
            {error}
          </p>
        )}
        <Boton type="submit" disabled={guardando}>
          {guardar}
        </Boton>
        <Boton variante="secundario" onClick={alCerrar}>
          Cancelar
        </Boton>
      </form>
    </Dialogo>
  )
}
