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
const store_ttl = (k, ttl) => { const c = store.get(k, null); return c && Date.now() - c.t < ttl ? c.data : null; };
const paged = (box, items, render, none, n = 12) => {
  let b = box.nextElementSibling; if (!b?.classList.contains('more')) { b = document.createElement('button'); b.className = 'chip more'; b.type = 'button'; box.after(b); }
  let shown = n;
  const draw = () => { box.innerHTML = items.slice(0, shown).map(render).join('') || none; b.hidden = shown >= items.length; b.textContent = `Ver más (${items.length - shown})`; };
  b.onclick = () => { shown += n; draw(); };
  draw();
};
const empty = msg => `<div class="empty">${msg}</div>`;
const icon = id => `<svg class="ic"><use href="#i-${id}"/></svg>`;
const A = (href, label, cls = '') => `<a${cls ? ` class="${cls}"` : ''} href="${esc(href)}" target="_blank" rel="noopener">${label}${icon('link')}</a>`;
const im = (src, name, extra = '') => src ? `<img loading="lazy" src="${esc(src)}" alt="" data-ph="${esc(name)}"${extra ? ' ' + extra : ''}>` : `<span class="ph">${esc(name)}</span>`;
// Imagen rota: tarjeta con el nombre en lugar del ícono roto
addEventListener('error', e => {
  const i = e.target; if (i?.tagName !== 'IMG') return;
  const ph = document.createElement('span'); ph.className = 'ph';
  ph.textContent = i.dataset.ph || (() => { try { return new URL(i.src).hostname.replace(/^www\./, ''); } catch { return ''; } })();
  i.replaceWith(ph);
}, true);
// Fin de oferta: cuenta regresiva que se refresca sola
const endAt = b => b.endAt ? new Date(/(Z|[+-]\d\d:?\d\d)$/.test(b.endAt) ? b.endAt : b.endAt + 'Z') : b.end ? new Date(b.end + 'T23:59:59') : null;
const endInfo = t => {
  if (!t || isNaN(t)) return null;
  const ms = t - Date.now();
  if (ms <= 0) return { txt: 'Terminado', cls: 'off' };
  if (ms < 6 * 36e5) return { txt: 'Últimas horas', cls: 'hot' };
  const m = Math.floor(ms / 6e4), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60);
  return { txt: 'Termina en ' + (d ? `${d} d ${h} h` : `${h} h`), cls: ms < 48 * 36e5 ? 'soon' : '' };
};
const endTag = b => { const t = endAt(b), i = endInfo(t); return i ? `<span class="end ${i.cls}" data-end="${t.getTime()}">${i.txt}</span>` : ''; };
setInterval(() => document.querySelectorAll('[data-end]').forEach(el => { const i = endInfo(new Date(+el.dataset.end)); if (i) { el.textContent = i.txt; el.className = 'end ' + i.cls; } }), 6e4);
const num = v => { const n = typeof v === 'string' ? parseFloat(v.replace(/[^0-9.]/g, '')) : v; return Number.isFinite(n) ? n : null; };
let toastT;
const toast = msg => { const t = $('toast'); t.innerHTML = icon('check') + esc(msg); t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1800); };

const [as, fx, fr, hb, pt, cn, sh] = await Promise.all(['asphalt', 'fx', 'free', 'humble', 'playtest', 'cines', 'shoppings'].map(load));

