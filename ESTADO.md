# ESTADO del proyecto — Kale Indumentaria · Gestión (PWA)

Última actualización: 2026-10-05

## Dónde estamos

- **Primer modelo completo y probado en la PC**: todas las pantallas funcionan con base de datos local (IndexedDB). Espera que el usuario y su cliente lo prueben.
- **No hecho todavía**: login, nube y sincronización (Supabase), PIN, publicación en Hostinger. Los tres primeros dependen de que exista un proyecto de Supabase, que tiene que crear el usuario o su cliente.
- Próximo paso: recibir comentarios de la prueba; después, crear el proyecto de Supabase y hacer login + sincronización; por último publicar en Hostinger.

## Cómo probarlo

- `npm run dev` y abrir `http://localhost:5173` (o `npm run build` + `npm run preview` en el puerto 4173, que incluye el modo sin conexión).
- En Inicio, «Cargar datos de ejemplo». Para empezar de cero: Más → Datos y backup → Borrar todos los datos.
- `npm run verificar`: tipos + 85 tests.

## Contexto del negocio

El usuario (desarrollador, no técnico) arma el sistema para su cliente, **Kale Indumentaria**: importa mercadería desde Bolivia (viajes a la frontera desde Jujuy), compra en BOB o USD, vende en ARS a todo el país por unidad y por docena, al contado y fiado. Usa iPhone con una mano y pierde señal. Dos usuarios: el desarrollador (pruebas) y el cliente.

## Entorno verificado (2026-10-05)

Windows 10, Node 24.11.1, npm 11.6.2. Versiones exactas fijadas en `package.json` y comprobadas con `npm view`:
vite 8.3.2 · vite-plugin-pwa 2.0.0 · @vitejs/plugin-react 6.1.2 · react 19.3.0 · tailwindcss 4.3.3 · dexie 4.4.6 · dexie-react-hooks 4.4.0 · vitest 5.0.3 · typescript 7.0.2.

- Sin ESLint: typescript-eslint 8.71 solo acepta TS < 6.1.
- `xlsx` (SheetJS) está abandonado en npm (0.18.5): no usar. Por eso la importación es por CSV.
- Supabase Free (supabase.com/pricing): 500 MB de base, 1 GB de archivos, 2 proyectos, **se pausa tras 1 semana sin actividad, sin backups**. Pro desde USD 25/mes.

## Estructura del código

- `src/nucleo/`: cálculo puro con tests (fracciones exactas, dinero, costos, precios, ventas FIFO, cuenta corriente, fechas, texto).
- `src/datos/`: `tipos.ts` (tablas), `db.ts` (Dexie: crear, editar, borrar a papelera, restaurar, historial), `derivar.ts` (calcula todo lo que muestran las pantallas; con tests), `acciones.ts` (venta, mermas, borrados con reglas), `backup.ts` (JSON, CSV, fotos), `ejemplo.ts`, `useApp.tsx`.
- `src/ui/`: botones, campos, diálogo y hoja de formulario, avisos con Deshacer, página y navegación.
- `src/pantallas/`: Inicio, Ventas, Clientes, Stock, Viajes, Envíos, Comprobantes, Reportes, Configuración, Datos (backup, papelera, historial), Más, Buscar.
- `src/ruta.ts`: navegación por `#/pantalla/id` (sin librería).

## Qué hace el primer modelo

- **Inicio**: ganancia real, por cobrar, cobrado, stock a costo; alertas (cotización, stock bajo, envíos, comprobantes).
- **Viajes**: cotización realmente pagada (o calculada desde «cambié X por Y»), gastos en varias monedas con gastos habituales, mercadería por unidad o docena, reparto por unidad / valor / peso, cierre y reapertura, rentabilidad por viaje.
- **Stock**: catálogo con código, foto, stock mínimo con alerta, precios minorista y mayorista por unidad y docena, mermas y ajustes con motivo.
- **Ventas**: varias líneas, descuento por línea, lista minorista/mayorista, contado / parte / fiado, aviso de límite de crédito, comprobante para compartir, historial de cambios, envío.
- **Clientes**: cuenta corriente, antigüedad 0-30 / 31-60 / +60, límite de crédito, cobros a la deuda más antigua o a una venta, saldo a favor, estado de cuenta para compartir o imprimir.
- **Envíos**: transportista, provincia, localidad, guía, costo, quién paga, estado; si paga el negocio se descuenta de la ganancia.
- **Comprobantes de transferencia** (pedido nuevo): monto, banco, n.º de operación, foto, verificado sí/no, «registrar como cobro».
- **Reportes**: por período, ganancia por producto / cliente / viaje, más rotan, deuda por antigüedad, exportación CSV y PDF por impresión.
- **Buscar**: clientes, productos, envíos, ventas y comprobantes; ignora tildes, espacios y guiones.
- **Datos**: backup y restauración JSON, importación CSV de productos y clientes, papelera con restaurar, historial.
- Modo oscuro, colores del logo (dorado `#fbd785`, rojo `#c83023`), diálogos propios (nunca `alert`/`confirm`).

