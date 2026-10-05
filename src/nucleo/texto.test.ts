import { describe, expect, it } from 'vitest'
import { leerCsv } from '../datos/backup'
import { formatearCotizacion, leerCotizacion, montoParaEditar } from './dinero'
import { diasEntre, inicioDeMes, sumarDias } from './fecha'
import { coincide, normalizar } from './texto'
import { describirCantidad, describirUnidades } from './unidades'

describe('búsqueda tolerante', () => {
  it('ignora tildes, mayúsculas, espacios, puntos y guiones', () => {
    expect(normalizar('San Martín 450')).toBe('sanmartin450')
    expect(coincide('María López 388 412-3456', '3884123456')).toBe(true)
    expect(coincide('María López', 'maria lopez')).toBe(true)
    expect(coincide('CUIT 27-28999111-4', '27289991114')).toBe(true)
    expect(coincide('guía VC-000-123', 'vc000123')).toBe(true)
  })

  it('encuentra fechas escritas con barras o guiones', () => {
    expect(coincide('2026-10-05 05/10/2026', '05/10')).toBe(true)
    expect(coincide('2026-10-05 05/10/2026', '05-10-2026')).toBe(true)
  })

  it('exige todas las palabras, en cualquier orden', () => {
    expect(coincide('Boutique Centro Tucumán', 'tucuman boutique')).toBe(true)
    expect(coincide('Boutique Centro Tucumán', 'boutique salta')).toBe(false)
  })

  it('una búsqueda vacía coincide con todo', () => {
    expect(coincide('lo que sea', '  ')).toBe(true)
  })
})

describe('fechas', () => {
  it('cuenta días corridos', () => {
    expect(diasEntre('2026-08-05', '2026-10-05')).toBe(61)
    expect(diasEntre('2026-10-05', '2026-10-05')).toBe(0)
  })

  it('suma y resta días cruzando meses y años', () => {
    expect(sumarDias('2026-10-05', -35)).toBe('2026-08-31')
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(inicioDeMes('2026-10-05')).toBe('2026-10-01')
  })
})

describe('cotizaciones y montos editables', () => {
  it('lee y muestra cotizaciones con decimales', () => {
    expect(leerCotizacion('200,5')).toBe(200_500_000)
    expect(leerCotizacion('1.400')).toBe(1_400_000_000)
    expect(leerCotizacion('204,081633')).toBe(204_081_633)
    expect(formatearCotizacion(200_500_000)).toBe('200,5')
    expect(formatearCotizacion(1_400_000_000)).toBe('1400')
    expect(leerCotizacion(formatearCotizacion(204_081_633))).toBe(204_081_633)
  })

  it('un monto precargado se vuelve a leer igual', () => {
    expect(montoParaEditar(123_450)).toBe('1234,50')
    expect(montoParaEditar(4_500_000)).toBe('45000')
  })
})

describe('unidades', () => {
  it('describe cantidades', () => {
    expect(describirUnidades(24)).toBe('24 u. (2 doc)')
    expect(describirUnidades(10)).toBe('10 u.')
    expect(describirCantidad(2, 'docena')).toBe('2 doc')
  })
})

describe('leerCsv', () => {
  it('lee punto y coma con marca UTF-8 y comillas', () => {
    expect(leerCsv('﻿nombre;codigo\r\n"Jean; mujer";JEA-001\r\n\r\n')).toEqual([
      ['nombre', 'codigo'],
      ['Jean; mujer', 'JEA-001'],
    ])
  })

  it('lee separado por comas', () => {
    expect(leerCsv('Ana,30123456,"Av. ""Belgrano"" 1"')).toEqual([['Ana', '30123456', 'Av. "Belgrano" 1']])
  })
})
