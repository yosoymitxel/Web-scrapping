// Comprueba wishlist de productos y envía push por dispositivo. Se ejecuta cada 3 h desde Actions.
import webpush from 'npm:web-push@3.6.7';
import { findWishlistMatch, safeProductUrl } from './product-matching.mjs';
import { analyzeWishlistPrice, findComparableOffers, targetPriceState } from './wishlist-tracking.mjs';
import { updateFollowedStore } from './store-follow.mjs';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DATA = 'https://yosoymitxel.github.io/Web-scrapping/data/';
const PROMOS = 'https://yosoymitxel.github.io/promociones-tarjetas-bancos-paraguay-py/promos.json';
const PANEL = 'https://yosoymitxel.github.io/Web-scrapping/';
const PRODUCTS = URL_ + '/functions/v1/products';
const db = (path: string, init: RequestInit = {}) => fetch(`${URL_}/rest/v1/${path}`, {
  ...init,
  headers: {
    apikey: KEY,
    Authorization: 'Bearer ' + KEY,
    'content-type': 'application/json',
    ...(init.headers || {}),
  },
});
const rows = async (path: string) => {
  const r = await db(path);
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 180)}`);
  return r.json();
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const readJson = async (url: string) => {
  try {
    const r = await fetch(url + '?t=' + Date.now(), { signal: AbortSignal.timeout(10000) });
    return r.ok ? await r.json() : {};
  } catch { return {}; }
};
const norm = (s: unknown) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = (s: unknown) => norm(s).split(' ').filter(t => t.length > 1 && !new Set(['de','del','la','el','los','las','con','para','y','the','new','nuevo','original','auricular','auriculares','audifono','audifonos','headphone','headphones','headset','wireless','inalambrico','inalambricos','bluetooth','gaming','gamer','microfono','microfonos','color','negro','blanco']).has(t));
const safeUrl = safeProductUrl;
const matchProduct = findWishlistMatch;
const productSnapshot = (p: any) => ({
  name: String(p.name || ''),
  shop: String(p.shop || ''),
  price: Number(p.price) || 0,
  old: Number(p.old) || 0,
  off: Number(p.off) || 0,
  url: safeUrl(p.url),
  img: String(p.img || ''),
});
const money = (n: number) => '₲ ' + Math.round(n).toLocaleString('es-PY');
const inBatches = async <T>(items: T[], limit: number, fn: (item: T) => Promise<void>) => {
  for (let i = 0; i < items.length; i += limit) {
    await Promise.all(items.slice(i, i + limit).map(fn));
  }
};
const pushPayload = async (subscription: any, payload: unknown, endpoint: string) => {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (e: any) {
    if (e?.statusCode === 404 || e?.statusCode === 410) {
      await db('panel_push_subscriptions?endpoint=eq.' + encodeURIComponent(endpoint), { method: 'DELETE' }).catch(() => null);
    } else console.error('push failed', e?.statusCode || e?.message || e);
    return false;
  }
};

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null);
  if (req.method !== 'GET' && req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const [run] = await rows('push_runs?id=eq.1&select=at');
  if (run && Date.now() - new Date(run.at).getTime() < 20 * 60e3) {
    return json({ ok: true, skipped: 'recent-run' });
  }
  await db('push_runs?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ id: 1, at: new Date().toISOString() }),
  });

  const [keys] = await rows('push_keys?id=eq.1&select=public,private');
  if (!keys?.public || !keys?.private) return json({ error: 'vapid_keys_missing' }, 500);
  webpush.setVapidDetails('mailto:panel@example.com', keys.public, keys.private);

  const [free, asphalt, watch, humble, playtest, promos] = await Promise.all([
    ...['free', 'asphalt', 'watch', 'humble', 'playtest'].map(n => readJson(DATA + n + '.json')),
    readJson(PROMOS),
  ]);
  const [profiles, subscriptions, wishlistRows] = await Promise.all([
    rows('panel_profiles?select=user_id,data'),
    rows('panel_push_subscriptions?select=user_id,endpoint,subscription'),
    rows('panel_product_wishlist?select=user_id,item_id,item,updated_at&order=updated_at.asc&limit=1000'),
  ]);

  const profileByUser = new Map<string, any>(profiles.map((r: any) => [r.user_id, r.data || {}]));
  const subscriptionsByUser = new Map<string, { endpoint: string; subscription: any }[]>();
  for (const s of subscriptions) {
    const list = subscriptionsByUser.get(s.user_id) || [];
    list.push({ endpoint: s.endpoint, subscription: s.subscription });
    subscriptionsByUser.set(s.user_id, list);
  }
  // Migra de forma compatible las suscripciones guardadas en el perfil por versiones anteriores.
  for (const [userId, data] of profileByUser) {
    const legacy = data?.push;
    if (legacy?.endpoint && !((subscriptionsByUser.get(userId) || []).some(s => s.endpoint === legacy.endpoint))) {
      const list = subscriptionsByUser.get(userId) || [];
      list.push({ endpoint: legacy.endpoint, subscription: legacy });
      subscriptionsByUser.set(userId, list);
    }
  }

  // Prioriza los registros más antiguos: las búsquedas se rotan y todos los productos terminan revisándose.
  const querySet = new Set<string>();
  for (const row of wishlistRows) {
    const q = String(row.item?.query || row.item?.name || '').trim();
    if (q) querySet.add(q);
    if (querySet.size >= 24) break;
  }
  const queries = [...querySet];
  const queryResults = new Map<string, { items: any[]; error: string }>();
  let checkedQueries = 0;
  await inBatches(queries, 4, async q => {
    try {
      const r = await fetch(PRODUCTS + '?q=' + encodeURIComponent(q) + '&refresh=1', { signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error('products ' + r.status);
      const data = await r.json();
      if (!Array.isArray(data)) throw new Error('respuesta de productos inválida');
      queryResults.set(q.toLowerCase(), { items: data.filter(p => Number(p.price) > 0), error: '' });
      checkedQueries++;
    } catch (e: any) {
      queryResults.set(q.toLowerCase(), { items: [], error: String(e?.message || e) });
      console.error('price check failed', q, e?.message || e);
    }
  });

  const priceAlerts = new Map<string, any[]>();
  const targetAlerts = new Map<string, any[]>();
  let updatedItems = 0;
  const checkedAt = new Date().toISOString();
  for (const row of wishlistRows) {
    const item = row.item || {};
    const q = String(item.query || item.name || '').trim();
    const result = queryResults.get(q.toLowerCase());
    if (!result) continue;
    if (result.error) {
      item.latest = { ...(item.latest || {}), checkedAt, error: result.error };
    } else {
      const foundRaw = matchProduct(result.items, item);
      if (foundRaw && Number(foundRaw.price) > 0) {
        const found = productSnapshot(foundRaw);
        const priceState = analyzeWishlistPrice(item, found, checkedAt);
        const targetState = targetPriceState(item, found.price);
        const offers = findComparableOffers(result.items, found, 4).map(productSnapshot);
        item.history = priceState.history;
        item.latest = {
          ...(item.latest || {}),
          checkedAt,
          matched: found,
          offers,
          lowestPrice: priceState.lowestPrice,
          targetReached: targetState.reached,
          missing: false,
          error: '',
          change: priceState.change,
        };
        if (targetState.shouldNotify && profileByUser.get(row.user_id)?.notify?.price !== false &&
            (subscriptionsByUser.get(row.user_id) || []).length > 0) {
          item.targetAlertedFor = targetState.targetPrice;
          item.targetAlertedAt = checkedAt;
          const list = targetAlerts.get(row.user_id) || [];
          list.push({
            name: found.name || item.name,
            shop: found.shop,
            price: found.price,
            targetPrice: targetState.targetPrice,
            url: found.url,
          });
          targetAlerts.set(row.user_id, list);
        } else if (targetState.shouldNotify) {
          // No marcar como enviado: el usuario puede activar avisos más adelante.
          delete item.targetAlertedFor;
          delete item.targetAlertedAt;
        }
        if (priceState.change?.direction === 'down' && !targetState.shouldNotify) {
          const list = priceAlerts.get(row.user_id) || [];
          list.push({
            name: found.name || item.name,
            shop: found.shop,
            price: found.price,
            previous: priceState.change.previous,
            percent: priceState.change.percent,
            url: found.url,
          });
          priceAlerts.set(row.user_id, list);
        }
      } else {
        item.latest = { ...(item.latest || {}), checkedAt, missing: true, error: '' };
      }
    }

    await db(
      'panel_product_wishlist?user_id=eq.' + encodeURIComponent(row.user_id) + '&item_id=eq.' + encodeURIComponent(row.item_id),
      { method: 'PATCH', body: JSON.stringify({ item, updated_at: checkedAt }) },
    );
    updatedItems++;
  }

  let sent = 0;
  let users = 0;
  for (const [userId, data] of profileByUser) {
    const want = {
      sale: true, bundles: true, playtest: true, free: true, watch: true, stores: true, asphalt: false, price: true,
      ...(data?.notify || {}),
    };
    const userSubs = subscriptionsByUser.get(userId) || [];
    if (userSubs.length) users++;

    // Actualiza la wishlist de comercios aunque la cuenta no tenga push activo.
    const storeAlerts: { name: string; promos: any[] }[] = [];
    if (Array.isArray(promos)) {
      const followed = Array.isArray(data.followedStores) ? data.followedStores : [];
      for (let i = 0; i < followed.length; i++) {
        const result = updateFollowedStore(followed[i], promos, checkedAt);
        followed[i] = result.follow;
        if (result.newPromotions.length) {
          storeAlerts.push({ name: String(result.follow.name || 'Local seguido'), promos: result.newPromotions });
        }
      }
      data.followedStores = followed;
    }


    let steamGames: any[] = [];
    if (data.steam && (want.sale || want.bundles || want.playtest)) {
      const [cache] = await rows(`steam_cache?key=eq.${encodeURIComponent('wl:' + String(data.steam).toLowerCase())}&select=data`);
      steamGames = cache?.data?.games || [];
    }
    const wishedNames = new Set(steamGames.map(g => norm(g.name)));
    const wishedIds = new Set(steamGames.map(g => g.id));
    const used = new Set(data.used || []);
    const groups: Record<string, { k: string; t: string }[]> = {
      free: (free.items || []).map((g: any) => ({ k: 'f' + g.url, t: g.title })),
      asphalt: (asphalt.codes || []).filter((c: any) => !used.has(c.code)).map((c: any) => ({ k: 'a' + c.code, t: c.code })),
      watch: (watch.items || []).filter((w: any) => w.off).map((w: any) => ({ k: 'w' + w.name + w.off, t: `${w.name} -${w.off}%` })),
      sale: steamGames.filter(g => g.off || (g.best && g.usd != null && g.best.usd < g.usd))
        .map(g => ({ k: 'g' + g.id + (g.off || 'x'), t: g.off ? `${g.name} -${g.off}%` : `${g.name} en ${g.best.store}` })),
      bundles: (humble.items || []).filter((b: any) => (b.games || []).some((x: any) => wishedNames.has(norm(typeof x === 'string' ? x : x.n))))
        .map((b: any) => ({ k: 'b' + b.url, t: String(b.name).replace(/\s*\|.*$/, '') })),
      playtest: (playtest.items || []).filter((x: any) => wishedIds.has(x.id)).map((x: any) => ({ k: 't' + x.id, t: x.name })),
    };
    const titles: Record<string, string> = {
      free: 'Juegos gratis', asphalt: 'Códigos de Asphalt', watch: 'Ofertas vigiladas',
      sale: 'Deseados en oferta', bundles: 'Deseados en un bundle', playtest: 'Deseados con demo o playtest',
    };
    const tabs: Record<string, string> = {
      free: 'juegos', asphalt: 'asphalt', watch: 'asphalt', sale: 'juegos', bundles: 'juegos', playtest: 'juegos',
    };
    const firstRun = !Array.isArray(data.notified);
    const done = new Set<string>(data.notified || []);
    for (const [group, list] of Object.entries(groups)) {
      const fresh = list.filter(x => !done.has(x.k));
      fresh.forEach(x => done.add(x.k));
      if (firstRun || !want[group] || !fresh.length) continue;
      const body = fresh.slice(0, 3).map(x => x.t).join(' · ') + (fresh.length > 3 ? ` y ${fresh.length - 3} más` : '');
      const payload = { title: `${titles[group]} (${fresh.length})`, body, url: PANEL + '#' + tabs[group], tag: group };
      for (const sub of userSubs) if (await pushPayload(sub.subscription, payload, sub.endpoint)) sent++;
    }
    data.notified = [...done].slice(-800);

    if (want.stores && storeAlerts.length) {
      const total = storeAlerts.reduce((count, item) => count + item.promos.length, 0);
      const body = storeAlerts.slice(0, 3).map(item => {
        const promotion = item.promos[0];
        const cards = Array.isArray(promotion.cards) && promotion.cards.length ? ' · ' + promotion.cards.slice(0, 3).join(', ') : '';
        return item.name + ': -' + promotion.discountPercent + '% con ' + (promotion.bankShort || 'tarjeta') + cards;
      }).join(' | ') + (storeAlerts.length > 3 ? ' y otros locales' : '');
      const payload = {
        title: 'Descuento en local seguido (' + total + ')',
        body,
        url: PANEL + '#tarjetas',
        tag: 'store-follow-discounts',
      };
      for (const sub of userSubs) if (await pushPayload(sub.subscription, payload, sub.endpoint)) sent++;
    }



    const targets = targetAlerts.get(userId) || [];
    if (want.price && targets.length) {
      const body = targets.slice(0,3).map(a =>
        `${a.name}: ${money(a.price)} (objetivo ${money(a.targetPrice)}) · ${a.shop}`
      ).join(' | ') + (targets.length > 3 ? ` y ${targets.length - 3} más` : '');
      const payload = {
        title: `Llegó al precio objetivo (${targets.length})`,
        body,
        url: PANEL + '#tarjetas',
        tag: 'wishlist-target',
      };
      for (const sub of userSubs) if (await pushPayload(sub.subscription, payload, sub.endpoint)) sent++;
    }

    const alerts = priceAlerts.get(userId) || [];
    if (want.price && alerts.length) {
      const body = alerts.slice(0, 3).map(a => `${a.name}: ${money(a.price)} (antes ${money(a.previous)}) · ${a.shop}`)
        .join(' | ') + (alerts.length > 3 ? ` y ${alerts.length - 3} más` : '');
      const payload = { title: `Bajó de precio (${alerts.length})`, body, url: PANEL + '#tarjetas', tag: 'wishlist-price' };
      for (const sub of userSubs) if (await pushPayload(sub.subscription, payload, sub.endpoint)) sent++;
    }

    // Mantiene categorías y avisos históricos; nunca guarda las suscripciones aquí.
    delete data.push;
    await db('panel_profiles?user_id=eq.' + encodeURIComponent(userId), {
      method: 'PATCH',
      body: JSON.stringify({ data }),
    });
  }

  return json({
    ok: true,
    users,
    sent,
    checkedQueries,
    updatedItems,
    priceAlerts: [...priceAlerts.values()].reduce((n, x) => n + x.length, 0),
  });
});