// Pestañas por hash
const views = ['juegos', 'tarjetas', 'cine', 'asphalt'];
const route = () => {
  const v = views.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'juegos';
  views.forEach(id => $('v-' + id).classList.toggle('on', id === v));
  document.querySelectorAll('.tabs a').forEach(a => a.hash === '#' + v ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  reveal(['.hero', '.row-head', '.code', '.tile', '.game', '.promo'].map(c => `#v-${v} ${c}`).join());
  if (v === 'tarjetas') getPromos().then(drawBanks);
  scrollTo({ top: 0 });
};
addEventListener('hashchange', route);

// Asphalt: el siguiente código en grande; un toque copia y abre el canje
// Perfil privado en Supabase (RLS: cada uno ve lo suyo). Sin sesión, queda en el navegador.
const SB = 'https://uxhftljmnljmtyynzyie.supabase.co', SBK = 'sb_publishable_-SUBO7VrZiXyeWFRoXzZ9Q_4Vm5xS3g';
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
const profile = { links: [], used: [], cards: [], hidden: [], steam: '', cur: 'PYG', ...store.get('panel.profile', {}) };
const saveProfile = async () => {
  store.set('panel.profile', profile);
  const t = await token(); if (!t) return;
  return sb('/rest/v1/panel_profiles?on_conflict=user_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ data: profile, updated_at: new Date().toISOString() }) }, t).catch(e => toast('Nube: ' + e.message));
};
const pull = async () => {
  const t = await token(); if (!t) return;
  const [row] = await sb('/rest/v1/panel_profiles?select=data', {}, t).catch(() => []);
  if (row?.data) Object.assign(profile, row.data); else saveProfile();
  store.set('panel.profile', profile);
};
// Volver del correo (confirmar cuenta o cambiar contraseña): el enlace trae la sesión en el hash
let recovery = false;
{
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('access_token')) {
    history.replaceState(null, '', location.pathname);
    try {
      const u = await sb('/auth/v1/user', {}, h.get('access_token'));
      sess = { token: h.get('access_token'), refresh: h.get('refresh_token'), until: Date.now() + (+h.get('expires_in') - 60) * 1e3, email: u.email };
      store.set('panel.sess', sess); recovery = h.get('type') === 'recovery';
    } catch {}
  }
}
await pull();
const SITE = 'https://yosoymitxel.github.io/Web-scrapping/';
const setSess = d => { sess = { token: d.access_token, refresh: d.refresh_token, until: Date.now() + (d.expires_in - 60) * 1e3, email: d.user.email }; store.set('panel.sess', sess); };
const loginMsg = t => $('loginMsg').textContent = t;
const drawAcct = () => {
  $('acctLbl').textContent = sess ? sess.email.split('@')[0] : 'Entrar';
  $('login').hidden = !!sess; $('me').hidden = !sess; $('logout').hidden = !sess;
  $('meMail').textContent = sess?.email || '';
};
$('login').onsubmit = async e => {
  e.preventDefault();
  const email = e.target.email.value.trim(), pass = e.target.pass.value, up = e.submitter?.value === 'up';
  if (pass.length < 6) return loginMsg('La contraseña necesita 6 caracteres o más.');
  try {
    if (up) {
      const d = await sb('/auth/v1/signup?redirect_to=' + encodeURIComponent(SITE), { method: 'POST', body: JSON.stringify({ email, password: pass }) });
      if (!d.access_token) return loginMsg('Cuenta creada. Confirmá el enlace que llegó a tu correo y después entrá acá.');
      setSess(d);
    } else setSess(await sb('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password: pass }) }));
    await pull(); location.reload();
  } catch (err) { loginMsg(err.message); }
};
$('forgot').onclick = async () => {
  const email = $('login').email.value.trim();
  if (!email) return loginMsg('Escribí tu correo y tocá de nuevo.');
  try { await sb('/auth/v1/recover?redirect_to=' + encodeURIComponent(SITE), { method: 'POST', body: JSON.stringify({ email }) }); loginMsg('Te enviamos un enlace para elegir otra contraseña.'); }
  catch (err) { loginMsg(err.message); }
};
$('setPass').onclick = async () => {
  const p = $('newPass').value;
  if (p.length < 6) return toast('Mínimo 6 caracteres');
  try { await sb('/auth/v1/user', { method: 'PUT', body: JSON.stringify({ password: p }) }, await token()); $('newPass').value = ''; toast('Contraseña cambiada'); }
  catch (err) { toast(err.message); }
};
$('logout').onclick = () => { sess = null; store.set('panel.sess', null); $('prof').close(); location.reload(); };
drawAcct();
if (recovery) { $('prof').showModal(); $('newPass').focus(); }

// Moneda del perfil: un solo tipo de cambio para todos los precios
const CURS = { PYG: ['₲', 0], ARS: ['AR$', 2], BRL: ['R$', 2], EUR: ['€', 2], USD: ['US$', 2] };
const cur = CURS[profile.cur] ? profile.cur : 'PYG';
const [SYM, DEC] = CURS[cur];
const R = cur === 'USD' ? 1 : fx[cur] || 0;
const fmt = n => SYM + ' ' + n.toLocaleString('es-PY', { minimumFractionDigits: DEC, maximumFractionDigits: DEC });
const gs = usd => R ? fmt(usd * R) : '';
const usdS = n => 'US$ ' + n.toLocaleString('es-PY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = usd => usd == null ? '' : R ? gs(usd) : usdS(usd);
const worth = w => { const n = num(w); return n == null ? w : money(n); };
const pygS = n => '₲ ' + Math.round(n).toLocaleString('es-PY');
// Único formato de precio: principal en la moneda del perfil; abajo el original si difiere; mínimo solo si es menor
const priceBox = ({ usd = null, pyg = null, min = null, was = null, off = 0, extra = '' }) => {
  const u = usd ?? (pyg != null && fx.PYG ? pyg / fx.PYG : null);
  const conv = R && u != null;
  const main = conv ? money(u) : pyg != null ? pygS(pyg) : usdS(usd);
  const orig = !conv ? '' : pyg != null ? (cur === 'PYG' ? '' : pygS(pyg)) : (cur === 'USD' ? '' : usdS(usd));
  const mn = min != null && u != null && min < u && money(min) !== main ? 'mín. ' + money(min) : '';
  const wu = was == null ? null : usd != null ? was : fx.PYG ? was / fx.PYG : null;
  const wasT = wu != null && wu > u ? `<small class="was"><s>${money(wu)}</s>${off ? ` <b>-${off}%</b>` : ''}</small>` : '';
  return `<div class="px"><b class="now">${main}</b>${orig ? `<small>${orig}</small>` : ''}${wasT}${mn ? `<small class="min">${mn}</small>` : ''}${extra}</div>`;
};
if (R && motion && !still) motion.animate(0, R, { duration: 1, ease: [.22, 1, .36, 1], onUpdate: v => $('rate').textContent = fmt(v) });
else $('rate').textContent = R ? fmt(R) : 'Sin cotización';
$('fxBtn').title = since(fx.at);
$('curSym').textContent = SYM;
$('fxBtn').onclick = () => {
  const open = $('fxBox').hidden;
  $('fxBox').hidden = !open;
  $('fxBtn').setAttribute('aria-expanded', open);
  if (open) { $('usd').focus(); motion?.animate('#fxBox', { opacity: [0, 1], y: [-6, 0] }, { duration: .25 }); }
};
$('usd').oninput = e => $('pyg').value = e.target.value ? +(e.target.value * R).toFixed(DEC) : '';
$('pyg').oninput = e => $('usd').value = e.target.value ? (e.target.value / R).toFixed(2) : '';

// Hoja de perfil: Steam, moneda y bancos
$('curSel').innerHTML = Object.entries(CURS).map(([k, [s]]) => `<option value="${k}"${k === cur ? ' selected' : ''}>${k} (${s})</option>`).join('');
const openProf = () => { $('steamUser').value = profile.steam || ''; drawBanks(); getPromos().then(drawBanks); $('prof').showModal(); };
$('acctBtn').onclick = openProf;
document.addEventListener('click', e => { if (e.target.closest('[data-prof]')) openProf(); });
$('profHid').onclick = () => { $('prof').close(); $('hidBox').open = true; location.hash === '#asphalt' ? route() : location.hash = 'asphalt'; setTimeout(() => $('hidBox').scrollIntoView({ block: 'center' }), 50); };
$('profClose').onclick = () => $('prof').close();
$('prof').addEventListener('click', e => { if (e.target === $('prof')) $('prof').close(); });
$('profSave').onclick = async () => {
  const steam = $('steamUser').value.trim().replace(/^.*steamcommunity\.com\/(?:id|profiles)\/([^/?#]+).*$/i, '$1').replace(/\/$/, '');
  const changed = steam !== profile.steam || $('curSel').value !== profile.cur;
  Object.assign(profile, { steam, cur: $('curSel').value });
  await saveProfile(); $('prof').close();
  if (changed) location.reload(); else toast('Guardado');
};
const drawLinks = () => $('links').innerHTML = profile.links.map((l, i) => `<div class="lk">${A(l.url, esc(l.name))}<button data-del="${i}" aria-label="Quitar ${esc(l.name)}">${icon('x')}</button></div>`).join('');
$('links').onclick = e => { const i = e.target.closest('[data-del]')?.dataset.del; if (i != null) { profile.links.splice(i, 1); drawLinks(); saveProfile(); } };
$('addLink').onsubmit = e => { e.preventDefault(); profile.links.push({ name: e.target.name.value.trim(), url: e.target.url.value }); e.target.reset(); e.target.closest('details').open = false; drawLinks(); saveProfile(); toast('Enlace agregado'); };
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
  paged($('codes'), rest, c => `<li class="code">${isNew(c) ? '<span class="new" title="Nuevo"></span>' : ''}<b>${esc(c.code)}</b>${redeemBtn(c.code, 'sm ghost')}</li>`, '');
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

// Oculto: lo ya visto, en todos los paneles (perfil)
const hidden = new Set(profile.hidden || []);
profile.hnames ||= {};
const redrawAll = [];
const drawHidden = () => {
  const keys = [...hidden];
  $('profHid').hidden = !keys.length; $('hidBox').hidden = !keys.length; $('nHid').textContent = keys.length || '';
  $('hidList').innerHTML = keys.map(k => `<li><span>${esc(profile.hnames[k] || k.slice(1).replace(/^https?:\/\/(www\.)?/, ''))}</span><button class="link" data-show="${esc(k)}" aria-label="Mostrar ${esc(profile.hnames[k] || '')}">Mostrar</button></li>`).join('');
};
const unhide = ks => { ks.forEach(k => { hidden.delete(k); delete profile.hnames[k]; }); profile.hidden = [...hidden]; saveProfile(); drawHidden(); redrawAll.forEach(f => f()); };
$('hidList').onclick = e => { const k = e.target.dataset.show; if (k) unhide([k]); };
$('hidAll').onclick = () => { unhide([...hidden]); toast('Todo visible'); };
document.addEventListener('click', e => {
  const b = e.target.closest('[data-hide]'); if (!b) return;
  e.preventDefault(); const k = b.dataset.hide;
  hidden.add(k); profile.hidden = [...hidden]; profile.hnames[k] = b.dataset.name || ''; saveProfile();
  b.closest('article')?.remove(); drawHidden(); toast('Oculto · vuelve desde Más');
});
const hideBtn = (k, n = '') => `<button class="hide" data-hide="${esc(k)}" data-name="${esc(n)}" aria-label="Ocultar ${esc(n)}">${icon('x')}</button>`;
drawHidden();
// Juegos gratis: Steam y Epic primero; el primero va de portada
const free = fr.items || [];
const top = free[0];
if (top) {
  $('frHero').href = top.url;
  $('frHero').innerHTML = `<div class="bg">${im(top.img, top.title, 'fetchpriority="high"')}</div>
    <div class="info"><span class="tagline"><span class="pill ac">Gratis</span><span class="pill">${esc(top.store)}</span>${top.worth ? `<s>${esc(worth(top.worth))}</s>` : ''}${top.end ? `<span>hasta ${day(top.end)}</span>` : ''}</span>
    <h1>${esc(top.title)}</h1><span class="btn">Conseguir${icon('link')}</span></div>`;
} else $('frHero').hidden = true;
const groups = ['Todos', ...new Set(free.map(g => g.store))];
let frStore = 'Todos';
const tile = (url, img, title, pill, sub, key) => `<article class="tile"><a href="${esc(url)}" target="_blank" rel="noopener">
  <div class="art">${im(img, title)}${pill ? `<span class="pill">${esc(pill)}</span>` : ''}<span class="ext">${icon('link')}</span></div>
  <strong>${esc(title)}</strong>${sub ? `<span class="sub">${sub}</span>` : ''}</a>${key ? hideBtn(key, title) : ''}</article>`;
const drawFree = () => {
  $('frChips').innerHTML = groups.length > 2 ? groups.map(s => `<button class="chip" data-s="${esc(s)}" aria-pressed="${s === frStore}">${esc(s)}<i>${s === 'Todos' ? free.length : free.filter(g => g.store === s).length}</i></button>`).join('') : '';
  const list = free.filter(g => !hidden.has('f' + g.url) && (frStore === 'Todos' ? g !== top : g.store === frStore));
  $('free').innerHTML = list.map(g => tile(g.url, g.img, g.title, g.store, [g.worth && `<s>${esc(worth(g.worth))}</s>`, g.end && `hasta ${day(g.end)}`].filter(Boolean).join(' · '), 'f' + g.url)).join('')
    || empty(free.length ? 'Nada en esta tienda.' : 'Sin datos todavía.');
};
$('frChips').onclick = e => { const s = e.target.closest('[data-s]')?.dataset.s; if (s) { frStore = s; drawFree(); reveal('#free .tile'); } };
redrawAll.push(() => drawFree());
drawFree();

// Deseados: precio Steam (región PY) y la tienda más barata, en ₲
let games = [], wished = new Map(), wishedId = new Set(), wlAt = '', wlMsg = 'Poné tu usuario de Steam en <button class="link" data-prof>Perfil</button> para ver tus deseados.';
const norm = t => (t || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const setGames = wl => {
  games = (wl.games || []).slice().sort((a, b) => b.off - a.off || (a.usd ?? 1e9) - (b.usd ?? 1e9));
  wished = new Map(games.map(g => [norm(g.name), g]));
  wishedId = new Set(games.map(g => g.id));
  wlAt = wl.at || '';
  stamps();
};
const stamps = () => {
  const set = (id, at) => { $(id).textContent = at ? since(at) : ''; };
  set('atFree', fr.at); set('atWl', wlAt); set('atHb', hb.at); set('atPt', pt.at);
};
const card = g => {
  const q = encodeURIComponent(g.name);
  const alt = g.best && g.usd != null && g.best.usd < g.usd;
  const usd = alt ? g.best.usd : g.usd;
  const px = g.free ? '<div class="px"><b class="now">Gratis</b></div>' : usd == null ? '<div class="px"><b class="now nop">Sin precio</b></div>' : priceBox({ usd, min: g.low?.usd });
  return `<article class="game surf">
    <a class="art" href="${alt ? esc(g.best.url) : `https://store.steampowered.com/app/${g.id}`}" target="_blank" rel="noopener" aria-label="${esc(g.name)} en ${esc(alt ? g.best.store : 'Steam')}">${im(g.img || `https://cdn.akamai.steamstatic.com/steam/apps/${g.id}/capsule_231x87.jpg`, g.name)}${g.off ? `<span class="pill ac">-${g.off}%</span>` : ''}${alt ? `<span class="pill where">${esc(g.best.store)}</span>` : ''}<span class="ext">${icon('link')}</span></a>
    ${hideBtn('g' + g.id, g.name)}
    <div class="body">
      <span class="name">${esc(g.name)}</span>
      ${px}
      <div class="go">${A(`https://steamdb.info/app/${g.id}/`, 'SteamDB')}${A(`https://www.eneba.com/latam/store/all?text=${q}`, 'Eneba')}${A(`https://www.humblebundle.com/store/search?search=${q}`, 'Humble')}</div>
    </div></article>`;
};
const drawWl = () => {
  const q = $('wlq').value.trim().toLowerCase(), sale = $('wlSale').getAttribute('aria-pressed') === 'true';
  const list = games.filter(g => !hidden.has('g' + g.id) && g.name.toLowerCase().includes(q) && (!sale || g.off || (g.best && g.best.usd < g.usd)));
  paged($('wl'), list, card, empty(games.length ? 'Ninguno coincide.' : wlMsg));
};
$('wlq').oninput = drawWl;
$('wlSale').onclick = e => { const b = e.currentTarget; b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true'); drawWl(); reveal('#wl .game'); };
redrawAll.push(() => drawWl());
drawWl();

// Bundles de Humble: juegos de portada en carrusel, deseados primero, precio y mínimo por juego
const isWished = x => wishedId.has(x.steam) || wished.has(norm(x.n));
const drawRails = () => {
const bundles = (hb.items || []).filter(b => !hidden.has('b' + b.url))
  .map(b => { const gs_ = (b.games || []).map(g => typeof g === 'string' ? { n: g } : g); return { ...b, gs: gs_.sort((x, y) => isWished(y) - isWished(x)), hits: gs_.filter(isWished).length }; })
  .sort((a, b) => b.hits - a.hits);
const gameLi = g => {
  const q = encodeURIComponent(g.n), id = g.steam;
  return `<li${isWished(g) ? ' class="hit"' : ''}><span class="cv">${im(g.img || (id ? `https://cdn.akamai.steamstatic.com/steam/apps/${id}/capsule_231x87.jpg` : ''), g.n)}</span><span class="gn">${esc(g.n)}</span><span class="gl">${A(id ? `https://store.steampowered.com/app/${id}` : `https://store.steampowered.com/search/?term=${q}`, 'Steam')}${A(id ? `https://steamdb.info/app/${id}/` : `https://steamdb.info/search/?a=app&q=${q}`, 'SteamDB')}</span></li>`;
};
const over = b => { const t = endAt(b); return t && t < Date.now(); };
bundles.sort((a, b) => over(a) - over(b));
$('hb').innerHTML = bundles.map(b => {
  const n = b.gs.length, p = num(b.price);
  return `<article class="tile bundle surf${over(b) ? ' over' : ''}">
  <a class="art" href="${esc(b.url)}" target="_blank" rel="noopener" aria-label="${esc(b.name)}">${im(b.img, b.name)}${b.hits ? `<span class="pill ac">${b.hits} deseado${b.hits > 1 ? 's' : ''}</span>` : ''}<span class="ext">${icon('link')}</span></a>
  ${hideBtn('b' + b.url, b.name)}
  <div class="body"><strong>${esc(b.name)}</strong>
  ${p ? priceBox({ usd: p, extra: n ? `<small class="pg">≈ ${money(p / n)} por juego</small>` : '' }) : ''}
  ${endTag(b)}
  ${n ? `<details class="inc"><summary>${n} juegos</summary><ul class="glist">${b.gs.map(gameLi).join('')}</ul></details>` : ''}</div>
</article>`; }).join('') || empty('Sin datos todavía.');

// Playtests abiertos; demos solo si el juego está en deseados (deseados primero)
const pts = (pt.items || []).filter(x => !hidden.has('t' + x.id) && (x.status === 'playtest' || wishedId.has(x.id)))
  .sort((a, b) => wishedId.has(b.id) - wishedId.has(a.id));
$('pt').innerHTML = pts.map(x => tile(`https://store.steampowered.com/app/${x.id}/`, x.img, x.name, wishedId.has(x.id) ? 'Deseado' : '', x.status === 'playtest' ? 'Playtest abierto' : 'Demo', 't' + x.id)).join('')
  || empty('Sin playtests ahora.');
stamps();
};
redrawAll.push(() => drawRails());
drawRails();

// Deseados desde la función de Supabase (cachea 6 h en el servidor y acá)
const loadWl = async () => {
  const user = (profile.steam || '').trim();
  if (!user) return;
  const c = store.get('panel.wl', null);
  if (c?.user === user && c.data?.games) { setGames(c.data); drawWl(); drawRails(); if (Date.now() - c.t < 3 * 36e5) return; }
  else $('wl').innerHTML = '<div class="skel"></div><div class="skel"></div>';
  try {
    const r = await fetch(`${SB}/functions/v1/steam-wishlist?user=${encodeURIComponent(user)}`);
    const d = await r.json();
    if (!r.ok || !d.games) throw new Error(d.error || r.status);
    store.set('panel.wl', { user, t: Date.now(), data: d });
    setGames(d);
  } catch (e) { if (!games.length) wlMsg = `No se pudo leer la lista de «${esc(user)}»: ${esc(e.message)}. Tiene que ser pública.`; }
  drawWl(); drawRails(); reveal('#wl .game');
};
loadWl();

// Tarjetas: busca en PromoScraper (se actualiza a diario)
let promos;
const getPromos = async () => {
  if (promos) return promos;
  const hit = store_ttl('panel.promos', 12 * 36e5);
  if (hit) return promos = hit;
  const d = await fetch(PROMOS).then(r => r.json()).catch(() => undefined);
  if (d?.length) store.set('panel.promos', { t: Date.now(), data: d });
  else promos = store.get('panel.promos', null)?.data;
  return promos ??= d;
};
// Shopping donde está el local (listas de locales de cada shopping)
const malls = (sh.items || []).map(m => ({ name: m.name, set: new Set(m.stores.map(norm)) }));
const mall = t => malls.filter(m => m.set.has(norm(t))).map(m => m.name).join(', ');
const recent = store.get('recent');
redrawAll.push(() => lastQ && search(lastQ));
const drawRecent = () => $('recent').innerHTML = recent.map(r => `<button class="chip" data-q="${esc(r)}">${esc(r)}</button>`).join('');
const promoCard = p => `<article class="promo">
    ${p.img ? `<span class="pimgw">${im(p.img, p.title, 'class="pimg"')}</span>` : `<span class="bank" style="background:${esc(p.bankColor || '#555')}">${esc(p.bankShort)}</span>`}
    <div class="pbody"><strong>${esc(p.title)}</strong>${mall(p.title) ? `<small class="mall">${esc(mall(p.title))}</small>` : ''}
      <small>${esc([p.img ? p.bankShort : '', p.when || (p.days || []).join(', '), p.installments ? `${p.installments} cuotas` : ''].filter(Boolean).join(' · ') || (p.category || '').replace(/^\W+/, ''))}</small>${p.cards ? `<small>${esc(p.cards.join(' · '))}</small>` : ''}
</div>
    <span class="pct">${p.discount_percent ? p.discount_percent + '%' : ''}</span>${hideBtn('p' + p.id, p.title)}
    <span class="src">${A(p.href, 'Bases ' + esc(p.bankShort))}${A('https://www.google.com/maps/search/' + encodeURIComponent(p.title + ' ' + (mall(p.title) || 'Paraguay')), icon('pin') + 'Mapa', 'map')}</span></article>`;
let lastQ = '', hits = [], bankF = '';
// Chips de banco: filtro con contador sobre los resultados de la búsqueda
const drawPromos = () => {
  const list = hits.filter(p => !hidden.has('p' + p.id));
  const banks = [...new Set(list.map(p => p.bankShort))].sort();
  $('myBanks').innerHTML = list.length ? ['', ...banks].map(b => `<button class="chip" data-b="${esc(b)}" aria-pressed="${b === bankF}">${esc(b || 'Todos')}<i>${b ? list.filter(p => p.bankShort === b).length : list.length}</i></button>`).join('') : '';
  paged($('promos'), list.filter(p => !bankF || p.bankShort === bankF), promoCard, empty(`Sin promos para «${esc(lastQ)}».`));
};
const search = async q => {
  q = q.trim(); if (!q) return; lastQ = q;
  const ql = q.toLowerCase();
  document.querySelector('#tq input').value = q;
  $('tjt').href = 'https://tarjetea.com.py/stores?q=' + encodeURIComponent(q);
  $('promos').innerHTML = '<div class="skel"></div><div class="skel"></div>';
  $('myBanks').innerHTML = '';
  await getPromos();
  if (!promos) { $('promos').innerHTML = empty('No se pudo leer PromoScraper. Probá en Tarjeteá.'); promos = undefined; return; }
  // Primero por nombre del comercio; la descripción solo si no hay ninguno
  const byTitle = promos.filter(p => p.title?.toLowerCase().includes(ql));
  const mine = new Set(profile.cards || []);
  const hit = (byTitle.length ? byTitle : promos.filter(p => p.desc?.toLowerCase().includes(ql)))
    .sort((a, b) => mine.has(b.bankShort) - mine.has(a.bankShort) || (b.discount_percent || 0) - (a.discount_percent || 0));
  hits = hit; bankF = '';
  drawPromos();
  reveal('#promos .promo');
  recent.splice(0, recent.length, q, ...recent.filter(r => r.toLowerCase() !== ql).slice(0, 7));
  store.set('recent', recent); drawRecent();
};
// Mis tarjetas (perfil): sus promos van primero
const drawBanks = () => {
  if (!promos) return;
  const mine = new Set(profile.cards || []);
  $('profBanks').innerHTML = [...new Set(promos.map(p => p.bankShort))].sort().map(b => `<button class="chip" data-b="${esc(b)}" aria-pressed="${mine.has(b)}">${esc(b)}</button>`).join('');
};
$('profBanks').onclick = e => {
  const b = e.target.closest('[data-b]')?.dataset.b; if (!b) return;
  const mine = new Set(profile.cards || []);
  mine.has(b) ? mine.delete(b) : mine.add(b);
  profile.cards = [...mine]; saveProfile(); drawBanks();
  if (lastQ) search(lastQ);
};
$('myBanks').onclick = e => {
  const b = e.target.closest('[data-b]')?.dataset.b; if (b == null) return;
  bankF = b; drawPromos(); reveal('#promos .promo');
};
$('tq').onsubmit = e => { e.preventDefault(); search(e.target.q.value); };
$('recent').onclick = e => e.target.dataset.q && search(e.target.dataset.q);
drawRecent();

route();

// Productos: abre el buscador de cada tienda (sin scraping)
const GENERAL = [['Rebuscate','https://rebuscate.com/?q=']];
const SHOPS = [['Nissei','https://nissei.com/py/catalogsearch/result/?q='],['Tienda Naranja','https://tiendanaranja.com.py/catalogsearch/result/?q='],['Contimarket','https://www.contimarket.com/search?Box=False&q='],['Compulandia','https://www.compulandia.com.py/py/store?q='],['Visuar','https://visuar.com.py/searchiqit?s='],['Tecnoga','https://tecnoga.com.py/?post_type=product&s='],['Innovagame','https://www.innovagame.com.py/busqueda?controller=search&s='],['Compras Paraguai','https://www.comprasparaguai.com.br/busca/?q=']];
const prodCard = p => {
  const off = p.off || (p.old > p.price ? Math.round((1 - p.price / p.old) * 100) : 0);
  return `<a class="pcard surf" href="${esc(p.url)}" target="_blank" rel="noopener"><span class="pph">${im(p.img, p.name, 'referrerpolicy="no-referrer"')}</span><span class="pname">${esc(p.name)}</span>${priceBox({ pyg: p.price, was: p.old > p.price ? p.old : null, off })}<span class="mut pshop">${esc(p.shop)}${icon('link')}</span></a>`;
};
async function searchProducts(q) {
  const k = q.toLowerCase(), all = store.get('panel.prod', {});
  const c = all[k]; if (c && Date.now() - c.t < 6 * 36e5) return c.data;
  const r = await fetch(`https://uxhftljmnljmtyynzyie.supabase.co/functions/v1/products?q=${encodeURIComponent(q)}`);
  if (!r.ok) throw new Error(r.status);
  const d = (await r.json()).filter(p => Number.isFinite(p.price) && p.price > 0);
  all[k] = { t: Date.now(), data: d };
  const keep = Object.entries(all).sort((x, y) => y[1].t - x[1].t).slice(0, 12);
  store.set('panel.prod', Object.fromEntries(keep));
  return d;
}
let prod = { items: [], shop: '' };
const drawProd = () => {
  const { items } = prod;
  const shops = [...new Set(items.map(p => p.shop))].sort();
  $('pChips').innerHTML = items.length ? ['', ...shops].map(n => `<button class="chip" data-s="${esc(n)}" aria-pressed="${n === prod.shop}">${esc(n || 'Todas')}<i>${n ? items.filter(p => p.shop === n).length : items.length}</i></button>`).join('') : '';
  paged($('pres'), items.filter(p => !prod.shop || p.shop === prod.shop), prodCard, empty('Sin resultados.'));
};
$('pChips').onclick = e => { const n = e.target.closest('[data-s]')?.dataset.s; if (n == null) return; prod.shop = n; drawProd(); reveal('#pres .pcard'); };
$('pq').onsubmit = async e => {
  e.preventDefault();
  const raw = e.target.q.value.trim(); if (!raw) return;
  const q = encodeURIComponent(raw);
  const row = (t, l) => `<div class="chips"><span class="mut">${t}</span>${l.map(([n, u]) => A(u + q, esc(n), 'chip')).join('')}</div>`;
  $('plinks').innerHTML = `<p class="mut">Buscar directo en cada tienda</p>${row('General', GENERAL)}${row('Electro', SHOPS)}`;
  prod = { items: [], shop: '' };
  $('pres').hidden = false; $('pChips').innerHTML = '';
  paged($('pres'), [], prodCard, '<div class="skel"></div><div class="skel"></div>');
  let ok = true;
  try { prod.items = await searchProducts(raw); } catch { ok = false; }
  if ($('pq').q.value.trim() !== raw) return;
  if (!ok) return paged($('pres'), [], prodCard, empty('No se pudieron traer precios. Probá en las tiendas de abajo.'));
  if (!prod.items.length) return paged($('pres'), [], prodCard, empty('Sin resultados con precio. Probá en las tiendas de abajo.'));
  drawProd(); reveal('#pres .pcard');
};

const watch = await load('watch');
const onSale = (watch.items || []).filter(w => w.off);
$('watchHead').hidden = !onSale.length;
$('watch').innerHTML = onSale.map(w => `<div class="lk">${A(w.url, esc(w.name))}<span class="pill ac">-${w.off}%</span></div>`).join('');

// Cartelera: película primero; filtro por cine
const movies = cn.movies || [];
const cinesAll = [...new Set(movies.flatMap(m => m.at.map(a => a.cine)))].sort();
let cine = store.get('cine', '');
const drawCine = () => {
  $('cineChips').innerHTML = ['', ...cinesAll].map(c => `<button class="chip" data-c="${esc(c)}" aria-pressed="${c === cine}">${esc(c || 'Todos')}</button>`).join('');
  const list = movies.filter(m => !cine || m.at.some(a => a.cine === cine));
  paged($('movies'), list, m => `<article class="movie">
    <a class="poster" href="${esc(m.url)}" target="_blank" rel="noopener" aria-label="${esc(m.title)}">${im(m.img, m.title)}<span class="ext">${icon('link')}</span></a>
    <strong>${esc(m.title)}</strong>
    <details class="inc"><summary>${cine ? 'Horarios' : m.at.length + ' cine' + (m.at.length > 1 ? 's' : '')}</summary><ul>${m.at.filter(a => !cine || a.cine === cine).map(a => `<li><span>${esc(a.cine)}</span><small>${esc(a.times.join(' · '))}</small></li>`).join('')}</ul></details>
  </article>`, empty('Sin cartelera todavía.'));
};
$('cineChips').onclick = e => { const c = e.target.dataset.c; if (c == null) return; cine = c; store.set('cine', c); drawCine(); reveal('#movies .movie'); };
drawCine();
$('cnAt').textContent = since(cn.at);
