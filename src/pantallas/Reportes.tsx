import { useState } from 'react'
import { aCsv, descargar, nombreConFecha } from '../datos/backup'
import { resumirPeriodo, type FilaReporte } from '../datos/derivar'
import { useApp } from '../datos/useApp'
import { formatearPesos, type Centavos } from '../nucleo/dinero'
import { fechaLocal, fechaParaMostrar, inicioDeMes, sumarDias } from '../nucleo/fecha'
import { describirUnidades } from '../nucleo/unidades'
import { Boton, Campo, Dato, Dos, Seccion, Tarjeta } from '../ui/base'
import { Pagina } from '../ui/Pagina'

// En el CSV los montos van en pesos con coma decimal, que es como Excel en español los suma.
const enPesos = (centavos: Centavos): string => (centavos / 100).toFixed(2).replace('.', ',')

function Tabla({ filas, conUnidades = false }: { filas: FilaReporte[]; conUnidades?: boolean }) {
  if (filas.length === 0) return <p className="text-sm text-suave">Sin ventas en el período.</p>
  return (
    <Tarjeta>
      {filas.map((f) => (
        <Dato
          key={f.id}
          nombre={f.nombre}
          detalle={`${conUnidades ? `${describirUnidades(f.unidades)} · ` : ''}vendido ${formatearPesos(f.total)}`}
          valor={formatearPesos(f.ganancia)}
          tono={f.ganancia < 0 ? 'mal' : 'bien'}
        />
      ))}
    </Tarjeta>
  )
}

