// Buscador de productos: consulta varias tiendas en paralelo y cachea 6 h en public.products_cache.
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-expose-headers': '*' };
const BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36';
const TTL = 6 * 3600 * 1000;
const SB = Deno.env.get('SUPABASE_URL')! + '/rest/v1/products_cache';
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const H = { apikey: KEY, authorization: 'Bearer ' + KEY, 'content-type': 'application/json' };

type P = { shop: string; name: string; price: number; old?: number; off?: number; img: string; url: string };

const ent = (s: string) => s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16))).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const gs = (s: string) => Math.round(+s.replace(/[^\d]/g, '')) || 0;
const done = (shop: string, name: string, price: number, old: number, img: string, url: string): P | null => {
  if (!name || !price || !url) return null;
  const p: P = { shop, name, price, img, url };
  if (old > price) { p.old = old; p.off = Math.round((1 - price / old) * 100); }
  return p;
};
const html = async (url: string, ua = BROWSER) => {
  const r = await fetch(url, { headers: { 'user-agent': ua, 'accept-language': 'es-PY,es;q=0.9' }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(String(r.status));
  return r.text();
};

// Contimarket envía una cabecera que el cliente de fetch rechaza: HTTP/1.0 a mano sobre TLS.
async function rawGet(host: string, path: string): Promise<string> {
  const ctl = AbortSignal.timeout(8000);
  const conn = await Deno.connectTls({ hostname: host, port: 443 });
  ctl.addEventListener('abort', () => { try { conn.close(); } catch { /* ya cerrada */ } });
  await conn.write(new TextEncoder().encode(`GET ${path} HTTP/1.0\r\nHost: ${host}\r\nUser-Agent: ${BROWSER}\r\nAccept: text/html\r\nAccept-Encoding: identity\r\nConnection: close\r\n\r\n`));
  const chunks: Uint8Array[] = [];
  const buf = new Uint8Array(65536);
  try { for (let n = await conn.read(buf); n; n = await conn.read(buf)) chunks.push(buf.slice(0, n)); } catch { /* cierre sin close_notify */ }
  try { conn.close(); } catch { /* ya cerrada */ }
  const all = new Uint8Array(chunks.reduce((a, c) => a + c.length, 0));
  let o = 0; for (const c of chunks) { all.set(c, o); o += c.length; }
  const txt = new TextDecoder().decode(all);
  const i = txt.indexOf('\r\n\r\n');
  if (!/^HTTP\/1\.[01] 200/.test(txt)) throw new Error('raw ' + txt.slice(0, 20));
  return txt.slice(i + 4);
}

function jsonObjectsAround(b: string, marker: string): unknown[] {
  const out: unknown[] = [];
  let from = 0;
  for (;;) {
    const i = b.indexOf(marker, from);
    if (i < 0) break;
    let d = 0, st = -1, ins = false;
    // el objeto del producto empieza en la llave que abre antes del marcador (a profundidad 0)
    for (let k = i; k >= 0; k--) { const c = b[k]; if (c === '}') d++; else if (c === '{') { if (!d) { st = k; break; } d--; } }
    if (st < 0) break;
    let dd = 0, en = -1;
    for (let k = st; k < b.length; k++) {
      const c = b[k];
      if (ins) { if (c === '\\') k++; else if (c === '"') ins = false; }
      else if (c === '"') ins = true;
      else if (c === '{') dd++;
      else if (c === '}') { dd--; if (!dd) { en = k; break; } }
    }
    if (en < 0) break;
    try { out.push(JSON.parse(b.slice(st, en + 1))); } catch { /* objeto incompleto */ }
    from = en + 1;
  }
  return out;
}

async function contimarket(q: string): Promise<P[]> {
  const path = '/search?Box=False&q=' + encodeURIComponent(q);
  const b = await html('https://www.contimarket.com' + path).catch(() => rawGet('www.contimarket.com', path));
  // deno-lint-ignore no-explicit-any
  return (jsonObjectsAround(b, '"ProductPrice"') as any[]).map(o => done('Contimarket', ent(o.Name || ''), Math.round(o.ProductPrice?.PriceValue || 0), Math.round(o.ProductPrice?.OldPriceValue || 0), o.DefaultPictureModel?.ImageUrl || '', o.Url || '')).filter(Boolean) as P[];
}

async function magento(shop: string, url: string, base = ''): Promise<P[]> {
  const b = await html(url);
  return b.split(/<li class="item product product-item/).slice(1).map(blk => {
    const link = blk.match(/class="product-item-link"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/) || blk.match(/href="([^"]+)"[^>]*class="product-item-link"[^>]*>([\s\S]*?)<\/a>/);
    const price = blk.match(/data-price-amount="([\d.]+)"[^>]*data-price-type="finalPrice"/);
    const old = blk.match(/data-price-amount="([\d.]+)"[^>]*data-price-type="oldPrice"/);
    const img = blk.match(/<img[^>]*src="(https?:[^"]+)"/);
    return link && price ? done(shop, ent(link[2]), gs(price[1].split('.')[0]), old ? gs(old[1].split('.')[0]) : 0, base + (img?.[1] || ''), link[1]) : null;
  }).filter(Boolean) as P[];
}
const naranja = (q: string) => magento('Tienda Naranja', 'https://tiendanaranja.com.py/catalogsearch/result/?q=' + encodeURIComponent(q));
const nissei = (q: string) => magento('Nissei', 'https://nissei.com/py/catalogsearch/result/?q=' + encodeURIComponent(q));


