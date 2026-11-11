// Corre en GitHub Actions (Node 20, sin dependencias). Escribe data/*.json.
import { writeFile } from 'node:fs/promises';

// steamcommunity.com responde 429 a los runners de GitHub: el id va fijo.
const STEAM_ID = '76561198865545057';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'accept-language': 'es,en;q=0.8' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = async (url, as = 'json') => {
  // CheapShark responde 400 a UAs de navegador desde servidores
  const r = await fetch(url, { headers: url.includes('cheapshark') ? { 'user-agent': 'panel-precios/1.0' } : UA });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return as === 'json' ? r.json() : r.text();
};
const save = (name, data) => writeFile(`data/${name}.json`, JSON.stringify({ at: new Date().toISOString(), ...data }));
const clean = s => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const step = async (name, fn) => {
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
  return { PYG: r.PYG };
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
  const h = await get('https://www.humblebundle.com/games', 'text');
  const m = h.match(/<script[^>]*id="landingPage-json-data"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('sin JSON en la página');
  const out = new Map();
  (function walk(o) {
    if (!o || typeof o !== 'object') return;
    if (o.product_url?.startsWith('/games/') && (o.tile_short_name || o.tile_name)) {
      out.set(o.product_url, {
        name: o.tile_short_name || o.tile_name,
        url: 'https://www.humblebundle.com' + o.product_url,
        img: o.tile_image || o.high_res_tile_image || '',
        end: (o['end_date|datetime'] || o.end_date || '').slice(0, 10),
      });
    }
    Object.values(o).forEach(walk);
  })(JSON.parse(m[1]));
  if (!out.size) throw new Error('JSON sin bundles');
  // Juegos de cada bundle, para cruzarlos con la lista de deseados
  for (const b of out.values()) {
    const page = await get(b.url, 'text').catch(() => '');
    const j = page.match(/<script[^>]*id="webpack-bundle-page-data"[^>]*>([\s\S]*?)<\/script>/);
    if (!j) continue;
    const names = new Set(); let price = 0;
    (function walk(o) {
      if (!o || typeof o !== 'object') return;
      if (o.human_name && o.machine_name && !o.tier_order) names.add(o.human_name);
      if (o.price?.amount && o.price?.currency === 'USD') price = Math.max(price, +o.price.amount);
      Object.values(o).forEach(walk);
    })(JSON.parse(j[1]));
    b.games = [...names].filter(n => n !== b.name && !/charity|plan\b|subscription|donat/i.test(n)).slice(0, 60);
    if (price) b.price = price;
    await sleep(300);
  }
  console.log('humble juegos', [...out.values()].map(b => b.games?.length || 0).join(','));
  return { items: [...out.values()] };
});

await step('wishlist', async () => {
  const wl = await get(`https://api.steampowered.com/IWishlistService/GetWishlist/v1/?steamid=${STEAM_ID}`);
  const ids = (wl.response.items || []).map(i => i.appid);
  const games = [];
  for (let i = 0; i < ids.length; i += 100) {
    const input = {
      ids: ids.slice(i, i + 100).map(appid => ({ appid })),
      context: { language: 'spanish', country_code: 'PY' },
      data_request: { include_assets: true, include_all_purchase_options: false },
    };
    const r = await get(`https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(JSON.stringify(input))}`);
    for (const s of r.response.store_items || []) {
      const p = s.best_purchase_option;
      const a = s.assets;
      games.push({
        id: s.appid, name: s.name,
        img: a?.asset_url_format && a.small_capsule
          ? 'https://shared.akamai.steamstatic.com/store_item_assets/' + a.asset_url_format.replace('${FILENAME}', a.small_capsule)
          : `https://cdn.akamai.steamstatic.com/steam/apps/${s.appid}/capsule_231x87.jpg`,
        usd: p?.final_price_in_cents != null ? +p.final_price_in_cents / 100 : null,
        off: p?.discount_pct || 0,
        free: !!s.is_free,
      });
    }
  }
  // Precio más bajo fuera de Steam (Humble, GOG, Fanatical, GMG…)
  const stores = Object.fromEntries((await get('https://www.cheapshark.com/api/1.0/stores').catch(() => [])).map(s => [s.storeID, s.storeName]));
  const csId = {};
  for (const g of games) {
    // CheapShark exige title junto a steamAppID
    const title = encodeURIComponent(g.name.replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/)[0]);
    const hit = await get(`https://www.cheapshark.com/api/1.0/games?title=${title}&steamAppID=${g.id}&limit=60`).catch(e => (console.error(e.message), []));
    const m = hit.find(h => +h.steamAppID === g.id);
    if (m) csId[m.gameID] = g;
    await sleep(300);
  }
  const csIds = Object.keys(csId);
  for (let i = 0; i < csIds.length; i += 25) {
    const info = await get(`https://www.cheapshark.com/api/1.0/games?ids=${csIds.slice(i, i + 25).join(',')}`).catch(e => (console.error(e.message), {}));
    for (const [gid, { deals = [], cheapestPriceEver: low }] of Object.entries(info)) {
      // Mínimo histórico en cualquier tienda (precio US), con fecha
      if (low?.price) csId[gid].low = { usd: +low.price, date: new Date(low.date * 1000).toISOString().slice(0, 10) };
      const best = deals.filter(d => d.storeID !== '1').sort((a, b) => a.price - b.price)[0];
      if (best) csId[gid].best = { usd: +best.price, store: stores[best.storeID] || 'Otra', url: `https://www.cheapshark.com/redirect?dealID=${best.dealID}` };
    }
    await sleep(300);
  }
  console.log('cheapshark', csIds.length, games.filter(g => g.best).length);
  if (!games.length) throw new Error('lista vacía o privada');
  return { games };
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
    const t = clean(await get(url, 'text').catch(() => ''));
    const m = t.match(/(?:save|ahorra|-)\s?(\d{1,2})\s?%|(\d{1,2})\s?%\s?(?:off|de descuento|dto)/i);
    items.push({ name, url, off: m ? +(m[1] || m[2]) : 0 });
  }
  console.log('watch', JSON.stringify(items));
  return { items };
});
