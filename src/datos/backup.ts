import { fechaLocal } from '../nucleo/fecha'
import { db, TABLAS } from './db'

const TODAS = [...TABLAS, 'cambios', 'fotos'] as const

/** Copia completa de la base (incluye papelera, historial y fotos) como texto JSON. */
export async function exportarBackup(): Promise<string> {
  const tablas: Record<string, unknown[]> = {}
  for (const nombre of TODAS) tablas[nombre] = await db.table(nombre).toArray()
  return JSON.stringify({ app: 'gestion-comercial', version: 1, fecha: new Date().toISOString(), tablas })
}

/** Reemplaza TODO lo guardado por el contenido del backup. */
export async function restaurarBackup(texto: string): Promise<void> {
  let copia: { app?: unknown; version?: unknown; tablas?: Record<string, unknown> }
  try {
    copia = JSON.parse(texto)
  } catch {
    throw new Error('El archivo no es un backup válido')
  }
  if (copia.app !== 'gestion-comercial' || copia.version !== 1 || typeof copia.tablas !== 'object') {
    throw new Error('El archivo no es un backup de esta app')
  }
  const tablas = copia.tablas ?? {}
  await db.transaction('rw', db.tables, async () => {
    for (const nombre of TODAS) {
      const filas = tablas[nombre]
      await db.table(nombre).clear()
      if (Array.isArray(filas)) await db.table(nombre).bulkPut(filas)
    }
  })
}

export async function borrarTodo(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear()
  })
}

export function descargar(nombre: string, contenido: string, tipo: string): void {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  document.body.append(enlace)
  enlace.click()
  enlace.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export const nombreConFecha = (base: string, extension: string): string => `${base}-${fechaLocal()}.${extension}`

/** CSV que Excel en español abre bien: separado por punto y coma y con marca UTF-8. */
export function aCsv(filas: (string | number)[][]): string {
  const celda = (v: string | number) => {
    const t = String(v)
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  return '﻿' + filas.map((f) => f.map(celda).join(';')).join('\r\n')
}

/** Lee un CSV separado por punto y coma o por coma, con comillas opcionales. */
export function leerCsv(texto: string): string[][] {
  const limpio = texto.replace(/^﻿/, '')
  const primera = limpio.split(/\r?\n/, 1)[0] ?? ''
  const separador = primera.split(';').length >= primera.split(',').length ? ';' : ','
  const filas: string[][] = []
  let fila: string[] = []
  let celda = ''
  let entreComillas = false
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i]
    if (entreComillas) {
      if (c === '"' && limpio[i + 1] === '"') {
        celda += '"'
        i++
      } else if (c === '"') entreComillas = false
      else celda += c
    } else if (c === '"') entreComillas = true
    else if (c === separador) {
      fila.push(celda.trim())
      celda = ''
    } else if (c === '\n') {
      fila.push(celda.trim())
      filas.push(fila)
      fila = []
      celda = ''
    } else if (c !== '\r') celda += c
  }
  if (celda !== '' || fila.length > 0) {
    fila.push(celda.trim())
    filas.push(fila)
  }
  return filas.filter((f) => f.some((c) => c !== ''))
}

/** Achica una foto antes de guardarla para que no ocupe varios megas. */
export async function comprimirImagen(archivo: File, ladoMaximo = 1200, calidad = 0.75): Promise<string> {
  const imagen = await createImageBitmap(archivo)
  const escala = Math.min(1, ladoMaximo / Math.max(imagen.width, imagen.height))
  const lienzo = document.createElement('canvas')
  lienzo.width = Math.round(imagen.width * escala)
  lienzo.height = Math.round(imagen.height * escala)
  const contexto = lienzo.getContext('2d')
  if (!contexto) throw new Error('No se pudo procesar la foto')
  contexto.drawImage(imagen, 0, 0, lienzo.width, lienzo.height)
  return lienzo.toDataURL('image/jpeg', calidad)
}
