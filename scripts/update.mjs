// Corre en GitHub Actions (Node 20, sin dependencias). Escribe data/*.json.
import { writeFile } from 'node:fs/promises';

const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36' };
const STEAM_USER = 'yosoymitxel';
const get = async (url, as = 'json') => {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return as === 'json' ? r.json() : r.text();
};
const save = (name, data) => writeFile(`data/${name}.json`, JSON.stringify({ at: new Date().toISOString(), ...data }, null, 1));
const clean = s => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
const step = async (name, fn) => { try { await save(name, await fn()); console.log('ok', name); } catch (e) { console.error('fallo', name, e.message); } };

await step('asphalt', async () => {
  const h = await get('https://www.pocketgamer.com/asphalt-legends-unite/codes/', 'text');
  const a = h.search(/<h2>Working/i), b = h.search(/<h3>Non-working/i);
  const codes = [...h.slice(a, b).matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map(m => {
    const t = clean(m[1]); const [code, ...rest] = t.split(/\s+-\s+|\s+/);
    return { code: code.replace(/!$/, ''), reward: t.includes(' - ') ? t.split(' - ').slice(1).join(' - ') : '' };
  }).filter(c => c.code);
  if (!codes.length) throw new Error('sin códigos');
  return { codes };
});

await step('fx', async () => {
  const d = await get('https://open.er-api.com/v6/latest/USD');
  const r = d.rates;
  return { PYG: r.PYG, ARS: r.ARS, BRL: r.BRL, EUR: r.EUR };
});

await step('free', async () => {
  const gp = await get('https://www.gamerpower.com/api/giveaways?type=game&sort-by=date');
  const rank = p => /steam/i.test(p) ? 0 : /epic/i.test(p) ? 1 : 2;
  const items = gp.map(g => ({
    title: g.title.replace(/\s*\((Steam|Epic Games|GOG|PC)[^)]*\)|\s*Giveaway$/gi, ''),
    img: g.thumbnail, url: g.open_giveaway_url, worth: g.worth, end: g.end_date,
    store: /steam/i.test(g.platforms) ? 'Steam' : /epic/i.test(g.platforms) ? 'Epic' : g.platforms.split(',')[0],
    r: rank(g.platforms),
  })).sort((a, b) => a.r - b.r);
  return { items };
});

await step('wishlist', async () => {
  const xml = await get(`https://steamcommunity.com/id/${STEAM_USER}?xml=1`, 'text');
  const steamid = xml.match(/<steamID64>(\d+)/)[1];
  const wl = await get(`https://api.steampowered.com/IWishlistService/GetWishlist/v1/?steamid=${steamid}`);
  const ids = (wl.response.items || []).map(i => i.appid);
  const games = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const p = await get(`https://store.steampowered.com/api/appdetails?appids=${chunk.join(',')}&filters=price_overview&cc=us`);
    for (const id of chunk) {
      const po = p[id]?.data?.price_overview;
      games.push({ id, usd: po ? po.final / 100 : null, base: po ? po.initial / 100 : null, off: po?.discount_percent || 0 });
    }
  }
  // Nombres: endpoint ligero por lotes
  const names = await get(`https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(JSON.stringify({ ids: ids.map(appid => ({ appid })), context: { language: 'spanish', country_code: 'US' } }))}`).catch(() => null);
  const byId = Object.fromEntries((names?.response?.store_items || []).map(s => [s.appid, s.name]));
  games.forEach(g => (g.name = byId[g.id] || `App ${g.id}`));
  games.sort((a, b) => b.off - a.off);
  return { steamid, games };
});
