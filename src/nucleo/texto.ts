/** Normaliza para buscar: sin tildes, sin mayúsculas y sin espacios, puntos, guiones ni barras. */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s.\-()+/]/g, '')
}

/** true si el texto contiene todas las palabras buscadas, en cualquier orden. */
export function coincide(texto: string, busqueda: string): boolean {
  const base = normalizar(texto)
  return busqueda
    .split(/\s+/)
    .filter(Boolean)
    .every((palabra) => base.includes(normalizar(palabra)))
}
