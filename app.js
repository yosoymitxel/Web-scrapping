const REDEEM = 'https://www.gameloft.com/redeem/asphalt-legends?playerId=u-79g1efe';
const PROMOS = 'https://yosoymitxel.github.io/promociones-tarjetas-bancos-paraguay-py/promos.json';
// Si el CDN no carga, la página funciona igual sin animaciones
const motion = await import('https://cdn.jsdelivr.net/npm/motion@11.11.13/+esm').catch(() => null);
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const reveal = (sel, root = document) => {
  if (!motion || still) return;
  const els = root.querySelectorAll(sel);
  if (els.length) motion.animate(els, { opacity: [0, 1], y: [14, 0] }, { duration: .5, delay: motion.stagger(.035, { startDelay: .05 }), ease: [.22, 1, .36, 1] });
};

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const store = {
  get: (k, d = []) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const load = n => fetch(`data/${n}.json?${Date.now() / 6e5 | 0}`).then(r => r.json()).catch(() => ({}));
const since = iso => {
  if (!iso) return '';
  const h = (Date.now() - new Date(iso)) / 36e5;
  return 'Actualizado ' + (h < 1 ? 'hace minutos' : h < 24 ? `hace ${h | 0} h` : `hace ${h / 24 | 0} d`);
};
const day = s => s ? new Date(s + 'T12:00').toLocaleDateString('es', { day: 'numeric', month: 'short' }) : '';
const empty = msg => `<div class="empty">${msg}</div>`;
const icon = id => `<svg class="ic"><use href="#i-${id}"/></svg>`;
let toastT;
const toast = msg => { const t = $('toast'); t.innerHTML = icon('check') + esc(msg); t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1800); };

const [as, fx, fr, wl, hb] = await Promise.all(['asphalt', 'fx', 'free', 'wishlist', 'humble'].map(load));

// Dólar: un solo tipo de cambio para todos los precios
const R = fx.PYG || 0;
const fmt = n => '₲ ' + Math.round(n).toLocaleString('es-PY');
const gs = usd => R ? fmt(usd * R) : '';
if (R && motion && !still) motion.animate(0, R, { duration: 1, ease: [.22, 1, .36, 1], onUpdate: v => $('rate').textContent = fmt(v) });
else $('rate').textContent = R ? fmt(R) : '—';
$('fxBtn').title = since(fx.at);
$('fxBtn').onclick = () => {
  const open = $('fxBox').hidden;
  $('fxBox').hidden = !open;
  $('fxBtn').setAttribute('aria-expanded', open);
  if (open) { $('usd').focus(); motion?.animate('#fxBox', { opacity: [0, 1], y: [-6, 0] }, { duration: .25 }); }
};
$('usd').oninput = e => $('pyg').value = e.target.value ? Math.round(e.target.value * R) : '';
$('pyg').oninput = e => $('usd').value = e.target.value ? (e.target.value / R).toFixed(2) : '';

