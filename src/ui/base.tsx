import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variante = 'principal' | 'secundario' | 'peligro' | 'texto'

const VARIANTES: Record<Variante, string> = {
  principal: 'bg-primario text-sobre-primario',
  secundario: 'border border-borde bg-tarjeta text-texto',
  peligro: 'bg-mal text-white',
  texto: 'text-acento',
}

type BotonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; chico?: boolean }

export function Boton({ variante = 'principal', chico = false, className = '', type = 'button', ...resto }: BotonProps) {
  const medida = chico ? 'min-h-10 px-3 text-sm' : 'min-h-12 w-full px-4 text-base'
  return (
    <button
      type={type}
      className={`${medida} rounded-xl font-semibold active:opacity-70 disabled:opacity-40 ${VARIANTES[variante]} ${className}`}
      {...resto}
    />
  )
}

const ENTRADA = 'min-h-12 w-full appearance-none rounded-xl border border-borde bg-tarjeta px-3 text-texto'

type TipoCampo = 'texto' | 'monto' | 'entero' | 'fecha' | 'tel' | 'buscar'

const ATRIBUTOS: Record<TipoCampo, { type: string; inputMode?: 'decimal' | 'numeric' | 'search' }> = {
  texto: { type: 'text' },
  monto: { type: 'text', inputMode: 'decimal' },
  entero: { type: 'text', inputMode: 'numeric' },
  fecha: { type: 'date' },
  tel: { type: 'tel' },
  buscar: { type: 'search', inputMode: 'search' },
}

type CampoProps = {
  etiqueta: string
  valor: string
  alCambiar: (valor: string) => void
  tipo?: TipoCampo
  ayuda?: string
  placeholder?: string
  autoFocus?: boolean
}

export function Campo({ etiqueta, valor, alCambiar, tipo = 'texto', ayuda, placeholder, autoFocus }: CampoProps) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-sm text-suave">{etiqueta}</span>
      <input
        {...ATRIBUTOS[tipo]}
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        className={ENTRADA}
      />
      {ayuda && <span className="mt-1 block text-xs text-suave">{ayuda}</span>}
    </label>
  )
}

type SelectorProps = {
  etiqueta: string
  valor: string
  alCambiar: (valor: string) => void
  opciones: readonly (readonly [valor: string, texto: string])[]
}

export function Selector({ etiqueta, valor, alCambiar, opciones }: SelectorProps) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-sm text-suave">{etiqueta}</span>
      <select value={valor} onChange={(e) => alCambiar(e.target.value)} className={ENTRADA}>
        {opciones.map(([v, texto]) => (
          <option key={v} value={v}>
            {texto}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Botones de opción en fila, para elegir entre dos o tres alternativas con un toque. */
export function Segmentos<T extends string>({
  valor,
  alCambiar,
  opciones,
}: {
  valor: T
  alCambiar: (valor: T) => void
  opciones: readonly (readonly [valor: T, texto: string])[]
}) {
  return (
    <div className="flex rounded-xl border border-borde bg-tarjeta p-1 print:hidden">
      {opciones.map(([v, texto]) => (
        <button
          key={v}
          type="button"
          aria-pressed={v === valor}
          onClick={() => alCambiar(v)}
          className={`min-h-10 flex-1 rounded-lg px-2 text-sm font-medium ${v === valor ? 'bg-primario text-sobre-primario' : 'text-suave'}`}
        >
          {texto}
        </button>
      ))}
    </div>
  )
}

export function Dos({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>
}

export function Tarjeta({
  children,
  alTocar,
  className = '',
}: {
  children: ReactNode
  alTocar?: () => void
  className?: string
}) {
  const estilo = `block w-full rounded-2xl border border-borde bg-tarjeta p-4 text-left ${className}`
  return alTocar ? (
    <button type="button" onClick={alTocar} className={`${estilo} active:opacity-70`}>
      {children}
    </button>
  ) : (
    <div className={estilo}>{children}</div>
  )
}

type Tono = 'bien' | 'mal' | 'suave' | 'normal'
const TONOS: Record<Tono, string> = { bien: 'text-bien', mal: 'text-mal', suave: 'text-suave', normal: '' }

/** Renglón "nombre ........ valor". */
export function Dato({ nombre, valor, tono = 'normal', detalle }: { nombre: string; valor: ReactNode; tono?: Tono; detalle?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-borde py-2.5 first:border-t-0 first:pt-0 last:pb-0">
      <span className="min-w-[35%] flex-1 text-suave">
        {nombre}
        {detalle && <span className="block text-xs">{detalle}</span>}
      </span>
      <span className={`max-w-[65%] break-words text-right font-semibold tabular-nums ${TONOS[tono]}`}>{valor}</span>
    </div>
  )
}

export function Seccion({ titulo, accion, children }: { titulo: string; accion?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="mt-2 flex min-h-10 items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-suave">{titulo}</h2>
        {accion}
      </div>
      {children}
    </section>
  )
}

export function Vacio({ titulo, texto, children }: { titulo: string; texto: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-borde p-6 text-center">
      <p className="font-semibold">{titulo}</p>
      <p className="text-sm text-suave">{texto}</p>
      {children}
    </div>
  )
}

const ETIQUETAS: Record<Tono, string> = {
  bien: 'bg-bien/10 text-bien',
  mal: 'bg-mal/10 text-mal',
  suave: 'bg-borde/60 text-suave',
  normal: 'bg-marca/40 text-texto',
}

export function Etiqueta({ tono = 'normal', children }: { tono?: Tono; children: ReactNode }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${ETIQUETAS[tono]}`}>{children}</span>
}
