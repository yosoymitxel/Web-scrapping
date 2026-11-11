// Corre en GitHub Actions (Node 20, sin dependencias). Escribe data/*.json.
import { writeFile, readFile } from 'node:fs/promises';

const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'accept-language': 'es,en;q=0.8' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = async (url, as = 'json', tries = 3) => {
  // CheapShark responde 400 a UAs de navegador desde servidores
  const r = await fetch(url, { headers: url.includes('cheapshark') ? { 'user-agent': 'panel-precios/1.0' } : UA, signal: AbortSignal.timeout(30000) });
  // CheapShark limita ráfagas: esperar y reintentar
  if (r.status === 429 && tries > 1) { await sleep(+(r.headers.get('retry-after') || 0) * 1000 || 8000); return get(url, as, tries - 1); }
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return as === 'json' ? r.json() : r.text();
};
const save = (name, data) => writeFile(`data/${name}.json`, JSON.stringify({ at: new Date().toISOString(), ...data }));
const clean = s => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
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
    if (meta('og:title') && b.name.toLowerCase() === b.url.split('/').pop().replace(/-/g, ' ')) b.name = clean(meta('og:title')).replace(/\s*\(.*$/, '');
    if (!j) {
      if (!globalThis.dbgHb) {
        globalThis.dbgHb = 1;
        const flat = [...page.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)].map(x => { try { return JSON.parse('"' + x[1] + '"'); } catch { return ''; } }).join('');
        const at = k => { const i = flat.indexOf(k); return i < 0 ? 'NO' : flat.slice(Math.max(0, i - 150), i + 450); };
        console.log('humble página', b.url, 'largo', page.length, 'flat', flat.length, 'scripts', [...page.matchAll(/<script([^>]*)>/g)].map(x => x[1].replace(/src="[^"]*"/, '').trim()).filter(Boolean).slice(0, 10).join('|'));
        for (const k of ['tier_pricing_data', 'human_name', 'end_date', 'price|money', 'resolved_paths', 'steam_app_id']) console.log('humble clave', k, JSON.stringify(at(k)));
      }
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
  // Precio actual más bajo y mínimo histórico de cada juego (CheapShark), como en deseados
  const norm = t => t.toLowerCase().replace(/[^a-z0-9]/g, '');
  const all = new Map();
  for (const b of out.values()) for (const g of b.games || []) all.set(norm(g.n), g);
  console.log('humble imágenes', [...all.values()].filter(g => g.img).length, '/', all.size, [...all.values()].find(g => g.img)?.img);
  // Reusar precios de la corrida anterior (< 24 h): solo se consultan juegos nuevos
  const prev = await readFile('data/humble.json', 'utf8').then(JSON.parse).catch(() => ({}));
  const known = Date.now() - new Date(prev.at || 0) < 864e5
    ? new Map((prev.items || []).flatMap(b => b.games || []).filter(g => g.usd != null).map(g => [norm(g.n), g])) : new Map();
  const byId = {}; let n = 0;
  for (const [k, g] of all) {
    const old = known.get(k);
    if (old) { Object.assign(g, { usd: old.usd, low: old.low, steam: old.steam }); continue; }
    if (!(all.size % 1) && ++n % 20 === 0) console.log('cheapshark', n, '/', all.size);
    const hit = await get(`https://www.cheapshark.com/api/1.0/games?title=${encodeURIComponent(g.n)}&limit=10`).catch(() => []);
    const m = hit.find(h => norm(h.external) === k);
    if (m) { g.usd = +m.cheapest; g.steam = +m.steamAppID || undefined; byId[m.gameID] = g; }
    await sleep(250);
  }
  const ids = Object.keys(byId);
  for (let i = 0; i < ids.length; i += 25) {
    const info = await get(`https://www.cheapshark.com/api/1.0/games?ids=${ids.slice(i, i + 25).join(',')}`).catch(() => ({}));
    for (const [gid, { cheapestPriceEver: low }] of Object.entries(info)) if (low?.price) byId[gid].low = +low.price;
    await sleep(300);
  }
  console.log('humble juegos', [...out.values()].map(b => b.games?.length || 0).join(','), 'con img', [...all.values()].filter(g => g.img).length, 'con precio', ids.length, '/', all.size);
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
    if (!items.has(m[1])) items.set(m[1], { id: +m[1], name: m[2].replace(/\\u([0-9a-f]{4})/gi, (_, c) => String.fromCharCode(parseInt(c, 16))), status: m[3], img: m[4] });
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
  console.log('cines', cines.length, 'películas', movies.size, 'con horarios', [...movies.values()].filter(m => m.at.some(a => a.times.length)).length);
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