export function Reportes() {
  const { vista } = useApp()
  const hoy = fechaLocal()
  const [desde, setDesde] = useState(inicioDeMes(hoy))
  const [hasta, setHasta] = useState(hoy)
  const r = resumirPeriodo(vista, desde, hasta)
  const { antiguedad } = vista.totales
  const masRotan = [...r.porProducto].sort((a, b) => b.unidades - a.unidades).slice(0, 10)

  const mesPasado = () => {
    const fin = sumarDias(inicioDeMes(hoy), -1)
    setDesde(inicioDeMes(fin))
    setHasta(fin)
  }

  const exportarVentas = () =>
    descargar(
      nombreConFecha('ventas', 'csv'),
      aCsv([
        ['Fecha', 'Cliente', 'Producto', 'Cantidad', 'Unidad', 'Precio', 'Descuento', 'Total', 'Costo', 'Ganancia'],
        ...r.ventas.flatMap((v) =>
          v.items.map((i) => [
            fechaParaMostrar(v.venta.fecha),
            v.cliente?.nombre ?? 'Sin cliente',
            i.producto?.nombre ?? '',
            i.item.cantidad,
            i.item.unidadVenta,
            enPesos(i.item.precio),
            enPesos(i.item.descuento),
            enPesos(i.total),
            enPesos(i.costo),
            enPesos(i.ganancia),
          ]),
        ),
      ]),
      'text/csv;charset=utf-8',
    )

  const exportarDeudas = () =>
    descargar(
      nombreConFecha('deudas', 'csv'),
      aCsv([
        ['Cliente', 'Documento', 'Teléfono', 'Deuda', '0 a 30 días', '31 a 60 días', 'Más de 60 días', 'Saldo a favor'],
        ...vista.clientes.map((c) => [
          c.cliente.nombre,
          c.cliente.documento,
          c.cliente.telefono,
          enPesos(c.deuda),
          enPesos(c.antiguedad.hasta30),
          enPesos(c.antiguedad.hasta60),
          enPesos(c.antiguedad.masDe60),
          enPesos(c.saldoAFavor),
        ]),
      ]),
      'text/csv;charset=utf-8',
    )

  const exportarStock = () =>
    descargar(
      nombreConFecha('stock', 'csv'),
      aCsv([
        ['Producto', 'Código', 'Stock (unidades)', 'Stock a costo real', 'Precio minorista', 'Precio mayorista'],
        ...vista.productos.map((p) => [
          p.producto.nombre,
          p.producto.sku,
          p.stock,
          enPesos(p.valorStock),
          p.precios ? enPesos(p.precios.minorista.unidad) : '',
          p.precios ? enPesos(p.precios.mayorista.unidad) : '',
        ]),
      ]),
      'text/csv;charset=utf-8',
    )

  return (
    <Pagina titulo="Reportes" atras>
      <div className="flex flex-col gap-3 print:hidden">
        <Dos>
          <Campo etiqueta="Desde" tipo="fecha" valor={desde} alCambiar={setDesde} />
          <Campo etiqueta="Hasta" tipo="fecha" valor={hasta} alCambiar={setHasta} />
        </Dos>
        <div className="grid grid-cols-3 gap-2">
          <Boton variante="secundario" chico onClick={() => (setDesde(inicioDeMes(hoy)), setHasta(hoy))}>
            Este mes
          </Boton>
          <Boton variante="secundario" chico onClick={mesPasado}>
            Mes pasado
          </Boton>
          <Boton variante="secundario" chico onClick={() => (setDesde(''), setHasta(''))}>
            Todo
          </Boton>
        </div>
      </div>
      <p className="hidden text-sm print:block">
        Período: {desde ? fechaParaMostrar(desde) : 'inicio'} a {hasta ? fechaParaMostrar(hasta) : 'hoy'}
      </p>

      <Tarjeta>
        <Dato nombre="Ventas del período" valor={formatearPesos(r.total)} detalle={`${r.ventas.length} venta${r.ventas.length === 1 ? '' : 's'}`} />
        <Dato nombre="Ganancia real" valor={formatearPesos(r.ganancia)} tono={r.ganancia < 0 ? 'mal' : 'bien'} />
      </Tarjeta>

      <Seccion titulo="Ganancia por producto">
        <Tabla filas={r.porProducto} conUnidades />
      </Seccion>
      <Seccion titulo="Ganancia por cliente">
        <Tabla filas={r.porCliente} />
      </Seccion>
      <Seccion titulo="Productos que más rotan">
        {masRotan.length === 0 ? (
          <p className="text-sm text-suave">Sin ventas en el período.</p>
        ) : (
          <Tarjeta>
            {masRotan.map((f) => (
              <Dato key={f.id} nombre={f.nombre} valor={describirUnidades(f.unidades)} />
            ))}
          </Tarjeta>
        )}
      </Seccion>

      <Seccion titulo="Ganancia por viaje (todo lo vendido)">
        {vista.viajes.length === 0 ? (
          <p className="text-sm text-suave">Sin viajes.</p>
        ) : (
          <Tarjeta>
            {vista.viajes.map((v) => (
              <Dato
                key={v.viaje.id}
                nombre={v.viaje.destino}
                detalle={`${fechaParaMostrar(v.viaje.fecha)} · invertido ${formatearPesos(v.totalCompra + v.totalGastos)} · vendido ${formatearPesos(v.vendido)}`}
                valor={formatearPesos(v.ganancia)}
                tono={v.ganancia < 0 ? 'mal' : 'bien'}
              />
            ))}
          </Tarjeta>
        )}
      </Seccion>

      <Seccion titulo="Deuda total por antigüedad (hoy)">
        <Tarjeta>
          <Dato nombre="Total por cobrar" valor={formatearPesos(vista.totales.porCobrar)} />
          <Dato nombre="De 0 a 30 días" valor={formatearPesos(antiguedad.hasta30)} />
          <Dato nombre="De 31 a 60 días" valor={formatearPesos(antiguedad.hasta60)} tono={antiguedad.hasta60 > 0 ? 'mal' : 'normal'} />
          <Dato nombre="Más de 60 días" valor={formatearPesos(antiguedad.masDe60)} tono={antiguedad.masDe60 > 0 ? 'mal' : 'normal'} />
        </Tarjeta>
      </Seccion>

      <Seccion titulo="Exportar">
        <div className="flex flex-col gap-2 print:hidden">
          <Boton variante="secundario" onClick={exportarVentas}>
            Ventas del período (Excel / CSV)
          </Boton>
          <Boton variante="secundario" onClick={exportarDeudas}>
            Clientes y deudas (Excel / CSV)
          </Boton>
          <Boton variante="secundario" onClick={exportarStock}>
            Stock y precios (Excel / CSV)
          </Boton>
          <Boton variante="secundario" onClick={() => window.print()}>
            Imprimir o guardar como PDF
          </Boton>
        </div>
      </Seccion>
    </Pagina>
  )
}