## Verificado en el navegador (2026-10-05, 375 px de ancho)

Carga de ejemplo; venta fiada con precio mayorista por docena; bloqueo por stock insuficiente; cobro parcial aplicado a la deuda más antigua; borrar venta + Deshacer; comprobante → cobro; merma; búsqueda por teléfono sin espacios, guía sin guiones y fecha; backup → borrar todo → restaurar idéntico; todas las pantallas sin errores de consola. Números contrastados a mano.

**No verificado**: en un iPhone real; fotos (cámara); compartir por WhatsApp; impresión a PDF; importación CSV desde un Excel real; archivo de backup descargado en iOS.

## Reglas y convenciones fijadas

- Dinero: enteros en centavos; cálculo intermedio exacto con `Fraccion`; redondeo comercial (la mitad se aleja de cero).
- Cotización: millonésimas de peso por unidad (200,50 → 200_500_000). «Hoy» = última cargada del tipo elegido en Configuración; si falta, la reposición usa la del viaje.
- Costo histórico = origen × cotización del viaje + gasto prorrateado. Reposición = igual con la cotización de hoy (gastos en ARS quedan igual).
- Precio sugerido = costo de reposición **del último viaje en que se compró** × (1 + margen), redondeado al múltiplo elegido (100, 50, 25 o 20), nunca cero.
- Venta: precio fijo al registrarla; guarda de qué lotes salió cada unidad (primero lo más viejo). Las líneas no se editan: se borra y se recarga.
- Ganancia: costo e ingreso se reparten por lote en centavos enteros, así ganancia por venta y por viaje suman igual.
- Cobros: primero los dirigidos a una venta; el resto a la deuda más antigua; lo que sobra es saldo a favor. Estado de la venta calculado, nunca guardado.
- Venta sin cliente = contado, se cobra entera.
- Borrado lógico: todo lo que se borra junto comparte una marca y se restaura junto. No se puede borrar un viaje, compra, producto o cliente con movimientos.
- Borrar una venta borra sus líneas, su envío y los cobros dirigidos a ella; los cobros «a la deuda más antigua» quedan.
- Envío pagado por el cliente: no afecta ganancia ni deuda.

## Decisiones tomadas (2026-10-05)

- iPhone, como app web; por ahora **desde el navegador**, sin instalar, hasta que el cliente decida.
- Dos usuarios; en la nube se modelará con `negocios` + `miembros` (permisos por negocio).
- FIFO automático; cotización realmente pagada; saldo a favor permitido; Supabase Free con backup propio.
- Pesos enteros en pantalla; múltiplo de redondeo elegible.
- Hosting: **Hostinger, en la cuenta del cliente**. Se sube el contenido de `dist/`. Verificar al publicar: HTTPS activo y que `manifest.webmanifest` y `sw.js` se sirvan bien.
- No hay datos reales en el prototipo: sin importador del prototipo.
- Comprobantes y Viajes están dentro de «Más» y con acceso directo en Inicio (la barra inferior tiene 5 lugares: Inicio, Ventas, Clientes, Stock, Más).

## Pendiente

1. **Supabase** (bloqueado hasta que exista el proyecto): esquema SQL, login, permisos por negocio, sincronización con cola visible y resolución de conflictos. Las tablas ya tienen `id` UUID, `actualizadoEn` y `borradoEn` pensando en eso.
2. PIN de bloqueo opcional.
3. Importar `.xlsx` directo (hoy es CSV) y exportar PDF con formato propio (hoy es la impresión del navegador).
4. Publicación en Hostinger y prueba en iPhone real.
5. Riesgo abierto: Safari puede borrar datos locales de un sitio no instalado si pasa un tiempo sin abrirse. Hasta que haya sincronización, la protección es descargar el backup.

## Convenciones de trabajo

- Responder en español, simple, y verificar antes de afirmar.
- Nunca `alert()` ni `confirm()`.
- No implementar nada fuera de la lista de mejoras sin consultar.
- Prototipo original de referencia: `prototipo/gestion-comercial.html`.
