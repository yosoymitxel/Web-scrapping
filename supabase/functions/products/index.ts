// Buscador de productos: consulta varias tiendas en paralelo y cachea 6 h en public.products_cache.
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, OPTIONS' };
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
  const b = await html('https://www.contimarket.com/search?Box=False&q=' + encodeURIComponent(q));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

const SHOPS: [string, (q: string) => Promise<P[]>][] = [['Contimarket', contimarket], ['Tienda Naranja', naranja], ['Tecnoga', tecnoga], ['Nissei', nissei]];

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim().toLowerCase().slice(0, 80);
  const json = (d: unknown, extra: Record<string, string> = {}) => new Response(JSON.stringify(d), { headers: { ...CORS, 'content-type': 'application/json', ...extra } });
  if (!q) return json([]);
  const key = q.replace(/\s+/g, ' ');
  try {
    const r = await fetch(`${SB}?key=eq.${encodeURIComponent(key)}&select=data,at`, { headers: H });
    const row = (await r.json())?.[0];
    if (row && Date.now() - new Date(row.at).getTime() < TTL) return json(row.data, { 'x-cache': 'hit' });
  } catch { /* sin caché */ }
  const res = await Promise.allSettled(SHOPS.map(([, f]) => f(key)));
  const errs: string[] = [];
  const all: P[] = [];
  res.forEach((r, i) => { if (r.status === 'fulfilled') all.push(...r.value); else errs.push(SHOPS[i][0] + ':' + r.reason?.message); });
  all.sort((a, b) => a.price - b.price);
  const counts = Object.fromEntries(SHOPS.map(([n]) => [n, all.filter(p => p.shop === n).length]));
  if (all.length) {
    fetch(SB, { method: 'POST', headers: { ...H, prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ key, data: all, at: new Date().toISOString() }) }).catch(() => {});
  }
  return json(all, { 'x-cache': 'miss', 'x-counts': JSON.stringify(counts), 'x-errors': errs.join(' | ').slice(0, 300) });
});
