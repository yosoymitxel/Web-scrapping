// Corre en GitHub Actions (Node 20, sin dependencias). Escribe data/*.json.
import { writeFile, readFile } from 'node:fs/promises';

const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'accept-language': 'es,en;q=0.8' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = async (url, as = 'json', tries = 3) => {
  // CheapShark responde 400 a UAs de navegador desde servidores
  const r = await fetch(url, { headers: url.includes('cheapshark') ? { 'user-agent': 'panel-precios/1.0' } : UA, signal: AbortSignal.timeout(30000) });
  // CheapShark limita ráfagas: esperar y reintentar
  if (r.status === 429 && tries > 1) { await sleep(Math.min(+(r.headers.get('retry-after') || 0) * 1000 || 8000, 12000)); return get(url, as, tries - 1); }
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return as === 'json' ? r.json() : r.text();
};
const save = (name, data) => writeFile(`data/${name}.json`, JSON.stringify({ at: new Date().toISOString(), ...data }));
const dec = s => s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const clean = s => dec(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const step = async (name, fn) => {
  if (process.env.ONLY && !process.env.ONLY.split(',').includes(name)) return;
  try { await save(name, await fn()); console.log('ok', name); }
  catch (e) { console.error('fallo', name, e.message); process.exitCode = 1; }
};

await step('asphalt', async () => {
  const h = await get('https://www.pocketgamer.com/asphalt-legends-unite/codes/', 'text');
  const a = h.search(/<h2>Working/i), b = h.search(/<h3>Non-working/i);
  if (a < 0 || b < a) throw new Error('cambió la página');
  const codes = [...h.slice(a, b).matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map(m => {
    const t = clean(m[1]);
    const [code, ...reward] = t.split(/\s+-\s+/);
    return { code: code.split(' ')[0].replace(/!$/, ''), reward: reward.join(' - ') };
  }).filter(c => c.code);
  if (!codes.length) throw new Error('sin códigos');
  return { codes };
});

await step('fx', async () => {
  const { rates: r } = await get('https://open.er-api.com/v6/latest/USD');
  return { PYG: r.PYG, ARS: r.ARS, BRL: r.BRL, EUR: r.EUR };
});

await step('free', async () => {
  const gp = await get('https://www.gamerpower.com/api/giveaways?platform=pc&type=game&sort-by=date');
  const store = p => /steam/i.test(p) ? 'Steam' : /epic/i.test(p) ? 'Epic' : /gog/i.test(p) ? 'GOG' : /itch/i.test(p) ? 'itch.io' : 'Otro';
  const rank = { Steam: 0, Epic: 1 };
  const items = gp.map(g => ({
    title: g.title.replace(/\s*\((Steam|Epic Games|GOG|PC|Itch\.io)[^)]*\)|\s*Giveaway$/gi, '').replace(/\s+Key$/i, ''),
    img: g.thumbnail, url: g.open_giveaway_url, worth: g.worth === 'N/A' ? '' : g.worth,
    end: g.end_date === 'N/A' ? '' : g.end_date.slice(0, 10), store: store(g.platforms),
  })).sort((a, b) => (rank[a.store] ?? 2) - (rank[b.store] ?? 2));
  return { items };
});

await step('humble', async () => {
  let html = '', out = new Map();
  for (let i = 0; i < 3 && !out.size; i++) {
    if (i) await sleep(4000);
    html = await get('https://www.humblebundle.com/games', 'text').catch(e => (console.error('humble landing', e.message), ''));
    const old = html.match(/<script[^>]*id="landingPage-json-data"[^>]*>([\s\S]*?)<\/script>/);
    if (old) (function walk(o) {
      if (!o || typeof o !== 'object') return;
      if (o.product_url?.startsWith('/games/') && (o.tile_short_name || o.tile_name)) {
        out.set(o.product_url, { name: o.tile_short_name || o.tile_name, url: 'https://www.humblebundle.com' + o.product_url, img: o.tile_image || o.high_res_tile_image || '', end: (o['end_date|datetime'] || o.end_date || '').slice(0, 10), endAt: o['end_date|datetime'] || o.end_date || '' });
      }
      Object.values(o).forEach(walk);
    })(JSON.parse(old[1]));
    // Página nueva (Next.js): los bundles son enlaces /games/<slug>; el resto sale de cada página
    else for (const m of html.matchAll(/href="(\/games\/[a-z0-9][a-z0-9-]+)"/g)) out.set(m[1], { name: m[1].slice(7).replace(/-/g, ' '), url: 'https://www.humblebundle.com' + m[1], img: '', end: '', endAt: '' });
  }
  if (!out.size) {
    console.error('humble sin bundles: largo', html.length, 'inicio', clean(html).slice(0, 200));
    throw new Error('sin bundles en la página');
  }
  // Juegos de cada bundle, para cruzarlos con la lista de deseados
  for (const b of out.values()) {
    console.log('humble bundle', b.name);
    const page = await get(b.url, 'text').catch(() => '');
    const j = page.match(/<script[^>]*id="webpack-bundle-page-data"[^>]*>([\s\S]*?)<\/script>/);
    const meta = k => (page.match(new RegExp(`<meta[^>]*(?:property|name)="${k}"[^>]*content="([^"]*)"`, 'i')) || page.match(new RegExp(`<meta[^>]*content="([^"]*)"[^>]*(?:property|name)="${k}"`, 'i')))?.[1];
    if (!b.img && meta('og:image')) b.img = clean(meta('og:image'));
    if (meta('og:title') && b.name.toLowerCase() === b.url.split('/').pop().replace(/-/g, ' ')) b.name = clean(meta('og:title')).replace(/\s*\|\s*Humble Bundle$/i, '').replace(/^Humble\s+/, '').replace(/\s+Bundle$/, '');
    if (!j) {
      // Página Next.js: HTML con lista de juegos (imagen + nombre + MSRP), niveles "8 Items$315.27$25.00" y cuenta regresiva
      const txt = clean(page.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' '));
      const h1 = page.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1];
      if (h1) b.name = clean(h1).replace(/^Humble\s+/, '').replace(/\s+Bundle$/, '');
      const games = new Map();
      for (const li of page.split(/<li[\s>]/).slice(1)) {
        if (!/MSRP/.test(li)) continue;
        const alt = li.match(/<img[^>]*alt="([^"]+)"/)?.[1];
        const src = li.match(/<img[^>]*src="[^"]*?url=([^&"]+)/)?.[1];
        const n = clean(alt || '') || clean(li.replace(/<img[^>]*>/g, ' ')).replace(/\s*MSRP.*$/, '');
        if (n && !games.has(n)) games.set(n, { n, img: src ? decodeURIComponent(src) : '' });
      }
      // El payload de Next trae bundlePage: {endDate, tiers:[{price:{amount}}]}
      const flat = [...page.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)].map(x => { try { return JSON.parse('"' + x[1] + '"'); } catch { return ''; } }).join('');
      const seg = flat.slice(Math.max(0, flat.indexOf('"bundlePage":')));
      const ed = seg.match(/"endDate":"([^"]+)"/)?.[1];
      if (ed) { b.endAt = ed; b.end = ed.slice(0, 10); }
      const tl = [...new Set([...seg.slice(Math.max(0, seg.indexOf('"tiers":['))).matchAll(/"price":\{"amount":([\d.]+),"currencyCode":"USD"\}/g)].map(x => +x[1]))].map(price => ({ price }));
      const cd = txt.match(/Ends in (\d+)d\s*:\s*(\d+)h\s*:\s*(\d+)m\s*:\s*(\d+)s/i);
      if (cd && !ed) { b.endAt = new Date(Date.now() + (((+cd[1] * 24 + +cd[2]) * 60 + +cd[3]) * 60 + +cd[4]) * 1000).toISOString(); b.end = b.endAt.slice(0, 10); }
      b.games = [...games.values()].slice(0, 60);
      if (tl.length) { tl.sort((x, y) => x.price - y.price); b.price = tl[tl.length - 1].price; b.min = tl[0].price; b.tiers = tl; }
      if (!globalThis.dbgHb) { globalThis.dbgHb = 1; console.log('humble nuevo', b.name, 'juegos', games.size, 'tiers', JSON.stringify(tl), 'fin', b.endAt); }
      await sleep(300);
      continue;
    }
    const items = new Map(); const tiers = new Set(); let tierData = null, sample = null;
    const isImg = v => typeof v === 'string' && /^https?:\/\/\S+\.(jpe?g|png|webp)(\?|$)/i.test(v);
    // Primera imagen del juego; prefiere campos de portada
    const imgOf = o => { let best = '', pri = 9; (function f(x, k) { if (!x || typeof x !== 'object') { if (isImg(x)) { const p = /featured|thumb|capsule|header|cover/i.test(k) ? 0 : /icon/i.test(k) ? 2 : 1; if (p < pri) { pri = p; best = x; } } return; } Object.entries(x).forEach(([kk, v]) => f(v, kk)); })(o, ''); return best; };
    (function walk(o) {
      if (!o || typeof o !== 'object') return;
      if (o.tier_pricing_data && typeof o.tier_pricing_data === 'object' && !tierData) tierData = o.tier_pricing_data;
      if (o.human_name && o.machine_name && !o.tier_order && !items.has(o.human_name)) {
        sample ||= o;
        items.set(o.human_name, { n: o.human_name, img: o.resolved_paths?.featured_image || imgOf(o), steam: +o.steam_app_id || undefined });
      }
      const pm = o['price|money'] || o.price;
      if (pm?.amount != null && pm.currency === 'USD') tiers.add(+pm.amount);
      Object.values(o).forEach(walk);
    })(JSON.parse(j[1]));
    if (tierData) { tiers.clear(); Object.values(tierData).forEach(t => { const pm = t?.['price|money'] || t?.price; if (pm?.amount != null) tiers.add(+pm.amount); }); }
    if (!b.logged) { b.logged = 1; console.log('humble precios', b.name, [...tiers].join(','), 'muestra', JSON.stringify(sample).slice(0, 700)); }
    b.games = [...items.values()].filter(g => g.n !== b.name && !/charity|plan\b|subscription|donat/i.test(g.n)).slice(0, 60);
    delete b.logged;
    const tl = [...tiers].filter(x => x > 0).sort((a, c) => a - c);
    if (tl.length) { b.price = tl[tl.length - 1]; b.min = tl[0]; }
    await sleep(300);
  }
  if (![...out.values()].some(b => b.games?.length)) throw new Error('sin juegos en ningún bundle');
  console.log('humble bundles', out.size, 'juegos', [...out.values()].map(b => b.games?.length || 0).join(','));
  return { items: [...out.values()] };
});


