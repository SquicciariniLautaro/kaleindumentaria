import { useLiveQuery } from 'dexie-react-hooks'
import type { ReactNode } from 'react'
import { comprimirImagen } from '../datos/backup'
import { db, guardarFoto } from '../datos/db'
import { ir, volver } from '../ruta'

type Props = {
  titulo: ReactNode
  atras?: boolean
  children: ReactNode
  /** Botón principal flotante, abajo a la derecha: queda al alcance del pulgar. */
  fab?: { texto: string; alTocar: () => void }
}

export function Pagina({ titulo, atras = false, children, fab }: Props) {
  return (
    <>
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-fondo px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] print:static">
        {atras && (
          <button
            type="button"
            aria-label="Volver"
            onClick={volver}
            className="-ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-full print:hidden"
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 5-7 7 7 7" />
            </svg>
          </button>
        )}
        <h1 className="min-w-0 flex-1 truncate text-xl font-bold">{titulo}</h1>
        <button
          type="button"
          aria-label="Buscar"
          onClick={() => ir('buscar')}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-borde bg-tarjeta print:hidden"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m16 16 5 5" />
          </svg>
        </button>
      </header>
      <main className="flex flex-col gap-3 px-4 pb-[calc(10rem+env(safe-area-inset-bottom))] print:pb-0">{children}</main>
      {fab && (
        <button
          type="button"
          onClick={fab.alTocar}
          className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-[max(1rem,calc(50%-17rem))] z-10 min-h-14 rounded-full bg-primario px-6 text-base font-semibold text-sobre-primario shadow-lg active:opacity-80 print:hidden"
        >
          {fab.texto}
        </button>
      )}
    </>
  )
}

const PESTANAS = [
  ['inicio', 'Inicio', ['inicio']],
  ['ventas', 'Ventas', ['ventas', 'venta', 'venta-nueva']],
  ['clientes', 'Clientes', ['clientes', 'cliente']],
  ['stock', 'Stock', ['stock', 'producto']],
  ['mas', 'Más', []],
] as const

export function Navegacion({ pantalla }: { pantalla: string }) {
  const activa = PESTANAS.find(([, , pantallas]) => (pantallas as readonly string[]).includes(pantalla))?.[0] ?? 'mas'
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-borde bg-tarjeta pb-[env(safe-area-inset-bottom)] print:hidden">
      <div className="mx-auto flex max-w-xl">
        {PESTANAS.map(([id, nombre]) => (
          <button
            key={id}
            type="button"
            aria-current={id === activa ? 'page' : undefined}
            onClick={() => ir(id)}
            className={`min-h-16 flex-1 border-t-2 px-1 text-sm font-medium ${id === activa ? 'border-marca text-texto' : 'border-transparent text-suave'}`}
          >
            {nombre}
          </button>
        ))}
      </div>
    </nav>
  )
}

/** Muestra una foto guardada. Las fotos se leen aparte para no cargarlas todas en memoria. */
export function Foto({ id, className = '' }: { id: string; className?: string }) {
  const foto = useLiveQuery(() => db.fotos.get(id), [id])
  if (!foto) return null
  return <img src={foto.dataUrl} alt="" className={`rounded-xl object-cover ${className}`} />
}

/** Botón para sacar o elegir una foto. Devuelve el id de la foto ya guardada. */
export function ElegirFoto({ texto, alElegir }: { texto: string; alElegir: (fotoId: string) => void }) {
  return (
    <label className="grid min-h-12 w-full cursor-pointer place-items-center rounded-xl border border-borde bg-tarjeta px-4 font-semibold">
      {texto}
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={async (e) => {
          const archivo = e.target.files?.[0]
          e.target.value = ''
          if (archivo) alElegir(await guardarFoto(await comprimirImagen(archivo)))
        }}
      />
    </label>
  )
}