const pageLinks = (page: string, accept: (url: URL) => boolean, base: string): string[] => {
  const urls = new Set<string>();
  const host = new URL(base).hostname.replace(/^www\./, '');
  for (const match of page.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    try {
      const url = new URL(match[1].replace(/&amp;/g, '&'), base);
      if (url.protocol === 'https:' && url.hostname.replace(/^www\./, '') === host && accept(url)) urls.add(url.href);
    } catch { /* enlace inválido */ }
  }
  return [...urls];
};

function bristolProduct(page: string, fallbackUrl: string): P | null {
  const records = jsonObjectsAround(page, '"precioMonto"') as any[];
  for (const record of records) {
    const variant = record.variante || {};
    const name = record.nombre || record.nombreCompleto || variant.nombreCompleto || variant.nombre || record.producto?.nombre || '';
    const price = Number(record.precioMonto || 0);
    const old = Number(record.precioAnteriorMonto || record.precioListaMonto || 0);
    const rawImage = variant.img?.u || record.img || '';
    const image = rawImage.startsWith('//') ? 'https:' + rawImage : rawImage ? new URL(rawImage, 'https://www.bristol.com.py').href : '';
    const url = variant.url || fallbackUrl;
    const product = done('Bristol', ent(String(name)), price, old, image, url);
    if (product) return product;
  }
  return null;
}

async function bristol(q: string): Promise<P[]> {
  const origin = 'https://www.bristol.com.py';
  const searchUrl = origin + '/catalogo?q=' + encodeURIComponent(q);
  const page = await html(searchUrl);
  const fromListing = (jsonObjectsAround(page, '"precioMonto"') as any[])
    .map(record => bristolProduct(JSON.stringify(record), searchUrl))
    .filter(Boolean) as P[];
  if (fromListing.length) return [...new Map(fromListing.map(p => [p.url, p])).values()];

  const urls = pageLinks(page, url => url.pathname.startsWith('/catalogo/') && url.pathname.split('/').pop()!.includes('_'), origin).slice(0, 12);
  const details = await Promise.allSettled(urls.map(async url => bristolProduct(await html(url), url)));
  const products: P[] = [];
  for (const result of details) if (result.status === 'fulfilled' && result.value) products.push(result.value);
  return [...new Map(products.map(p => [p.url, p])).values()];
}