// Pestañas por hash
const views = ['juegos', 'tarjetas', 'asphalt'];
const route = () => {
  const v = views.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'juegos';
  views.forEach(id => $('v-' + id).classList.toggle('on', id === v));
  document.querySelectorAll('.tabs a').forEach(a => a.hash === '#' + v ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  reveal(['.hero', '.row-head', '.code', '.tile', '.game', '.promo'].map(c => `#v-${v} ${c}`).join());
  scrollTo({ top: 0 });
};
addEventListener('hashchange', route);

// Asphalt: el siguiente código en grande; un toque copia y abre el canje
// Perfil privado en Supabase (RLS: cada uno ve lo suyo). Sin sesión, queda en el navegador.
const SB = 'https://fxjhuodttsbcyncpkcxb.supabase.co', SBK = 'sb_publishable_LWVoByppthU1ihW1LvqdNA_CfSA2chx';
const sb = async (path, opt = {}, tok) => {
  const r = await fetch(SB + path, { ...opt, headers: { apikey: SBK, 'Content-Type': 'application/json', ...(tok && { Authorization: 'Bearer ' + tok }), ...opt.headers } });
  const d = r.status === 204 ? null : await r.json().catch(() => null);
  if (!r.ok) throw new Error(d?.msg || d?.message || d?.error_description || r.status);
  return d;
};
let sess = store.get('panel.sess', null);
const token = async () => {
  if (!sess) return null;
  if (Date.now() > sess.until) {
    try { const d = await sb('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: sess.refresh }) }); sess = { token: d.access_token, refresh: d.refresh_token, until: Date.now() + (d.expires_in - 60) * 1e3, email: d.user.email }; store.set('panel.sess', sess); }
    catch { sess = null; store.set('panel.sess', null); return null; }
  }
  return sess.token;
};
const profile = store.get('panel.profile', { links: [], used: [] });
const saveProfile = async () => {
  store.set('panel.profile', profile);
  const t = await token(); if (!t) return;
  sb('/rest/v1/panel_profiles?on_conflict=user_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ data: profile, updated_at: new Date().toISOString() }) }, t).catch(e => toast('Nube: ' + e.message));
};
const pull = async () => {
  const t = await token(); if (!t) return;
  const [row] = await sb('/rest/v1/panel_profiles?select=data', {}, t).catch(() => []);
  if (row?.data) Object.assign(profile, row.data); else saveProfile();
  store.set('panel.profile', profile);
};
await pull();
const drawAcct = () => $('acct').textContent = sess ? sess.email + ' · Salir' : 'Entrar';
$('acct').onclick = () => { if (sess) { sess = null; store.set('panel.sess', null); drawAcct(); } else $('login').hidden = !$('login').hidden; };
$('login').onsubmit = async e => {
  e.preventDefault();
  try {
    const d = await sb('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: e.target.email.value, password: e.target.pass.value }) });
    sess = { token: d.access_token, refresh: d.refresh_token, until: Date.now() + (d.expires_in - 60) * 1e3, email: d.user.email };
    store.set('panel.sess', sess); $('login').hidden = true; await pull(); location.reload();
  } catch (err) { toast(err.message); }
};
drawAcct();
const drawLinks = () => $('links').innerHTML = profile.links.map((l, i) => `<a class="lk" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.name)}<button data-del="${i}" aria-label="Quitar">×</button></a>`).join('');
$('links').onclick = e => { const i = e.target.dataset.del; if (i != null) { e.preventDefault(); profile.links.splice(i, 1); drawLinks(); saveProfile(); } };
$('addLink').onsubmit = e => { e.preventDefault(); profile.links.push({ name: e.target.name.value, url: e.target.url.value }); e.target.reset(); drawLinks(); saveProfile(); };
drawLinks();

const used = new Set([...store.get('used'), ...(profile.used || [])]);
const seen = new Set(store.get('seen'));
const isNew = c => seen.size && !seen.has(c.code);
const redeemBtn = (code, cls = '') => `<button class="btn ${cls}" data-c="${esc(code)}" aria-label="Canjear ${esc(code)}">${icon('copy')}<span>Canjear</span></button>`;
const drawCodes = () => {
  const list = as.codes || [];
  const todo = list.filter(c => !used.has(c.code)).sort((a, b) => isNew(b) - isNew(a));
  const done = list.filter(c => used.has(c.code));
  const [next, ...rest] = todo;
  $('asHero').innerHTML = next
    ? `<span class="tagline" style="color:var(--mut)">${isNew(next) ? '<span class="pill ac">Nuevo</span>' : ''}${todo.length} por canjear · ${esc(since(as.at))}</span>
       <div class="big">${esc(next.code)}</div>${next.reward ? `<p class="reward">${esc(next.reward)}</p>` : ''}
       <div class="act">${redeemBtn(next.code)}</div>`
    : `<div class="big">Al día</div><p class="reward">${list.length ? 'Todos canjeados. Los nuevos aparecen acá solos.' : 'Sin datos todavía.'}</p>`;
  $('codes').innerHTML = rest.map(c => `<li class="code">${isNew(c) ? '<span class="new" title="Nuevo"></span>' : ''}<b>${esc(c.code)}</b>${redeemBtn(c.code, 'sm ghost')}</li>`).join('');
  $('codes').previousElementSibling.hidden = !rest.length;
  $('done').innerHTML = done.map(c => `<li class="code"><b>${esc(c.code)}</b><button class="btn sm ghost" data-undo="${esc(c.code)}">Deshacer</button></li>`).join('');
  $('doneBox').hidden = !done.length;
  $('nDone').textContent = done.length;
  $('nAs').textContent = todo.length || '';
  $('allDone').hidden = todo.length < 5;
};
drawCodes();
store.set('seen', (as.codes || []).map(c => c.code));
$('allDone').onclick = () => { (as.codes || []).forEach(c => used.add(c.code)); store.set('used', [...used]); profile.used = [...used]; saveProfile(); drawCodes(); toast('Todos marcados'); };
$('v-asphalt').addEventListener('click', async e => {
  const b = e.target.closest('button[data-c], button[data-undo]'); if (!b) return;
  if (b.dataset.c) {
    await navigator.clipboard.writeText(b.dataset.c).catch(() => {});
    window.open(REDEEM, 'gameloft');
    used.add(b.dataset.c); toast(`${b.dataset.c} copiado`);
  } else used.delete(b.dataset.undo);
  store.set('used', [...used]); profile.used = [...used]; saveProfile(); drawCodes();
  reveal('#asHero');
});

// Juegos gratis: Steam y Epic primero; el primero va de portada
const free = fr.items || [];
const top = free[0];
if (top) {
  $('frHero').href = top.url;
  $('frHero').innerHTML = `<div class="bg"><img src="${esc(top.img)}" alt="" fetchpriority="high"></div>
    <div class="info"><span class="tagline"><span class="pill ac">Gratis</span><span class="pill">${esc(top.store)}</span>${top.worth ? `<s>${esc(top.worth)}</s>` : ''}${top.end ? `<span>hasta ${day(top.end)}</span>` : ''}</span>
    <h1>${esc(top.title)}</h1><span class="btn">Conseguir</span></div>`;
} else $('frHero').hidden = true;
const groups = ['Todos', ...new Set(free.map(g => g.store))];
let frStore = 'Todos';
const tile = (url, img, title, pill, sub) => `<a class="tile" href="${esc(url)}" target="_blank" rel="noopener">
  <div class="art">${img ? `<img loading="lazy" src="${esc(img)}" alt="" width="300" height="169">` : ''}${pill ? `<span class="pill">${esc(pill)}</span>` : ''}</div>
  <strong>${esc(title)}</strong>${sub ? `<span class="sub">${sub}</span>` : ''}</a>`;
const drawFree = () => {
  $('frChips').innerHTML = groups.length > 2 ? groups.map(s => `<button class="chip" data-s="${esc(s)}" aria-pressed="${s === frStore}">${esc(s)}<i>${s === 'Todos' ? free.length : free.filter(g => g.store === s).length}</i></button>`).join('') : '';
  const list = free.filter(g => (frStore === 'Todos' ? g !== top : g.store === frStore));
  $('free').innerHTML = list.map(g => tile(g.url, g.img, g.title, g.store, [g.worth && `<s>${esc(g.worth)}</s>`, g.end && `hasta ${day(g.end)}`].filter(Boolean).join(' · '))).join('')
    || empty(free.length ? 'Nada en esta tienda.' : 'Sin datos todavía.');
};
$('frChips').onclick = e => { const s = e.target.closest('[data-s]')?.dataset.s; if (s) { frStore = s; drawFree(); reveal('#free .tile'); } };
drawFree();

// Deseados: precio Steam (región PY) y la tienda más barata, en ₲
const games = (wl.games || []).slice().sort((a, b) => b.off - a.off || (a.usd ?? 1e9) - (b.usd ?? 1e9));
// Oculto: lo ya visto, en todos los paneles (perfil)
const hidden = new Set(profile.hidden || []);
const hide = k => { hidden.add(k); profile.hidden = [...hidden]; saveProfile(); };
document.addEventListener('click', e => {
  const b = e.target.closest('[data-hide]'); if (!b) return;
  e.preventDefault(); hide(b.dataset.hide); b.closest('article, .tile')?.remove(); toast('Oculto');
});
const hideBtn = k => `<button class="hide" data-hide="${esc(k)}" aria-label="Ocultar">×</button>`;
const card = g => {
  const q = encodeURIComponent(g.name);
  const alt = g.best && g.usd != null && g.best.usd < g.usd;
  const usd = alt ? g.best.usd : g.usd;
  const where = alt ? g.best.store : 'Steam';
  return `<article class="game">
    <a class="art" href="${alt ? esc(g.best.url) : `https://store.steampowered.com/app/${g.id}`}" target="_blank" rel="noopener"><img loading="lazy" src="${esc(g.img || `https://cdn.akamai.steamstatic.com/steam/apps/${g.id}/capsule_231x87.jpg`)}" alt="" width="460" height="215">${g.off ? `<span class="pill ac">-${g.off}%</span>` : ''}</a>
    ${hideBtn('g' + g.id)}
    <div class="body">
      <span class="name">${esc(g.name)}</span>
      <div class="now">${g.free ? 'Gratis' : usd == null ? '—' : R ? gs(usd) : '$' + usd.toFixed(2)}</div>
      <small class="low">${esc(where)}${usd != null && R ? ` · $${usd.toFixed(2)}` : ''}${g.low ? ` · mín ${R ? gs(g.low.usd) : '$' + g.low.usd}` : ''}</small>
      <div class="go"><a href="https://steamdb.info/app/${g.id}/" target="_blank" rel="noopener">SteamDB</a><a href="https://www.eneba.com/latam/store/all?text=${q}" target="_blank" rel="noopener">Eneba</a><a href="https://www.humblebundle.com/store/search?search=${q}" target="_blank" rel="noopener">Humble</a></div>
    </div></article>`;
};
const drawWl = () => {
  const q = $('wlq').value.trim().toLowerCase(), sale = $('wlSale').getAttribute('aria-pressed') === 'true';
  const list = games.filter(g => !hidden.has('g' + g.id) && g.name.toLowerCase().includes(q) && (!sale || g.off || (g.best && g.best.usd < g.usd)));
  $('wl').innerHTML = list.map(card).join('')
    || empty(games.length ? 'Ninguno coincide.' : 'Sin datos todavía. La lista de deseados de Steam tiene que ser pública.');
};
$('wlq').oninput = drawWl;
$('wlSale').onclick = e => { const b = e.currentTarget; b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true'); drawWl(); reveal('#wl .game'); };
drawWl();

// Bundles de Humble
const norm = t => (t || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const wished = new Map(games.map(g => [norm(g.name), g]));
const bundles = (hb.items || []).filter(b => !hidden.has('b' + b.url)).map(b => ({ ...b, hits: (b.games || []).filter(n => wished.has(norm(n))) }))
  .sort((a, b) => b.hits.length - a.hits.length);
$('hb').innerHTML = bundles.map(b => `<article class="tile">
  <a class="art" href="${esc(b.url)}" target="_blank" rel="noopener">${b.img ? `<img loading="lazy" src="${esc(b.img)}" alt="">` : ''}${b.hits.length ? `<span class="pill ac">${b.hits.length} deseado${b.hits.length > 1 ? 's' : ''}</span>` : ''}</a>
  ${hideBtn('b' + b.url)}
  <strong>${esc(b.name)}</strong><span class="sub">${[b.price && (R ? gs(b.price) : '$' + b.price), b.end && 'hasta ' + day(b.end)].filter(Boolean).join(' · ')}</span>
  ${b.games?.length ? `<details class="inc"><summary>${b.games.length} juegos</summary><ul>${b.games.map(n => { const w = wished.get(norm(n)); return `<li${w ? ' class="hit"' : ''}>${esc(n)}${w && w.usd ? ` <small>${gs(w.usd)}</small>` : ''}</li>`; }).join('')}</ul></details>` : ''}
</article>`).join('') || empty('Sin datos todavía.');
$('gmAt').textContent = since(wl.at || fr.at);

// Tarjetas: busca en PromoScraper (se actualiza a diario)
let promos;
const recent = store.get('recent');
const drawRecent = () => $('recent').innerHTML = recent.map(r => `<button class="chip" data-q="${esc(r)}">${esc(r)}</button>`).join('');
const search = async q => {
  q = q.trim(); if (!q) return;
  const ql = q.toLowerCase();
  document.querySelector('#tq input').value = q;
  $('tjt').href = 'https://tarjetea.com.py/stores?q=' + encodeURIComponent(q);
  $('promos').innerHTML = '<div class="skel"></div><div class="skel"></div>';
  promos ??= await fetch(PROMOS).then(r => r.json()).catch(() => null);
  if (!promos) { $('promos').innerHTML = empty('No se pudo leer PromoScraper. Probá en Tarjeteá.'); promos = undefined; return; }
  // Primero por nombre del comercio; la descripción solo si no hay ninguno
  const byTitle = promos.filter(p => p.title?.toLowerCase().includes(ql));
  const mine = new Set(profile.cards || []);
  const hit = (byTitle.length ? byTitle : promos.filter(p => p.desc?.toLowerCase().includes(ql)))
    .sort((a, b) => mine.has(b.bankShort) - mine.has(a.bankShort) || (b.discount_percent || 0) - (a.discount_percent || 0));
  drawBanks();
  $('promos').innerHTML = hit.filter(p => !hidden.has('p' + p.id)).slice(0, 40).map(p => `<article class="promo">
    ${p.img ? `<img class="pimg" loading="lazy" src="${esc(p.img)}" alt="">` : `<span class="bank" style="background:${esc(p.bankColor || '#555')}">${esc(p.bankShort)}</span>`}
    <div style="min-width:0"><strong>${esc(p.title)}</strong>
      <small>${esc([p.img ? p.bankShort : '', (p.days || []).join(', '), p.installments ? `${p.installments} cuotas` : ''].filter(Boolean).join(' · ') || (p.category || '').replace(/^\W+/, ''))}</small>
      <small class="src"><a href="${esc(p.href)}" target="_blank" rel="noopener">Bases · ${esc(p.bankShort)}</a> · <a href="https://www.google.com/maps/search/${encodeURIComponent(p.title + ' Paraguay')}" target="_blank" rel="noopener">Mapa</a></small></div>
    <span class="pct">${p.discount_percent ? p.discount_percent + '%' : ''}</span>${hideBtn('p' + p.id)}</article>`).join('')
    || empty(`Sin promos para «${esc(q)}».`);
  reveal('#promos .promo');
  recent.splice(0, recent.length, q, ...recent.filter(r => r.toLowerCase() !== ql).slice(0, 7));
  store.set('recent', recent); drawRecent();
};
// Mis tarjetas: sus promos van primero; se guardan en el perfil
const drawBanks = () => {
  if (!promos) return;
  const mine = new Set(profile.cards || []);
  $('myBanks').innerHTML = [...new Set(promos.map(p => p.bankShort))].sort().map(b => `<button class="chip" data-b="${esc(b)}" aria-pressed="${mine.has(b)}">${esc(b)}</button>`).join('');
};
$('myBanks').onclick = e => {
  const b = e.target.dataset.b; if (!b) return;
  const mine = new Set(profile.cards || []);
  mine.has(b) ? mine.delete(b) : mine.add(b);
  profile.cards = [...mine]; saveProfile(); drawBanks();
  const q = document.querySelector('#tq input').value; if (q) search(q);
};
$('tq').onsubmit = e => { e.preventDefault(); search(e.target.q.value); };
$('recent').onclick = e => e.target.dataset.q && search(e.target.dataset.q);
drawRecent();

route();

// Productos: abre el buscador de cada tienda (sin scraping)
const GENERAL = [['Rebuscate','https://rebuscate.com/?q=']];
const SHOPS = [['Nissei','https://nissei.com/py/catalogsearch/result/?q='],['Tienda Naranja','https://tiendanaranja.com.py/catalogsearch/result/?q='],['Contimarket','https://www.contimarket.com/search?Box=False&q='],['Compulandia','https://www.compulandia.com.py/py/store?q='],['Visuar','https://visuar.com.py/searchiqit?s='],['Tecnoga','https://tecnoga.com.py/?post_type=product&s='],['Innovagame','https://www.innovagame.com.py/busqueda?controller=search&s='],['Compras Paraguai','https://www.comprasparaguai.com.br/busca/?q=']];
$('pq').onsubmit = e => { e.preventDefault(); const q = encodeURIComponent(e.target.q.value.trim()); if (!q) return;
  const row = (t, l) => `<span class="mut">${t}</span>` + l.map(([n, u]) => `<a class="chip" href="${u}${q}" target="_blank" rel="noopener">${n}</a>`).join('');
  $('shops').innerHTML = `<div class="chips">${row('General', GENERAL)}</div><div class="chips">${row('Electro', SHOPS)}</div>`; };

const watch = await load('watch');
$('watch').innerHTML = (watch.items || []).filter(w => w.off).map(w => `<a class="lk" href="${esc(w.url)}" target="_blank" rel="noopener">${esc(w.name)}<span class="pill ac">-${w.off}%</span></a>`).join('');
