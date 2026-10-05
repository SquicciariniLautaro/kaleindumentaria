import { useEffect } from 'react'
import { ProveedorDatos } from './datos/useApp'
import { Buscar } from './pantallas/Buscar'
import { ClienteDetalle, Clientes } from './pantallas/Clientes'
import { Comprobantes } from './pantallas/Comprobantes'
import { Configuracion } from './pantallas/Configuracion'
import { Datos, Historial, Papelera } from './pantallas/Datos'
import { Envios } from './pantallas/Envios'
import { Inicio } from './pantallas/Inicio'
import { Mas } from './pantallas/Mas'
import { Reportes } from './pantallas/Reportes'
import { ProductoDetalle, Stock } from './pantallas/Stock'
import { VentaDetalle, VentaNueva, Ventas } from './pantallas/Ventas'
import { ViajeDetalle, Viajes } from './pantallas/Viajes'
import { useRuta, type Ruta } from './ruta'
import { Actualizacion } from './ui/Actualizacion'
import { ProveedorAvisos } from './ui/avisos'
import { Navegacion } from './ui/Pagina'

function Pantalla({ pantalla, id }: Ruta) {
  switch (pantalla) {
    case 'ventas':
      return <Ventas />
    case 'venta-nueva':
      return <VentaNueva clienteInicial={id} />
    case 'venta':
      return <VentaDetalle id={id} />
    case 'clientes':
      return <Clientes />
    case 'cliente':
      return <ClienteDetalle id={id} />
    case 'stock':
      return <Stock />
    case 'producto':
      return <ProductoDetalle id={id} />
    case 'viajes':
      return <Viajes />
    case 'viaje':
      return <ViajeDetalle id={id} />
    case 'envios':
      return <Envios />
    case 'comprobantes':
      return <Comprobantes />
    case 'reportes':
      return <Reportes />
    case 'config':
      return <Configuracion />
    case 'datos':
      return <Datos />
    case 'papelera':
      return <Papelera />
    case 'historial':
      return <Historial />
    case 'buscar':
      return <Buscar />
    case 'mas':
      return <Mas />
    default:
      return <Inicio />
  }
}

export function App() {
  const ruta = useRuta()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [ruta.pantalla, ruta.id])

  return (
    <ProveedorAvisos>
      <Actualizacion />
      <ProveedorDatos>
        <div className="mx-auto min-h-dvh max-w-xl">
          {/* La clave reinicia el estado de la pantalla al cambiar de registro. */}
          <Pantalla key={`${ruta.pantalla}/${ruta.id ?? ''}`} {...ruta} />
        </div>
        <Navegacion pantalla={ruta.pantalla} />
      </ProveedorDatos>
    </ProveedorAvisos>
  )
}