function tupiProducts(fragment: string): P[] {
  return fragment.split(/<div class="product_unit\b/).slice(1).map(block => {
    const url = block.match(/href=["'](https?:\/\/www\.tupi\.com\.py\/producto\/[^"']+)["']/i)?.[1]?.trim() || '';
    const title = block.match(/<a\b(?=[^>]*href=["'][^"']*\/producto\/)(?=[^>]*rel=["']tag["'])[^>]*>([\s\S]*?)<\/a>/i)?.[1] || '';
    const imagePath = block.match(/data-echo=["']([^"']+)["']/i)?.[1] ||
      block.match(/<img[^>]*class=["'][^"']*wp-post-image[^"']*["'][^>]*src=["']([^"']+)/i)?.[1] || '';
    const image = imagePath ? new URL(imagePath, 'https://www.tupi.com.py').href : '';
    const priceBlock = block.match(/<a\b[^>]*class=["'][^"']*add_to_cart_button_contado[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)?.[1] || '';
    const prices = [...ent(priceBlock).matchAll(/Gs\.?\s*([\d.]+)/gi)].map(match => gs(match[1]));
    const price = prices.at(-1) || 0;
    const old = prices.length > 1 ? prices[0] : 0;
    return done('Tupi', ent(title).replace(/\s+ver detalles\s*$/i, ''), price, old, image, url);
  }).filter(Boolean) as P[];
}

async function tupi(q: string): Promise<P[]> {
  const origin = 'https://www.tupi.com.py';
  const response = await fetch(origin + '/buscar_paginacion_p_group.php?query=' + encodeURIComponent(q), {
    headers: {
      'user-agent': BROWSER,
      'accept-language': 'es-PY,es;q=0.9',
      'accept': 'application/json, text/javascript, */*; q=0.01',
      'x-requested-with': 'XMLHttpRequest',
      'referer': origin + '/buscar?productos=' + encodeURIComponent(q),
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Tupi ' + response.status);
  const data = await response.json();
  const products = tupiProducts(typeof data.response === 'string' ? data.response : '');
  if (!products.length) throw new Error('Tupi pagination returned no product cards');
  return [...new Map(products.map(product => [product.url, product])).values()];
}

async function tecnoga(q: string): Promise<P[]> {
  const b = await html('https://tecnoga.com.py/?s=' + encodeURIComponent(q) + '&post_type=product', 'curl/8.5.0');
  return b.split('<div class="wd-product wd-col').slice(1).map(blk => {
    const link = blk.match(/<h3 class="wd-entities-title"><a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/) || blk.match(/href="(https:\/\/tecnoga\.com\.py\/producto\/[^"]+)"[^>]*aria-label="([^"]+)"/);
    const img = blk.match(/<img[^>]*\ssrc="(https?:[^"]+)"/);
    const ins = blk.match(/<ins[^>]*>([\s\S]*?)<\/ins>/), del = blk.match(/<del[^>]*>([\s\S]*?)<\/del>/);
    const amounts = (s: string) => [...s.matchAll(/woocommerce-Price-amount[^>]*>[\s\S]*?<\/bdi>/g)].map(m => gs(ent(m[0])));
    const cur = amounts(ins ? ins[1] : blk)[0] || 0, old = del ? amounts(del[1])[0] || 0 : 0;
    return link ? done('Tecnoga', ent(link[2]), cur, old, img?.[1] || '', link[1]) : null;
  }).filter(Boolean) as P[];
}

// Cellshop: Adobe Live Search (los resultados se cargan por JS); precios en USD, se pasan a ₲ con la tasa de la tienda.
const CELL_RATE = 6200;
async function cellshop(q: string): Promise<P[]> {
  const query = `query($q:String!){productSearch(phrase:$q,page_size:40){items{productView{name url images{url} ...on SimpleProductView{price{final{amount{value currency}} regular{amount{value currency}}}} ...on ComplexProductView{priceRange{minimum{final{amount{value currency}} regular{amount{value currency}}}}}}}}}`;
  const r = await fetch('https://catalog-service.adobe.io/graphql', {
    method: 'POST', signal: AbortSignal.timeout(8000),
    headers: { 'content-type': 'application/json', 'x-api-key': 'search_gql', 'magento-environment-id': '21697142-5836-4c79-ae7e-765455f375aa', 'magento-website-code': 'base', 'magento-store-code': 'base', 'magento-store-view-code': 'default', 'magento-customer-group': 'b6589fc6ab0dc82cf12099d1c2d40ab994e8410c' },
    body: JSON.stringify({ query, variables: { q } }),
  });
  if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 120));
  const d = await r.json();
  if (d.errors) throw new Error(d.errors[0]?.message?.slice(0, 60));
  const gsOf = (a?: { value: number; currency: string }) => !a ? 0 : Math.round(a.currency === 'PYG' ? a.value : a.value * CELL_RATE);
  // deno-lint-ignore no-explicit-any
  return (d.data?.productSearch?.items || []).map((it: any) => {
    const v = it.productView || {}, pr = v.price || v.priceRange?.minimum || {};
    const img = v.images?.[0]?.url || '';
    return done('Cellshop', ent(v.name || ''), gsOf(pr.final?.amount), gsOf(pr.regular?.amount), img.startsWith('//') ? 'https:' + img : img, v.url || '');
  }).filter(Boolean) as P[];
}

// WooCommerce genérico: título del producto en un <a>, precio en woocommerce-Price-amount (<ins>/<del> si hay oferta)
const wooAmounts = (s: string) => [...s.matchAll(/woocommerce-Price-amount[^>]*>[\s\S]*?<\/bdi>/g)].map(m => gs(ent(m[0])));
async function wilmar(q: string): Promise<P[]> {
  const b = await html('https://wilmarcenter.com.py/?s=' + encodeURIComponent(q) + '&post_type=product');
  return b.split('<div class="etheme-product-grid-image">').slice(1).map(blk => {
    const link = blk.match(/etheme-product-grid-title"><a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    const img = blk.match(/<img[^>]*\ssrc="(https?:[^"]+)"/);
    const ins = blk.match(/<ins[^>]*>([\s\S]*?)<\/ins>/), del = blk.match(/<del[^>]*>([\s\S]*?)<\/del>/);
    return link ? done('Wilmar', ent(link[2]), wooAmounts(ins ? ins[1] : blk)[0] || 0, del ? wooAmounts(del[1])[0] || 0 : 0, img?.[1] || '', link[1]) : null;
  }).filter(Boolean) as P[];
}

async function mega(q: string): Promise<P[]> {
  const b = await html('https://megaelectronicos.com.py/producto/buscar/?search=' + encodeURIComponent(q), 'curl/8.5.0');
  return b.split(/<a href="(?=https:\/\/megaelectronicos\.com\.py\/producto\/\d)/).slice(1).map(blk => {
    if (!/^[^"]+" class="p-card/.test(blk)) return null;
    const url = blk.slice(0, blk.indexOf('"'));
    const name = blk.match(/class="p-title[^"]*"[^>]*>([\s\S]*?)<\/h3>/);
    const img = blk.match(/<img[^>]*\ssrc="(https?:[^"]+)"/);
    const prices = [...blk.split('</a>')[0].matchAll(/Gs\.\s*([\d.]+)/g)].map(m => gs(m[1]));
    const cur = Math.min(...prices), old = Math.max(...prices);
    return name && prices.length ? done('Mega', ent(name[1]), cur, old, img?.[1] || '', url) : null;
  }).filter(Boolean) as P[];
}

async function hogar(q: string): Promise<P[]> {
  const O = 'https://www.hogarfeliz.com.py/';
  const b = await html(O + 'productos?q=' + encodeURIComponent(q) + '&orderby=price');
  return b.split('<div class="product">').slice(1).map(blk => {
    const link = blk.match(/<a title="[^"]*" href="([^"]+)"/);
    const name = blk.match(/woocommerce-loop-product__title">([\s\S]*?)<\/h2>/);
    const img = blk.match(/data-src="([^"]+)"/);
    const price = blk.match(/<span class="price">([\s\S]*?)<\/span>\s*<!--/)?.[1] || '';
    const ins = gs(ent(price.match(/<ins>([\s\S]*?)<\/ins>/)?.[1] || ''));
    const rest = [...price.replace(/<ins>[\s\S]*?<\/ins>/, '').matchAll(/class="amount">([^<]+)</g)].map(m => gs(m[1]));
    const cur = ins || rest[0] || 0, old = ins ? rest[0] || 0 : 0;
    return link && name ? done('Hogar Feliz', ent(name[1]), cur, old, img ? (img[1].startsWith('http') ? img[1] : O + img[1]) : '', link[1].startsWith('http') ? link[1] : O + link[1]) : null;
  }).filter(Boolean) as P[];
}

async function porter(q: string): Promise<P[]> {
  const b = await html('https://porter.com.py/index.php?route=product/search&search=' + encodeURIComponent(q), 'curl/8.5.0');
  return b.split('<div class="product-thumb">').slice(1).map(blk => {
    const link = blk.match(/<div class="name"><a href="([^"]+)">([\s\S]*?)<\/a>/);
    const img = blk.match(/<img[^>]*\s(?:data-src|src)="(https?:[^"]+)"/);
    const cur = blk.match(/class="price-(?:new|normal)">([^<]+)</), old = blk.match(/class="price-old">([^<]+)</);
    return link && cur ? done('Porter', ent(link[2]), gs(cur[1]), old ? gs(old[1]) : 0, img?.[1] || '', link[1].replace(/[?&]search=[^&]*/, '')) : null;
  }).filter(Boolean) as P[];
}

const SHOPS: [string, (q: string) => Promise<P[]>][] = [['Contimarket', contimarket], ['Tienda Naranja', naranja], ['Tecnoga', tecnoga], ['Nissei', nissei], ['Cellshop', cellshop], ['Wilmar', wilmar], ['Mega', mega], ['Hogar Feliz', hogar], ['Porter', porter], ['Tupi', tupi], ['Bristol', bristol]];

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const fmt = (n: number) => '₲ ' + n.toLocaleString('es-PY');
const table = (q: string, d: P[]) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Precios de ${esc(q)} en Paraguay</title></head><body><h1>Precios de «${esc(q)}» en tiendas de Paraguay</h1><p>${d.length} resultados, de menor a mayor precio, en guaraníes.</p>${d.length ? `<table><thead><tr><th>Producto</th><th>Tienda</th><th>Precio</th><th>Antes</th><th>Descuento</th><th>Enlace</th></tr></thead><tbody>${d.map(p => `<tr><td>${esc(p.name)}</td><td>${esc(p.shop)}</td><td>${fmt(p.price)}</td><td>${p.old ? fmt(p.old) : ''}</td><td>${p.off ? p.off + '%' : ''}</td><td><a href="${esc(p.url)}">${esc(p.url)}</a></td></tr>`).join('')}</tbody></table>` : '<p>Ninguna tienda tiene este producto.</p>'}</body></html>`;

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim().toLowerCase().slice(0, 80);
  const json = (d: unknown, extra: Record<string, string> = {}) => new Response(JSON.stringify(d), { headers: { ...CORS, 'content-type': 'application/json', ...extra } });
  if (!q) return json([]);
  const key = q.replace(/\s+/g, ' ');
  // ?debug=1: sin caché, devuelve cuántos trajo cada tienda y los errores
  if (url.searchParams.has('debug')) {
    const res = await Promise.allSettled(SHOPS.map(([, f]) => f(key)));
    return json(Object.fromEntries(res.map((r, i) => [SHOPS[i][0], r.status === 'fulfilled' ? { n: r.value.length, first: r.value[0] } : { error: String(r.reason?.message) }])));
  }
  // &format=html: tabla HTML simple para lectores que no aceptan JSON
  const out = url.searchParams.get('format') === 'html' ? (d: P[], extra: Record<string, string> = {}) => new Response(table(q, d), { headers: { ...CORS, 'content-type': 'text/html; charset=utf-8', ...extra } }) : json;
  const forceRefresh = url.searchParams.get('refresh') === '1';
  if (!forceRefresh) {
    try {
      const r = await fetch(`${SB}?key=eq.${encodeURIComponent(key)}&select=data,at`, { headers: H });
      const row = (await r.json())?.[0];
      if (row && Date.now() - new Date(row.at).getTime() < TTL) return out(row.data, { 'x-cache': 'hit' });
    } catch { /* sin caché */ }
  }
  const res = await Promise.allSettled(SHOPS.map(([, f]) => f(key)));
  const errs: string[] = [];
  const all: P[] = [];
  res.forEach((r, i) => { if (r.status === 'fulfilled') all.push(...r.value); else errs.push(SHOPS[i][0] + ':' + r.reason?.message); });
  all.sort((a, b) => a.price - b.price);
  const counts = Object.fromEntries(SHOPS.map(([n]) => [n, all.filter(p => p.shop === n).length]));
  if (all.length) {
    await fetch(SB, { method: 'POST', headers: { ...H, prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ key, data: all, at: new Date().toISOString() }) }).catch(() => {});
  }
  return out(all, { 'x-cache': 'miss', 'x-counts': JSON.stringify(counts), 'x-errors': errs.join(' | ').slice(0, 300) });
});
