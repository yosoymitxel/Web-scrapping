const CH = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const SIMPLE = 'curl/8.5.0';
const PRICE = /(Gs\.?|₲|R\$)\s?[\d.]{3,}/;
const PCT = /(\d{1,2})\s?%/g;
const S = [
  ['cines', 'https://www.cines.com.py/cine/2--Ita%C3%BA%20Cinema%20Pop%20del%20Sol', /cartelera_cuadro/, 'cine'],
  ['pinedo', 'https://pinedo.com.py/tiendas/', /./, 'shop'],
  ['delsol', 'https://www.delsol.com.py/shopping', /./, 'shop'],
  ['galeria', 'https://paseolagaleria.com.py/locales.php', /./, 'shop'],
  ['mariscal', 'https://www.mariscal.com.py/locales-comerciales', /./, 'shop'],
  ['multiplaza', 'https://www.multiplaza.com.py/locales', /./, 'shop'],
  ...[['contimarket','https://www.contimarket.com/search?Box=False&q=tv'],['tiendanaranja','https://tiendanaranja.com.py/catalogsearch/result/?q=Tv'],['nissei','https://nissei.com/py/catalogsearch/result/?q=tv'],['compulandia','https://www.compulandia.com.py/py/store?q=tv'],['comprasparaguai','https://mobile.comprasparaguai.com.br/tv/'],['innovagame','https://www.innovagame.com.py/busqueda?controller=search&s=Tv'],['tecnoga','https://tecnoga.com.py/?s=Tv&post_type=product'],['visuar','https://visuar.com.py/searchiqit?s=tv'],['rebuscate','https://rebuscate.com/?q=tv']].map(([n,u])=>[n,u,PRICE,'price']),
  ['ableton', 'https://www.ableton.com/en/shop/live/?tab=buy-now', PCT, 'pct'],
  ['minecraft', 'https://www.minecraft.net/es-es/store/minecraft-deluxe-collection-pc', PCT, 'pct'],
  ['imageline', 'https://www.image-line.com/fl-studio/buy-now', PCT, 'pct'],
  ['playtest', 'https://playtestgames.net/', /"status":"playtest"/, 'play'],
  ['tarjetea', 'https://tarjetea.com.py/stores?q=Indutex', /cloudflare|just a moment|cf-chl/i, 'cf'],
  ['humble', 'https://www.humblebundle.com/games/15th-anniversary-scifi-exposure', /webpack-bundle-page-data/, 'humble'],
];
const clean = s => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
async function get(url, ua) {
  try {
    const r = await fetch(url, { headers: { 'user-agent': ua, accept: 'text/html,application/xhtml+xml,*/*', 'accept-language': 'es-PY,es;q=0.9,en;q=0.8' }, redirect: 'follow', signal: AbortSignal.timeout(25000) });
    const b = await r.text();
    return { status: r.status, body: b, server: r.headers.get('server'), cf: r.headers.get('cf-mitigated') };
  } catch (e) { return { status: 'ERR ' + (e.cause?.code || e.message), body: '' }; }
}
function walk(o, f, p = '') { if (o && typeof o === 'object') { f(o, p); for (const k in o) walk(o[k], f, p + '/' + k); } }
for (const [name, url, re, kind] of S) {
  console.log('\n=== ' + name + ' ' + url);
  for (const [ln, ua] of [['chrome', CH], ['simple', SIMPLE]]) {
    const r = await get(url, ua);
    const b = r.body;
    const m = b.match(re);
    const pcts = kind === 'pct' ? [...b.matchAll(PCT)] : [];
    console.log(`[${ln}] status=${r.status} bytes=${b.length} server=${r.server} cfmit=${r.cf} match=${kind==='pct'?pcts.length:!!m} nextdata=${b.includes('__NEXT_DATA__')} ldjson=${b.includes('application/ld+json')} next_f=${b.includes('self.__next_f')} api=${(b.match(/\/api\/[\w\-\/]+/g)||[]).slice(0,4).join(',')}`);
    if (ln !== 'chrome') continue;
    if (m && kind !== 'pct') { const i = m.index; console.log('  sample:', b.slice(Math.max(0, i - 150), i + 150).replace(/\s+/g, ' ')); }
    if (kind === 'pct') pcts.slice(0, 12).forEach(x => console.log('  %:', clean(b.slice(Math.max(0, x.index - 100), x.index + 60))));
    if (kind === 'shop') {
      const t = [...b.matchAll(/<(h3|h4|a)[^>]*>([\s\S]*?)<\/\1>/g)].map(x => clean(x[2])).filter(x => x && x.length < 60);
      const alts = [...b.matchAll(/alt="([^"]{2,50})"/g)].map(x => x[1]);
      console.log('  h3/h4/a count', t.length, 'alts', alts.length, '\n  ', [...new Set(t)].slice(10, 25).join(' | '), '\n   alts:', [...new Set(alts)].slice(0, 15).join(' | '));
    }
    if (['innovagame','visuar','rebuscate','playtest','minecraft'].includes(name)) {
      console.log('  title:', (b.match(/<title>([\s\S]*?)<\/title>/) || [])[1]);
      console.log('  ld+json:', [...b.matchAll(/application\/ld\+json[^>]*>([\s\S]{0,250})/g)].slice(0, 3).map(x => x[1].replace(/\s+/g, ' ')).join(' || '));
      console.log('  priceish:', [...b.matchAll(/.{60}(?:price|precio|Gs|₲|"discount|descuento|status).{80}/gi)].slice(0, 6).map(x => x[0].replace(/\s+/g, ' ')).join('\n    '));
      console.log('  mc-offer:', (b.match(/.{80}(?:ahorra|save|off|descuento).{80}/i) || [''])[0].replace(/\s+/g, ' '));
    }
    if (kind === 'play') console.log('  playtest count', (b.match(/"status":"playtest"/g) || []).length);
    if (kind === 'humble') {
      const mm = b.match(/<script id="webpack-bundle-page-data"[^>]*>([\s\S]*?)<\/script>/);
      if (!mm) { console.log('  no page-data'); continue; }
      try {
        const d = JSON.parse(mm[1]); let n = 0;
        walk(d, (o, p) => { if (n < 3 && !Array.isArray(o) && o.human_name && !p.endsWith('basic_data')) { n++; console.log('  path', p); for (const [k, v] of Object.entries(o)) console.log('   ', k, '=', typeof v === 'string' ? v.slice(0, 120) : JSON.stringify(v).slice(0, 300)); } });
      } catch (e) { console.log('  parse err', e.message); }
    }
  }
}
