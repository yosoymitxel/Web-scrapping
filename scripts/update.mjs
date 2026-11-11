// Corre en GitHub Actions (Node 20, sin dependencias). Escribe data/*.json.
import { writeFile } from 'node:fs/promises';

// steamcommunity.com responde 429 a los runners de GitHub: el id va fijo.
const STEAM_ID = '76561198865545057';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'accept-language': 'es,en;q=0.8' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = async (url, as = 'json') => {
  const r = await fetch(url, { headers: UA });
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
  for (const g of games) {
    const deals = await get(`https://www.cheapshark.com/api/1.0/deals?steamAppID=${g.id}`).catch(() => []);
    const best = deals.filter(d => d.storeID !== '1').sort((a, b) => a.salePrice - b.salePrice)[0];
    if (best) g.best = { usd: +best.salePrice, store: stores[best.storeID] || 'Otra', url: `https://www.cheapshark.com/redirect?dealID=${best.dealID}` };
    await sleep(350);
  }
  if (!games.length) throw new Error('lista vacía o privada');
  return { games };
});
