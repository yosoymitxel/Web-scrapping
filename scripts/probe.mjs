const CH = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36';
const get = async (u, ua = CH) => { try { const r = await fetch(u, { headers: { 'user-agent': ua, 'accept-language': 'es-PY,es;q=0.9' }, signal: AbortSignal.timeout(25000) }); return { s: r.status, b: await r.text() }; } catch (e) { return { s: 'ERR ' + e.message, b: '' }; } };
const u = 'https://www.cines.com.py/cine/2--Ita%C3%BA%20Cinema%20Pop%20del%20Sol';
const { s, b } = await get(u);
console.log('cine', s, b.length);
console.log('scripts', [...b.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1]).join('\n'));
for (const m of b.matchAll(/(\.load\(|\.ajax|\$\.get|\$\.post|fetch\(|cartelera|\.php)[^\n]{0,200}/gi)) console.log('HIT', m[0].slice(0, 220));
console.log('ids', [...b.matchAll(/id="([^"]+)"/g)].map(m => m[1]).slice(0, 60).join(','));
console.log('inline', [...b.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1].trim().slice(0, 600)).filter(x => x).join('\n---\n').slice(0, 4000));
console.log('LINKS', [...new Set([...b.matchAll(/(?:href|src|data-[a-z]+)="([^"]*(?:ajax|cartelera|\.php|json)[^"]*)"/gi)].map(m => m[1]))].join('\n'));
for (const [n, url] of [['contimarket', 'https://www.contimarket.com/search?Box=False&q=tv'], ['tiendanaranja', 'https://tiendanaranja.com.py/catalogsearch/result/?q=tv'], ['nissei', 'https://nissei.com/py/catalogsearch/result/?q=tv'], ['tecnoga', 'https://tecnoga.com.py/?s=tv&post_type=product']]) {
  for (const ua of [CH, 'curl/8.5.0']) {
    const r = await get(url, ua);
    console.log('\n##', n, ua.slice(0, 5), r.s, r.b.length);
    if (ua !== CH && n !== 'tecnoga') continue;
    const i = r.b.search(/ProductPrice|data-price-amount|product-item-link|"@type":\s*"Product"|woocommerce-loop|price/);
    console.log(i < 0 ? 'nada' : r.b.slice(Math.max(0, i - 600), i + 1500).replace(/\s+/g, ' '));
  }
}
