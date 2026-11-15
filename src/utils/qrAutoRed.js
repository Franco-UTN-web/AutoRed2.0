// Utilidades para reconocer los QR de AutoRed leídos por una pistola (lector que "teclea").
//
// El QR de una pieza contiene https://<sitio>/producto/<id>, donde <id> es un UUID.
// Una pistola en modo teclado puede escribir mal los símbolos (- / : .) si su distribución de
// teclado no coincide con la de la PC, pero las letras a-f y los números casi siempre llegan bien.
// Por eso el id se busca de forma tolerante a separadores cambiados o ausentes.

const UUID_ESTRICTO = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const UUID_TOLERANTE =
  /([0-9a-f]{8})[^0-9a-f]{0,3}([0-9a-f]{4})[^0-9a-f]{0,3}([0-9a-f]{4})[^0-9a-f]{0,3}([0-9a-f]{4})[^0-9a-f]{0,3}([0-9a-f]{12})/i;

/** Devuelve el id (UUID en minúsculas) de un texto leído, o null si no trae ninguno. */
export function extraerIdInventario(texto) {
  const t = String(texto || '');
  const estricto = t.match(UUID_ESTRICTO);
  if (estricto) return estricto[0].toLowerCase();
  const tolerante = t.match(UUID_TOLERANTE);
  if (tolerante) return tolerante.slice(1).join('-').toLowerCase();
  return null;
}

/** ¿El texto parece un enlace / QR de AutoRed (aunque no se haya podido leer el id)? */
export function pareceEnlaceAutoRed(texto) {
  return /https?|producto|vercel\.app|auto-?red/i.test(String(texto || ''));
}