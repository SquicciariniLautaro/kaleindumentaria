import { useLiveQuery } from 'dexie-react-hooks'
import { aCsv, borrarTodo, descargar, exportarBackup, leerCsv, nombreConFecha, restaurarBackup } from '../datos/backup'
import { armar, db, restaurar, tabla } from '../datos/db'
import { cargarEjemplo } from '../datos/ejemplo'
import { leerMonto } from '../nucleo/dinero'
import { normalizar } from '../nucleo/texto'
import { useAvisos } from '../ui/avisos'
import { Boton, Dato, Seccion, Tarjeta, Vacio } from '../ui/base'
import { Pagina } from '../ui/Pagina'

const fechaYHora = (iso: string): string => new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })

function ElegirArchivo({ texto, tipos, alElegir }: { texto: string; tipos: string; alElegir: (contenido: string) => void }) {
  return (
    <label className="grid min-h-12 w-full cursor-pointer place-items-center rounded-xl border border-borde bg-tarjeta px-4 text-center font-semibold">
      {texto}
      <input
        type="file"
        accept={tipos}
        className="sr-only"
        onChange={async (e) => {
          const archivo = e.target.files?.[0]
          e.target.value = ''
          if (archivo) alElegir(await archivo.text())
        }}
      />
    </label>
  )
}

/** Saca la fila de títulos si la primera celda dice "nombre". */
const sinTitulos = (filas: string[][]): string[][] => (normalizar(filas[0]?.[0] ?? '') === 'nombre' ? filas.slice(1) : filas)
const numero = (texto: string | undefined): number | null => {
  const n = Number((texto ?? '').replace(',', '.'))
  return texto?.trim() && Number.isFinite(n) ? n : null
}

async function importarProductos(csv: string): Promise<number> {
  const filas = sinTitulos(leerCsv(csv)).filter((f) => f[0])
  const productos = filas.map(([nombre = '', sku = '', margen, mayorista, minimo]) =>
    armar<'productos'>({
      nombre,
      sku,
      margenPct: numero(margen),
      margenMayoristaPct: numero(mayorista),
      stockMinimo: Math.max(0, Math.round(numero(minimo) ?? 0)),
      fotoId: null,
    }),
  )
  await tabla('productos').bulkAdd(productos)
  return productos.length
}

async function importarClientes(csv: string): Promise<number> {
  const filas = sinTitulos(leerCsv(csv)).filter((f) => f[0])
  const clientes = filas.map(([nombre = '', documento = '', telefono = '', direccion = '', limite = '', notas = '']) =>
    armar<'clientes'>({ nombre, documento, telefono, direccion, limiteCredito: leerMonto(limite) || null, notas }),
  )
  await tabla('clientes').bulkAdd(clientes)
  return clientes.length
}