// Ofertas vigiladas: la página solo se muestra si anuncia descuento
await step('watch', async () => {
  const list = [
    ['Ableton Live', 'https://www.ableton.com/en/shop/live/?tab=buy-now'],
    ['Minecraft Deluxe', 'https://www.minecraft.net/es-es/store/minecraft-deluxe-collection-pc'],
    ['FL Studio', 'https://www.image-line.com/fl-studio/buy-now'],
  ];
  const items = [];
  for (const [name, url] of list) {
    const html = (await get(url, 'text').catch(() => '')).replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ');
    const t = clean(html);
    const m = t.match(/(?:save|ahorra(?:\s+hasta)?|up to|hasta)\s+(\d{1,2})\s?%|(?<![\w.])(\d{1,2})\s?%\s*(?:off\b|de descuento|descuento|dto\b|discount)/i);
    items.push({ name, url, off: m ? +(m[1] || m[2]) : 0 });
  }
  console.log('watch', JSON.stringify(items));
  return { items };
});

// Playtests y demos (playtestgames.net): datos dentro del payload de Next.js
await step('playtest', async () => {
  const h = (await get('https://playtestgames.net/', 'text')).replace(/\\"/g, '"');
  const items = new Map();
  for (const m of h.matchAll(/"appId":"(\d+)"[^{}]*?"name":"([^"]+)"[\s\S]{0,400}?"status":"(\w+)"[\s\S]{0,200}?"image":"([^"]+)"/g))
    if (!items.has(m[1])) items.set(m[1], { id: +m[1], name: dec(m[2].replace(/\\u([0-9a-f]{4})/gi, (_, c) => String.fromCharCode(parseInt(c, 16)))), status: m[3], img: m[4] });
  if (!items.size) throw new Error('sin juegos');
  console.log('playtest', items.size, [...items.values()].filter(i => i.status === 'playtest').length);
  return { items: [...items.values()] };
});

// Cartelera (cines.com.py): película → cines y horarios
await step('cines', async () => {
  const O = 'https://www.cines.com.py';
  const home = await get(O + '/cine/2--Ita%C3%BA%20Cinema%20Pop%20del%20Sol', 'text');
  // Los enlaces vienen relativos y con espacios
  const cines = [...new Map([...home.matchAll(/href="(\/cine\/(\d+)--[^"#]+)"/g)].map(m => [m[2], O + encodeURI(m[1])])).entries()];
  const movies = new Map();
  for (const [, url] of cines) {
    const h = url.includes('/cine/2--') ? home : await get(url, 'text').catch(() => '');
    const cine = decodeURIComponent(url.split('--')[1]);
    const cut = h.indexOf('id="contenido_estrenos"');
    for (const b of (cut > 0 ? h.slice(0, cut) : h).split('cartelera_cuadro').slice(1)) {
      const m = b.match(/href="(\/pelicula\/(\d+)--[^"]+)"[\s\S]*?src="([^"]+)"[\s\S]*?<h1>\s*([^<]+?)\s*</);
      if (!m) continue;
      const times = [...b.matchAll(/Horarios ([^<]+)<\/strong>[\s\S]*?<p>([^<]*)<\/p>/g)].map(t => `${t[1].trim()}: ${t[2].trim()}`);
      const mv = movies.get(m[2]) || { id: +m[2], title: clean(m[4]), img: O + m[3], url: O + encodeURI(m[1]), at: [] };
      mv.at.push({ cine, times });
      movies.set(m[2], mv);
    }
    await sleep(300);
  }
  if (!movies.size) throw new Error('sin películas');
  // Género de la ficha (campo GENERO)
  for (const mv of movies.values()) {
    const f = await get(mv.url, 'text').catch(() => '');
    const g = f.match(/<strong>\s*GENERO\s*<\/strong>\s*<span>\s*:?\s*([^<]*)<\/span>/i)?.[1];
    mv.genres = g ? clean(g).replace(/\.$/, '').split(',').map(x => x.trim()).filter(Boolean) : [];
    await sleep(200);
  }
  console.log('cines', cines.length, 'películas', movies.size, 'con género', [...movies.values()].filter(m => m.genres.length).length, 'con horarios', [...movies.values()].filter(m => m.at.some(a => a.times.length)).length);
  return { movies: [...movies.values()].sort((a, b) => b.at.length - a.at.length) };
});

// Locales de shoppings: nombres sueltos para ubicar promos por comercio
await step('shoppings', async () => {
  const list = [
    ['Pinedo Shopping', 'https://pinedo.com.py/tiendas/'],
    ['Shopping del Sol', 'https://www.delsol.com.py/shopping'],
    ['Paseo La Galería', 'https://paseolagaleria.com.py/locales.php'],
    ['Shopping Mariscal', 'https://www.mariscal.com.py/locales-comerciales'],
    ['Multiplaza', 'https://www.multiplaza.com.py/locales'],
  ];
  const out = [];
  for (const [name, url] of list) {
    const h = await get(url, 'text').catch(e => (console.error(name, e.message), ''));
    const stores = new Set();
    for (const m of h.matchAll(/<(h[1-6]|a|strong|span|p|li|figcaption|div)[^>]*>([^<]{2,40})<\/\1>/g)) {
      const t = clean(m[2]);
      if (/[a-záéíóúñ]/i.test(t) && !/local|piso|horario|shopping|contacto|inicio|tiendas|ver m/i.test(t)) stores.add(t);
    }
    for (const m of h.matchAll(/alt="([^"]{2,40})"/g)) stores.add(clean(m[1]));
    console.log('shopping', name, stores.size);
    out.push({ name, url, stores: [...stores] });
    await sleep(300);
  }
  return { items: out };
});
