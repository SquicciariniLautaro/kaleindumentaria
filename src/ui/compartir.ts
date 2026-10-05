/** Abre el menú de compartir del celular; si no existe, abre WhatsApp con el texto listo. */
export async function compartir(texto: string): Promise<void> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text: texto })
      return
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener')
}