export function Datos() {
  const { confirmar, avisar, intentar } = useAvisos()

  const exportar = () =>
    intentar(async () => {
      descargar(nombreConFecha('backup-gestion', 'json'), await exportarBackup(), 'application/json')
      avisar('Backup descargado')
    })

  const restaurarDesde = (contenido: string) =>
    intentar(async () => {
      const ok = await confirmar({
        titulo: '¿Restaurar este backup?',
        texto: 'Reemplaza TODO lo que hay cargado ahora en este equipo por el contenido del archivo.',
        aceptar: 'Restaurar',
        peligro: true,
      })
      if (!ok) return
      await restaurarBackup(contenido)
      avisar('Backup restaurado')
    })

  const vaciar = () =>
    intentar(async () => {
      const ok = await confirmar({
        titulo: '¿Borrar TODOS los datos?',
        texto: 'Se borra todo lo de este equipo, incluida la papelera. No se puede deshacer: descargá un backup antes.',
        aceptar: 'Borrar todo',
        peligro: true,
      })
      if (!ok) return
      await borrarTodo()
      avisar('Se borraron todos los datos')
    })

  return (
    <Pagina titulo="Datos y backup" atras>
      <Seccion titulo="Copia de seguridad">
        <p className="text-sm text-suave">
          Por ahora los datos viven solo en este equipo. Descargá un backup seguido y guardalo fuera del celular (mail, Drive).
        </p>
        <Boton onClick={() => void exportar()}>Descargar backup</Boton>
        <ElegirArchivo texto="Restaurar desde un backup" tipos="application/json,.json" alElegir={(c) => void restaurarDesde(c)} />
      </Seccion>

      <Seccion titulo="Importar desde Excel">
        <p className="text-sm text-suave">
          En Excel, guardá la hoja como «CSV». Productos: nombre, código, ganancia minorista %, ganancia mayorista %, stock mínimo.
          Clientes: nombre, documento, teléfono, dirección, límite de crédito, notas.
        </p>
        <ElegirArchivo
          texto="Importar productos (CSV)"
          tipos=".csv,text/csv"
          alElegir={(c) => void intentar(async () => avisar(`${await importarProductos(c)} productos importados`))}
        />
        <ElegirArchivo
          texto="Importar clientes (CSV)"
          tipos=".csv,text/csv"
          alElegir={(c) => void intentar(async () => avisar(`${await importarClientes(c)} clientes importados`))}
        />
        <Boton
          variante="texto"
          onClick={() =>
            descargar(
              'plantilla-productos.csv',
              aCsv([
                ['nombre', 'codigo', 'ganancia_minorista', 'ganancia_mayorista', 'stock_minimo'],
                ['Jean mujer', 'JEA-001', 30, 20, 12],
              ]),
              'text/csv;charset=utf-8',
            )
          }
        >
          Descargar plantilla de productos
        </Boton>
        <Boton
          variante="texto"
          onClick={() =>
            descargar(
              'plantilla-clientes.csv',
              aCsv([
                ['nombre', 'documento', 'telefono', 'direccion', 'limite_credito', 'notas'],
                ['María López', '30123456', '388 4123456', 'Av. Belgrano 123, Jujuy', 500000, ''],
              ]),
              'text/csv;charset=utf-8',
            )
          }
        >
          Descargar plantilla de clientes
        </Boton>
      </Seccion>

      <Seccion titulo="Pruebas">
        <Boton
          variante="secundario"
          onClick={() =>
            void intentar(async () => {
              await cargarEjemplo()
              avisar('Datos de ejemplo cargados')
            })
          }
        >
          Cargar datos de ejemplo
        </Boton>
        <Boton variante="secundario" className="text-mal" onClick={() => void vaciar()}>
          Borrar todos los datos
        </Boton>
      </Seccion>
    </Pagina>
  )
}

export function Papelera() {
  const { avisar, intentar } = useAvisos()
  const borrados = useLiveQuery(async () => (await db.cambios.orderBy('fecha').reverse().toArray()).filter((c) => c.accion === 'borrar' && !c.restaurado))

  return (
    <Pagina titulo="Papelera" atras>
      {borrados?.length === 0 && <Vacio titulo="La papelera está vacía" texto="Lo que borres queda acá y se puede restaurar." />}
      {borrados?.map((c) => (
        <Tarjeta key={c.id} className="flex items-center justify-between gap-2 py-3">
          <span className="min-w-0">
            {c.resumen}
            <span className="block text-sm text-suave">Borrado el {fechaYHora(c.fecha)}</span>
          </span>
          <Boton
            variante="secundario"
            chico
            onClick={() =>
              void intentar(async () => {
                if (c.marca) await restaurar(c.marca)
                avisar('Restaurado')
              })
            }
          >
            Restaurar
          </Boton>
        </Tarjeta>
      ))}
    </Pagina>
  )
}

const ACCIONES = { crear: 'Alta', editar: 'Cambio', borrar: 'Borrado' } as const

export function Historial() {
  const cambios = useLiveQuery(() => db.cambios.orderBy('fecha').reverse().limit(150).toArray())
  return (
    <Pagina titulo="Historial de cambios" atras>
      {cambios?.length === 0 && <Vacio titulo="Sin movimientos" texto="Acá queda anotado cada alta, cambio y borrado." />}
      {cambios && cambios.length > 0 && (
        <Tarjeta>
          {cambios.map((c) => (
            <Dato key={c.id} nombre={c.resumen} detalle={`${ACCIONES[c.accion]}${c.restaurado ? ' (restaurado)' : ''}`} valor={fechaYHora(c.fecha)} tono="suave" />
          ))}
        </Tarjeta>
      )}
    </Pagina>
  )
}
