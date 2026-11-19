// Proxy a la función de Supabase: la sirve como text/html (Supabase la fuerza a text/plain).
// /?q=xiaomi buds pro → tabla HTML de precios; sin q → formulario de búsqueda.
const API = 'https://uxhftljmnljmtyynzyie.supabase.co/functions/v1/products';
const FORM = '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Precios en Paraguay</title></head><body><h1>Precios de productos en tiendas de Paraguay</h1><p>Usá <code>?q=PRODUCTO</code>, por ejemplo <a href="?q=xiaomi%20buds%20pro">?q=xiaomi buds pro</a>.</p><form><input name="q" placeholder="Producto"> <button>Buscar</button></form></body></html>';
export default {
  async fetch(req) {
    const q = new URL(req.url).searchParams.get('q');
    const html = { 'content-type': 'text/html; charset=utf-8', 'access-control-allow-origin': '*' };
    if (!q) return new Response(FORM, { headers: html });
    const r = await fetch(API + '?format=html&q=' + encodeURIComponent(q));
    return new Response(req.method === 'HEAD' ? null : await r.text(), { status: r.status, headers: { ...html, 'cache-control': 'public, max-age=3600' } });
  },
};
