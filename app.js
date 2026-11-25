import { findWishlistMatch, isSameProductModel } from './supabase/functions/notify/product-matching.mjs?v=20261120-4';
import { categoryOfProduct, filterProducts } from './scripts/product-filters.mjs?v=20261125-2';
const REDEEM = 'https://www.gameloft.com/redeem/asphalt-legends?playerId=u-79g1efe';
const PROMOS = 'https://yosoymitxel.github.io/promociones-tarjetas-bancos-paraguay-py/promos.json';
// Si el CDN no carga, la página funciona igual sin animaciones
const motion = await import('https://cdn.jsdelivr.net/npm/motion@11.11.13/+esm').catch(() => null);
const realtimeSdk = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.2/+esm').catch(() => null);
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
const paged = (box, items, render, none, n = 12, preserve = false) => {
  let b = box.nextElementSibling; if (!b?.classList.contains('more')) { b = document.createElement('button'); b.className = 'chip more'; b.type = 'button'; box.after(b); }
  let shown = preserve ? Math.max(n, Number(box.dataset.shown) || n) : n;
  const draw = () => {
    box.dataset.shown = String(shown);
    box.innerHTML = items.slice(0, shown).map(render).join('') || none;
    b.hidden = shown >= items.length;
    b.textContent = `Ver más (${items.length - shown})`;
  };
  b.onclick = () => { shown += n; draw(); };
  draw();
};
const empty = msg => `<div class="empty">${msg}</div>`;
const icon = id => `<svg class="ic"><use href="#i-${id}"/></svg>`;
const ent = t => String(t ?? '').replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const A = (href, label, cls = '') => `<a${cls ? ` class="${cls}"` : ''} href="${esc(href)}" target="_blank" rel="noopener">${label}${icon('link')}</a>`;
const fav = (href, domain, name) => `<a class="fav" href="${esc(href)}" target="_blank" rel="noopener" aria-label="${esc(name)}" title="${esc(name)}"><img src="https://www.google.com/s2/favicons?domain=${domain}&sz=64" alt="" width="20" height="20" data-fl="${esc(name[0])}"></a>`;
const im = (src, name, extra = '') => src ? `<img loading="lazy" src="${esc(src)}" alt="" data-ph="${esc(name)}"${extra ? ' ' + extra : ''}>` : `<span class="ph">${esc(name)}</span>`;
// Imagen rota: tarjeta con el nombre en lugar del ícono roto
addEventListener('error', e => {
  const i = e.target; if (i?.tagName !== 'IMG') return;
  if (i.dataset.fl) { const f = document.createElement('b'); f.textContent = i.dataset.fl; i.replaceWith(f); return; }
  // Miniatura de wishlist: el contenedor queda y muestra la inicial.
  const thumb = i.closest('.wish-thumb');
  if (thumb) { thumb.classList.add('wish-placeholder'); i.replaceWith((i.dataset.ph || '?')[0].toUpperCase()); return; }
  const ph = document.createElement('span'); ph.className = 'ph';
  ph.textContent = i.dataset.ph || (() => { try { return new URL(i.src).hostname.replace(/^www\\./, ''); } catch { return ''; } })();
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
  if (!r.ok) {
    const detail = d?.msg || d?.message || d?.error_description || d?.error?.message || d?.error || d?.code || r.status;
    const error = new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
    error.status = r.status;
    throw error;
  }
  return d;
};
let sess = store.get('panel.sess', null);
const token = async () => {
  if (!sess) return null;
  if (Date.now() > sess.until) {
    try { const d = await sb('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: sess.refresh }) }); sess = { token: d.access_token, refresh: d.refresh_token, until: Date.now() + (d.expires_in - 60) * 1e3, email: d.user.email, userId: d.user.id }; store.set('panel.sess', sess); }
    catch { sess = null; store.set('panel.sess', null); return null; }
  }
  return sess.token;
};
const profile = { links: [], used: [], cards: [], hidden: [], steam: '', cur: 'PYG', ...store.get('panel.profile', {}) };
const saveProfile = async () => {
  store.set('panel.profile', profile);
  const t = await token(); if (!t) return false;
  const cloudProfile = { ...profile };
  delete cloudProfile.productWishlist;
  delete cloudProfile.push;
  try {
    await sb('/rest/v1/panel_profiles?on_conflict=user_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ data: cloudProfile, updated_at: new Date().toISOString() }),
    }, t);
    return true;
  } catch (e) { toast('Nube: ' + e.message); return false; }
};
const pull = async () => {
  const t = await token(); if (!t) return;
  const [row] = await sb('/rest/v1/panel_profiles?select=data', {}, t).catch(() => []);
  if (row?.data) Object.assign(profile, row.data); else await saveProfile();
  store.set('panel.profile', profile);
};
const ensureUserId = async () => {
  const t = await token(); if (!t) return '';
  if (sess.userId) return sess.userId;
  const user = await sb('/auth/v1/user', {}, t);
  sess = { ...sess, userId: user.id, email: user.email || sess.email };
  store.set('panel.sess', sess);
  return sess.userId;
};
const upsertWishlistRows = async items => {
  const t = await token();
  if (!t) return false;
  await ensureUserId();
  const rows = items.filter(w => w?.id && String(w.id).length <= 128).map(w => ({
    item_id: String(w.id),
    item: w,
    updated_at: new Date().toISOString(),
  }));
  if (!rows.length) return true;
  await sb('/rest/v1/panel_product_wishlist?on_conflict=user_id,item_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(rows),
  }, t);
  return true;
};
let wishlistSyncPromise = null;
const syncProductWishlist = () => {
  if (!sess) return Promise.resolve(false);
  if (wishlistSyncPromise) return wishlistSyncPromise;
  wishlistSyncPromise = (async () => {
    const t = await token();
    if (!t) return false;
    await ensureUserId();
    if (!profile.productWishlistMigrated) {
      const legacy = Array.isArray(profile.productWishlist) ? profile.productWishlist : [];
      if (legacy.length) await upsertWishlistRows(legacy);
      profile.productWishlistMigrated = true;
      await saveProfile();
    }
    const rows = await sb('/rest/v1/panel_product_wishlist?select=item_id,item&order=updated_at.asc', {}, t);
    profile.productWishlist = rows.map(row => ({ ...(row.item || {}), id: row.item_id }));
    store.set('panel.profile', profile);
    return true;
  })();
  return wishlistSyncPromise.finally(() => { wishlistSyncPromise = null; });
};
const persistWishlistItem = item => upsertWishlistRows([item]);
const persistWishlistItems = items => upsertWishlistRows(items);
const deleteWishlistItem = async itemId => {
  const t = await token();
  if (!t) return false;
  await sb('/rest/v1/panel_product_wishlist?item_id=eq.' + encodeURIComponent(itemId), { method: 'DELETE' }, t);
  return true;
};
// Volver del correo (confirmar cuenta o cambiar contraseña): el enlace trae la sesión en el hash
let recovery = false;
{
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('access_token')) {
    history.replaceState(null, '', location.pathname);
    try {
      const u = await sb('/auth/v1/user', {}, h.get('access_token'));
      sess = { token: h.get('access_token'), refresh: h.get('refresh_token'), until: Date.now() + (+h.get('expires_in') - 60) * 1e3, email: u.email, userId: u.id };
      store.set('panel.sess', sess); recovery = h.get('type') === 'recovery';
    } catch {}
  }
}
await pull();
profile.productWishlist = Array.isArray(profile.productWishlist) ? profile.productWishlist : [];
let wishlistSyncError = '';
if (sess) {
  try { await syncProductWishlist(); }
  catch (e) { wishlistSyncError = String(e?.message || e); }
}
const SITE = 'https://yosoymitxel.github.io/Web-scrapping/';
// Qué le falta al usuario para recibir avisos de wishlist y locales seguidos; drawNotify actualiza pushReady.
let pushReady = false;
const alertHint = () => !sess ? '<button class="link" data-prof>Iniciá sesión</button> para recibir avisos en el celular.'
  : !pushReady ? '<button class="link" data-prof>Activá los avisos</button> en este dispositivo para enterarte.'
  : 'Avisos activos en este dispositivo.';
const setSess = d => { sess = { token: d.access_token, refresh: d.refresh_token, until: Date.now() + (d.expires_in - 60) * 1e3, email: d.user.email, userId: d.user.id }; store.set('panel.sess', sess); };
const loginMsg = t => $('loginMsg').textContent = t;
const validateEmail = value => {
  const email = String(value || '').trim();
  if (!email) return 'Escribí tu correo.';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(email)) return 'Ingresá un correo válido.';
  return '';
};
const validatePassword = (value, mode = 'login') => {
  const pass = String(value || '');
  if (!pass) return 'Escribí tu contraseña.';
  if (mode === 'register' && pass.length < 8) return 'Para crear la cuenta, usá al menos 8 caracteres.';
  if (mode === 'register' && (!/[A-Za-z]/.test(pass) || !/\d/.test(pass))) return 'La contraseña debe incluir al menos una letra y un número.';
  if (mode === 'login' && pass.length < 6) return 'La contraseña debe tener al menos 6 caracteres.';
  return '';
};
const authErrorMessage = (err, mode = 'login') => {
  const raw = String(err?.message || err?.error_description || err?.error || err || '').toLowerCase();
  if (/invalid login credentials|invalid_grant/.test(raw)) return 'Correo o contraseña incorrectos.';
  if (/already registered|user already exists|email_exists/.test(raw)) return 'Ese correo ya tiene una cuenta. Probá iniciar sesión.';
  if (/email not confirmed|email_not_confirmed/.test(raw)) return 'Primero confirmá tu correo desde el enlace que te enviamos.';
  if (/password.*(weak|short|characters)|weak_password/.test(raw)) return 'La contraseña no cumple los requisitos mínimos.';
  if (/rate limit|too many requests|429/.test(raw)) return 'Demasiados intentos. Esperá un momento y volvé a probar.';
  if (/invalid email|email address is invalid/.test(raw)) return 'Ingresá un correo válido.';
  if (/fetch|network|failed to connect|load failed/.test(raw)) return 'No se pudo conectar. Revisá tu conexión e intentá nuevamente.';
  if (/captcha/.test(raw)) return 'No se pudo validar el CAPTCHA. Recargá la página e intentá nuevamente.';
  return mode === 'register' ? 'No se pudo crear la cuenta. Revisá los datos e intentá nuevamente.' : 'No se pudo iniciar sesión. Revisá los datos e intentá nuevamente.';
};
const drawAcct = () => {
  $('acctLbl').textContent = sess ? sess.email.split('@')[0] : 'Entrar';
  $('login').hidden = !!sess; $('me').hidden = !sess; $('logout').hidden = !sess;
  $('meMail').textContent = sess?.email || '';
};
$('login').onsubmit = async e => {
  e.preventDefault();
  const email = e.target.email.value.trim().toLowerCase(), pass = e.target.pass.value, up = e.submitter?.value === 'up';
  const invalidEmail = validateEmail(email), invalidPassword = validatePassword(pass, up ? 'register' : 'login');
  if (invalidEmail) return loginMsg(invalidEmail);
  if (invalidPassword) return loginMsg(invalidPassword);
  e.target.pass.autocomplete = up ? 'new-password' : 'current-password';
  const submitButtons = [...e.target.querySelectorAll('button[type="submit"],button:not([type])')];
  submitButtons.forEach(button => button.disabled = true);
  const label = e.submitter.textContent;
  e.submitter.textContent = up ? 'Creando cuenta…' : 'Entrando…';
  try {
    try {
      if (up) {
        const d = await sb('/auth/v1/signup?redirect_to=' + encodeURIComponent(SITE), { method: 'POST', body: JSON.stringify({ email, password: pass }) });
        if (!d.access_token) return loginMsg('Cuenta creada. Confirmá el enlace que llegó a tu correo y después iniciá sesión.');
        setSess(d);
      } else setSess(await sb('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password: pass }) }));
    } catch (err) {
      loginMsg(authErrorMessage(err, up ? 'register' : 'login'));
      return;
    }
    drawAcct();
    try {
      await pull();
      await syncProductWishlist();
      location.reload();
    } catch (err) {
      loginMsg('Sesión iniciada. No se pudo sincronizar la wishlist: ' + String(err?.message || err));
    }
  } finally { submitButtons.forEach(button => button.disabled = false); e.submitter.textContent = label; }
};
$('showPass').onchange = e => $('login').pass.type = e.target.checked ? 'text' : 'password';
$('forgot').onclick = async () => {
  const email = $('login').email.value.trim().toLowerCase();
  const invalid = validateEmail(email);
  if (invalid) return loginMsg(invalid);
  try {
    await sb('/auth/v1/recover?redirect_to=' + encodeURIComponent(SITE), { method: 'POST', body: JSON.stringify({ email }) });
    loginMsg('Te enviamos un enlace para elegir otra contraseña. Revisá también la carpeta de spam.');
  } catch (err) { loginMsg(authErrorMessage(err, 'recovery')); }
};
$('setPass').onclick = async () => {
  const p = $('newPass').value;
  const invalid = validatePassword(p, 'register');
  if (invalid) return toast(invalid);
  try {
    await sb('/auth/v1/user', { method: 'PUT', body: JSON.stringify({ password: p }) }, await token());
    $('newPass').value = ''; toast('Contraseña cambiada');
  } catch (err) { toast(authErrorMessage(err, 'recovery')); }
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
  <div class="art">${im(img, title)}${pill ? `<span class="pill">${esc(pill)}</span>` : ''}</div>
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
    <a class="art" href="${alt ? esc(g.best.url) : `https://store.steampowered.com/app/${g.id}`}" target="_blank" rel="noopener" aria-label="${esc(g.name)} en ${esc(alt ? g.best.store : 'Steam')}">${im(g.img || `https://cdn.akamai.steamstatic.com/steam/apps/${g.id}/capsule_231x87.jpg`, g.name)}${g.off ? `<span class="pill ac">-${g.off}%</span>` : ''}${alt ? `<span class="pill where">${esc(g.best.store)}</span>` : ''}</a>
    ${hideBtn('g' + g.id, g.name)}
    <div class="body">
      <span class="name">${esc(g.name)}</span>
      ${px}
      <div class="go">${fav(`https://steamdb.info/app/${g.id}/`, 'steamdb.info', 'SteamDB')}${fav(`https://www.eneba.com/latam/store/all?text=${q}`, 'eneba.com', 'Eneba')}${fav(`https://www.humblebundle.com/store/search?search=${q}`, 'humblebundle.com', 'Humble')}</div>
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
const core = t => norm((t || '').replace(/\b(remaster(ed)?|definitive|deluxe|goty|game of the year|anniversary|complete|edition|collection|director'?s cut)\b/gi, ''));
const isWished = x => wishedId.has(x.steam) || wished.has(norm(x.n)) || games.some(g => core(g.name) && core(g.name) === core(x.n));
const matchMsg = (id, n, what) => { $(id).innerHTML = !games.length ? '' : n ? `<b>${n}</b> de tus deseados ${what}` : `Ninguno de tus deseados ${what}`; $(id).classList.toggle('on', !!n); };
const drawRails = () => {
const bundles = (hb.items || []).filter(b => !hidden.has('b' + b.url))
  .map(b => ({ ...b, name: ent(b.name).replace(/\s*\|\s*Humble Bundle$/i, '') }))
  .map(b => { const gs_ = (b.games || []).map(g => typeof g === 'string' ? { n: ent(g) } : { ...g, n: ent(g.n) }); return { ...b, gs: gs_.sort((x, y) => isWished(y) - isWished(x)), hits: gs_.filter(isWished).length }; })
  .sort((a, b) => b.hits - a.hits);
matchMsg('mHb', bundles.reduce((t, b) => t + b.hits, 0), 'en bundles');
const gameLi = g => {
  const q = encodeURIComponent(g.n), id = g.steam || wished.get(norm(g.n))?.id;
  return `<li${isWished(g) ? ' class="hit"' : ''}><span class="cv">${im(g.img || (id ? `https://cdn.akamai.steamstatic.com/steam/apps/${id}/capsule_231x87.jpg` : ''), g.n)}</span><span class="gn">${esc(g.n)}</span><span class="gl">${fav(id ? `https://store.steampowered.com/app/${id}` : `https://store.steampowered.com/search/?term=${q}`, 'store.steampowered.com', 'Steam')}${fav(id ? `https://steamdb.info/app/${id}/` : `https://steamdb.info/search/?a=app&q=${q}`, 'steamdb.info', 'SteamDB')}</span></li>`;
};
const over = b => { const t = endAt(b); return t && t < Date.now(); };
bundles.sort((a, b) => over(a) - over(b));
$('hb').innerHTML = bundles.map(b => {
  const n = b.gs.length, p = num(b.price);
  return `<article class="tile bundle surf${over(b) ? ' over' : ''}">
  <a class="art" href="${esc(b.url)}" target="_blank" rel="noopener" aria-label="${esc(b.name)}">${im(b.img, b.name)}${b.hits ? `<span class="pill ac">${b.hits} deseado${b.hits > 1 ? 's' : ''}</span>` : ''}</a>
  ${hideBtn('b' + b.url, b.name)}
  <div class="body"><strong>${esc(b.name)}</strong>
  ${p ? priceBox({ usd: p, extra: n ? `<small class="pg">≈ ${money(p / n)} por juego</small>` : '' }) : ''}
  ${endTag(b)}
  ${b.hits ? `<p class="whit">${icon('check')}${b.gs.filter(isWished).map(g => esc(g.n)).join(' · ')}</p>` : ''}
  ${n ? `<details class="inc"><summary>${n} juegos</summary><ul class="glist">${b.gs.map(gameLi).join('')}</ul></details>` : ''}</div>
</article>`; }).join('') || empty('Sin datos todavía.');

// Playtests abiertos; demos solo si el juego está en deseados (deseados primero)
const pts = (pt.items || []).filter(x => !hidden.has('t' + x.id) && (x.status === 'playtest' || wishedId.has(x.id)))
  .sort((a, b) => wishedId.has(b.id) - wishedId.has(a.id));
matchMsg('mPt', pts.filter(x => wishedId.has(x.id)).length, 'con demo o playtest');
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
  if (c?.user === user && c.data?.games) { setGames(c.data); drawWl(); drawRails(); }
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
    <span class="src">${A(p.href || 'https://yosoymitxel.github.io/promociones-tarjetas-bancos-paraguay-py/#p=' + encodeURIComponent(p.id || ''), 'Bases ' + esc(p.bankShort))}${A('https://www.google.com/maps/search/' + encodeURIComponent(p.title + ' ' + (mall(p.title) || 'Paraguay')), icon('pin') + 'Mapa', 'map')}</span></article>`;
let lastQ = '', hits = [], bankF = '', typeF = 'desc', mallF = '';

profile.followedStores = Array.isArray(profile.followedStores) ? profile.followedStores : [];
const normalizeStore = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const followedStoreFor = name => profile.followedStores.find(item => normalizeStore(item.name) === normalizeStore(name));
const drawStoreFollowButton = () => {
  const name = lastQ.trim();
  const followed = name && followedStoreFor(name);
  $('storeFollowControls').hidden = !name;
  $('storeFollowDuration').closest('.sel').hidden = !!followed;
  $('storeFollowAdd').textContent = followed ? 'Dejar de seguir «' + name + '»' : 'Seguir «' + name + '»';
  $('storeFollowAdd').classList.toggle('ghost', !!followed);
  $('storeFollowAdd').setAttribute('aria-pressed', String(!!followed));
};
const drawFollowedStores = () => {
  const list = profile.followedStores;
  $('storeFollowSection').hidden = !list.length;
  $('storeFollowIntro').innerHTML = 'Te avisamos cuando alguno tenga un descuento directo con tarjeta. ' + alertHint();
  $('storeFollowCount').textContent = String(list.length);
  $('storeFollowList').innerHTML = list.map(item => {
    const expired = !!item.expiresAt && Date.parse(item.expiresAt) <= Date.now();
    const deals = expired ? [] : (Array.isArray(item.latestDeals) ? item.latestDeals : []);
    const until = item.expiresAt
      ? 'hasta ' + new Date(item.expiresAt).toLocaleDateString('es-PY', { day:'numeric', month:'short', year:'numeric' })
      : 'sin vencimiento';
    const status = expired
      ? 'Seguimiento vencido'
      : deals.length
        ? deals.length + (deals.length === 1 ? ' descuento directo vigente' : ' descuentos directos vigentes')
        : item.lastCheckedAt
          ? 'Sin descuentos directos detectados · revisado ' + new Date(item.lastCheckedAt).toLocaleString('es-PY', { dateStyle:'short', timeStyle:'short' })
          : 'Esperando la primera revisión automática';
    const dealRows = deals.map(deal => {
      const detail = [deal.bankShort, ...(Array.isArray(deal.cards) ? deal.cards : []), deal.when || (Array.isArray(deal.days) ? deal.days.join(', ') : '')].filter(Boolean).join(' · ');
      return '<div class="store-follow-deal"><div><b>' + esc(deal.title || item.name) + '</b><small>' + esc(detail || 'Descuento directo con tarjeta') + '</small></div><strong>-' + esc(deal.discountPercent) + '%</strong>' + (deal.href ? A(deal.href, 'Bases') : '') + '</div>';
    }).join('');
    return '<article class="store-follow-card"><div class="store-follow-top"><div><b>' + esc(item.name) + '</b><small>' + esc(status) + ' · ' + esc(until) + '</small></div><button class="chip" type="button" data-store-unfollow="' + esc(item.id) + '">Quitar</button></div>' + (dealRows ? '<div class="store-follow-deals">' + dealRows + '</div>' : '') + '</article>';
  }).join('');
  drawStoreFollowButton();
};
$('storeFollowAdd').onclick = async () => {
  const name = lastQ.trim();
  if (!name) return;
  const followed = followedStoreFor(name);
  if (followed) {
    profile.followedStores = profile.followedStores.filter(item => item !== followed);
    await saveProfile();
    drawFollowedStores();
    return toast('Dejaste de seguir «' + name + '».');
  }
  if (profile.followedStores.length >= 50) return toast('Llegaste al límite de 50 locales seguidos.');
  const days = Number($('storeFollowDuration').value);
  const now = new Date();
  profile.followedStores.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2),
    name,
    addedAt: now.toISOString(),
    expiresAt: days ? new Date(now.getTime() + days * 864e5).toISOString() : null,
    latestDeals: [],
    lastCheckedAt: null,
    notified: [],
  });
  const synced = await saveProfile();
  drawFollowedStores();
  toast(synced ? 'Siguiendo «' + name + '».' : sess ? 'Guardado en este navegador; no se pudo sincronizar.' : 'Guardado en este navegador.');
};
$('storeFollowList').onclick = async event => {
  const id = event.target.closest('[data-store-unfollow]')?.dataset.storeUnfollow;
  if (!id) return;
  profile.followedStores = profile.followedStores.filter(item => item.id !== id);
  await saveProfile();
  drawFollowedStores();
  toast('Seguimiento eliminado.');
};
drawFollowedStores();

const kind = p => p.discount_percent ? 'desc' : p.installments ? 'cuotas' : 'otro';
// Chips de banco: filtro con contador sobre los resultados de la búsqueda
const drawPromos = () => {
  const all = hits.filter(p => !hidden.has('p' + p.id));
  const types = [['desc', 'Descuento'], ['cuotas', 'Cuotas sin interés'], ['', 'Todo']];
  $('pType').innerHTML = all.length ? types.map(([v, l]) => `<button class="chip" data-t="${v}" aria-pressed="${v === typeF}">${l}<i>${v ? all.filter(p => kind(p) === v).length : all.length}</i></button>`).join('') : '';
  const byType = all.filter(p => !typeF || kind(p) === typeF);
  const mallsIn = [...new Set(byType.flatMap(p => mall(p.title).split(', ').filter(Boolean)))].sort();
  $('pMall').innerHTML = mallsIn.length ? ['', ...mallsIn].map(m => `<button class="chip" data-m="${esc(m)}" aria-pressed="${m === mallF}">${esc(m || 'Todos los shoppings')}<i>${m ? byType.filter(p => mall(p.title).includes(m)).length : byType.length}</i></button>`).join('') : '';
  if (mallF && !mallsIn.includes(mallF)) mallF = '';
  const list = byType.filter(p => !mallF || mall(p.title).includes(mallF));
  const banks = [...new Set(list.map(p => p.bankShort))].sort();
  $('myBanks').innerHTML = list.length ? ['', ...banks].map(b => `<button class="chip" data-b="${esc(b)}" aria-pressed="${b === bankF}">${esc(b || 'Todos')}<i>${b ? list.filter(p => p.bankShort === b).length : list.length}</i></button>`).join('') : '';
  paged($('promos'), list.filter(p => !bankF || p.bankShort === bankF), promoCard, empty(`Sin promos para «${esc(lastQ)}».`));
};
const search = async q => {
  q = q.trim(); if (!q) return; lastQ = q;
  drawStoreFollowButton();
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
  hits = hit; bankF = ''; mallF = '';
  drawPromos();
  drawFollowedStores();
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
$('pType').onclick = e => { const b = e.target.closest('[data-t]'); if (!b) return; typeF = b.dataset.t; bankF = ''; drawPromos(); };
$('pMall').onclick = e => { const b = e.target.closest('[data-m]'); if (!b) return; mallF = b.dataset.m; bankF = ''; drawPromos(); };
$('tq').onsubmit = e => { e.preventDefault(); search(e.target.q.value); };
$('recent').onclick = e => e.target.dataset.q && search(e.target.dataset.q);
drawRecent();

route();

// Productos: abre el buscador de cada tienda (sin scraping)
const GENERAL = [['Rebuscate','https://rebuscate.com/?q=']];
const SHOPS = [['Nissei','https://nissei.com/py/catalogsearch/result/?q='],['Tienda Naranja','https://tiendanaranja.com.py/catalogsearch/result/?q='],['Contimarket','https://www.contimarket.com/search?Box=False&q='],['Compulandia','https://www.compulandia.com.py/py/store?q='],['Visuar','https://visuar.com.py/searchiqit?s='],['Tecnoga','https://tecnoga.com.py/?post_type=product&s='],['Innovagame','https://www.innovagame.com.py/busqueda?controller=search&s='],['Cellshop','https://cellshop.com.py/catalogsearch/result/?q='],['Wilmar','https://wilmarcenter.com.py/?post_type=product&s='],['Mega','https://megaelectronicos.com.py/producto/buscar/?search='],['Hogar Feliz','https://www.hogarfeliz.com.py/productos?q='],['Porter','https://porter.com.py/index.php?route=product/search&search='],['Tupi','https://www.tupi.com.py/buscar?productos='],['Bristol','https://www.bristol.com.py/catalogo?q='],['Compras Paraguai','https://www.comprasparaguai.com.br/busca/?q=']];
const normalizeProductName = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const safeProductUrl = value => {
  try { const u = new URL(String(value || ''), location.href); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch { return ''; }
};
const sameProductModel = isSameProductModel;
const wishKey = p => safeProductUrl(p?.url) || (String(p?.shop || '') + '|' + normalizeProductName(p?.name));
const isProductWished = p => (profile.productWishlist || []).some(w => wishKey(w) === wishKey(p));
const wishSnapshot = p => ({
  name: String(p.name || ''),
  shop: String(p.shop || ''),
  price: Number(p.price) || 0,
  old: Number(p.old) || 0,
  off: offOf(p),
  url: safeProductUrl(p.url),
  img: String(p.img || ''),
});
const wishPrice = n => pygS(Number(n) || 0);
const wishOption = (p, label) => {
  const href = safeProductUrl(p.url);
  return '<a class="wish-option" href="' + esc(href || '#') + '" target="_blank" rel="noopener">' +
    '<span><b>' + esc(p.name) + '</b><small>' + esc(p.shop) + (label ? ' · ' + esc(label) : '') + '</small></span>' +
    '<strong>' + wishPrice(p.price) + '</strong></a>';
};
const wishCard = w => {
  const latest = w.latest || {};
  const current = latest.matched || null;
  const discount = current && offOf(current) > 0
    ? '<span class="wish-signal good">Oferta vigente: -' + offOf(current) + '% en ' + esc(current.shop) + '</span>' : '';
  const change = latest.change;
  const trend = change?.direction === 'down'
    ? '<span class="wish-signal good">Bajó ' + wishPrice(change.amount) + ' (' + change.percent + '%) en ' + esc(change.shop) + '</span>'
    : change?.direction === 'up'
      ? '<span class="wish-signal warn">Subió ' + wishPrice(change.amount) + ' (' + change.percent + '%) en ' + esc(change.shop) + '</span>'
      : '';
  const same = (latest.sameProduct || []).length
    ? '<div class="wish-group"><b>Mismo modelo más barato</b>' + latest.sameProduct.map(p => wishOption(p, 'alternativa en otra tienda')).join('') + '</div>' : '';
  let status = 'Precio del día que lo guardaste. Todavía sin revisar.';
  if (latest.error) status = 'No se pudo actualizar: ' + latest.error;
  else if (latest.missing) status = 'No apareció en esta consulta. Puede haberse agotado o cambiado el nombre.';
  else if (latest.checkedAt) status = (discount || trend ? '' : 'Sin cambios · ') + 'revisado ' + new Date(latest.checkedAt).toLocaleString('es-PY', {dateStyle:'short', timeStyle:'short'});
  const shown = current || w;
  const href = safeProductUrl(shown.url) || safeProductUrl(w.url);
  const thumb = w.img ? '<img src="' + esc(w.img) + '" alt="" width="64" height="64" data-ph="' + esc(w.name) + '" loading="lazy" referrerpolicy="no-referrer">' : esc((w.name || '?')[0].toUpperCase());
  const signals = discount + trend + (latest.missing ? '<span class="wish-signal warn">No encontrado</span>' : '');
  return '<article class="wish-card">' +
    '<div class="wish-card-head">' +
      (href ? '<a class="wish-thumb' + (w.img ? '' : ' wish-placeholder') + '" href="' + esc(href) + '" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">' + thumb + '</a>'
        : '<span class="wish-thumb' + (w.img ? '' : ' wish-placeholder') + '" aria-hidden="true">' + thumb + '</span>') +
      '<div class="wish-card-title">' + (href ? '<a href="' + esc(href) + '" target="_blank" rel="noopener">' + esc(w.name) + '</a>' : '<b>' + esc(w.name) + '</b>') +
        '<small>' + esc(shown.shop || w.shop) + '</small></div>' +
    '</div>' +
    '<div class="wish-current"><strong>' + wishPrice(shown.price) + '</strong>' +
      (current && current.old > current.price ? '<small><s>' + wishPrice(current.old) + '</s></small>' : '') + '</div>' +
    (signals ? '<div class="wish-signals">' + signals + '</div>' : '') +
    '<div class="wish-foot"><p class="mut wish-status">' + esc(status) + '</p>' +
      '<button class="chip wish-remove" type="button" data-wish-remove="' + esc(w.id) + '" aria-label="Quitar ' + esc(w.name) + ' de la wishlist">Quitar</button></div>' +
    same + '</article>';
};
const drawWishlist = status => {
  const items = profile.productWishlist || [];
  $('wishSection').hidden = !items.length;
  $('wishCount').textContent = String(items.length);
  $('productWishlist').innerHTML = items.map(wishCard).join('');
  if (status !== undefined) $('wishStatus').textContent = status;
  else if (wishlistSyncError) $('wishStatus').textContent = 'La wishlist está en este navegador, pero no se pudo sincronizar: ' + wishlistSyncError;
  else if (!items.length) $('wishStatus').textContent = 'Guardá productos desde los resultados para seguir sus precios.';
  else $('wishStatus').innerHTML = 'Los precios se revisan solos cada 3 horas. ' + alertHint();
};
const addProductToWishlist = async p => {
  if (!p || isProductWished(p)) return;
  const query = $('pq').q.value.trim();
  const now = new Date().toISOString();
  const item = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2),
    query,
    name: String(p.name || ''),
    shop: String(p.shop || ''),
    url: safeProductUrl(p.url),
    img: String(p.img || ''),
    price: Number(p.price) || 0,
    old: Number(p.old) || 0,
    off: offOf(p),
    addedAt: now,
    history: [{price:Number(p.price) || 0, shop:String(p.shop || ''), url:safeProductUrl(p.url), at:now}],
    latest: null,
  };
  profile.productWishlist.unshift(item);
  try {
    const synced = sess ? await persistWishlistItem(item) : false;
    if (sess && !synced) throw new Error('La sesión expiró. Volvé a iniciar sesión.');
    await saveProfile();
    drawWishlist(synced ? 'Producto guardado y sincronizado con tu cuenta.' : 'Producto guardado en este navegador.');
    toast('Agregado a tu wishlist');
  } catch (e) {
    drawWishlist('Guardado localmente, pero no se pudo sincronizar: ' + String(e?.message || e));
    toast('No se pudo sincronizar la wishlist');
  }
  drawProd(true);
};
const prodCard = p => {
  const off = offOf(p);
  const tracked = isProductWished(p);
  const href = safeProductUrl(p.url);
  return '<article class="pcard' + (tracked ? ' is-wished' : '') + '">' +
    '<a class="pcard-link surf" href="' + esc(href || '#') + '" target="_blank" rel="noopener">' +
      '<span class="pph">' + im(p.img, p.name, 'referrerpolicy="no-referrer"') + '</span>' +
      '<span class="pname">' + esc(p.name) + '</span>' +
      priceBox({pyg:p.price, was:p.old > p.price ? p.old : null, off}) +
      '<span class="mut pshop">' + esc(p.shop) + icon('link') + '</span>' +
    '</a>' +
    '<button class="chip wish-add" type="button" data-wish-add="' + esc(String(prod.items.indexOf(p))) + '"' +
      (tracked ? ' aria-pressed="true" disabled' : ' aria-pressed="false"') + '>' +
      (tracked ? 'En wishlist' : 'Seguir precio') + '</button></article>';
};
async function searchProducts(q, force = false) {
  const k = q.toLowerCase(), all = store.get('panel.prod.v2', {});
  const c = all[k];
  if (!force && c && Date.now() - c.t < 6 * 36e5) return c.data;
  const url = 'https://uxhftljmnljmtyynzyie.supabase.co/functions/v1/products?q=' + encodeURIComponent(q) + (force ? '&refresh=1' : '');
  const r = await fetch(url);
  if (!r.ok) throw new Error(r.status);
  const d = (await r.json()).filter(p => Number.isFinite(p.price) && p.price > 0);
  all[k] = {t:Date.now(), data:d};
  const keep = Object.entries(all).sort((x,y) => y[1].t - x[1].t).slice(0,12);
  store.set('panel.prod.v2', Object.fromEntries(keep));
  return d;
}
let prod = {items:[], shop:''};
const offOf = p => p.off || (p.old > p.price ? Math.round((1 - p.price / p.old) * 100) : 0);
const sorts = {pa:(a,b) => a.price - b.price, pd:(a,b) => b.price - a.price, off:(a,b) => offOf(b) - offOf(a), n:(a,b) => a.name.localeCompare(b.name)};
const drawProd = (preservePage = false) => {
  const {items} = prod;
  const shops = [...new Set(items.map(p => p.shop))].sort();
  const selectedCategory = $('pCategory').value;
  const categories = [...new Set(items.map(p => categoryOfProduct(p.name)))].sort((a,b) => a.localeCompare(b, 'es'));
  $('pCategory').innerHTML = '<option value="">Todas</option>' + categories.map(c => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join('');
  $('pCategory').value = categories.includes(selectedCategory) ? selectedCategory : '';
  $('pChips').innerHTML = items.length ? ['', ...shops].map(n => '<button class="chip" data-s="' + esc(n) + '" aria-pressed="' + (n === prod.shop) + '">' + esc(n || 'Todas') + '<i>' + (n ? items.filter(p => p.shop === n).length : items.length) + '</i></button>').join('') : '';
  $('pTools').hidden = !items.length;
  const minPrice = $('pMinPrice').value === '' ? null : Number($('pMinPrice').value);
  const maxPrice = $('pMaxPrice').value === '' ? null : Number($('pMaxPrice').value);
  const invalidRange = minPrice !== null && maxPrice !== null && minPrice > maxPrice;
  const filtered = invalidRange ? [] : filterProducts(items, {
    shop: prod.shop,
    category: $('pCategory').value,
    minPrice: Number.isFinite(minPrice) ? minPrice : null,
    maxPrice: Number.isFinite(maxPrice) ? maxPrice : null,
    onlyOff: $('pOff').getAttribute('aria-pressed') === 'true',
  }).sort(sorts[$('pSort').value]);
  $('pResultCount').textContent = invalidRange ? 'Rango inválido' : filtered.length + ' de ' + items.length + ' productos';
  paged(
    $('pres'),
    filtered,
    prodCard,
    empty(invalidRange ? 'El precio mínimo no puede superar el máximo.' : 'No hay productos que coincidan con estos filtros.'),
    12,
    preservePage
  );
};
const findWishlistProduct = findWishlistMatch;
const refreshProductWishlist = async () => {
  const items = profile.productWishlist || [];
  if (!items.length) return;
  const button = $('wishRefresh');
  button.disabled = true;
  drawWishlist('Consultando de nuevo las tiendas guardadas en tu wishlist…');
  try {
    const queries = [...new Set(items.map(w => String(w.query || w.name).trim()).filter(Boolean))];
    const results = new Map();
    await Promise.all(queries.map(async q => {
      try { results.set(q.toLowerCase(), {items:await searchProducts(q, true), error:''}); }
      catch (e) { results.set(q.toLowerCase(), {items:[], error:String(e?.message || e)}); }
    }));
    const checkedAt = new Date().toISOString();
    for (const w of items) {
      const result = results.get(String(w.query || w.name).trim().toLowerCase());
      if (!result || result.error) {
        w.latest = {...(w.latest || {}), checkedAt, error:result?.error || 'No se pudo consultar esta búsqueda.'};
        continue;
      }
      const found = findWishlistProduct(result.items, w);
      const previous = [...(w.history || [])].reverse().find(h => found && h.shop === found.shop && h.shop === (h.shop || ''));
      let change = null;
      if (found && previous && Number(previous.price) !== Number(found.price)) {
        const amount = Math.abs(Number(previous.price) - Number(found.price));
        change = {
          direction: found.price < previous.price ? 'down' : 'up',
          amount,
          percent: Math.round(amount / Math.max(1, Number(previous.price)) * 100),
          shop:found.shop,
        };
      }
      const basePrice = found?.price || Number(w.price) || 0;
      const sameProduct = found ? result.items
        .filter(p => p.price < basePrice && p.shop !== found.shop && sameProductModel(found, p))
        .sort((a,b) => a.price - b.price).slice(0,3).map(wishSnapshot) : [];
      const history = Array.isArray(w.history) ? w.history : [];
      if (found) history.push({price:Number(found.price), shop:String(found.shop), url:safeProductUrl(found.url), at:checkedAt});
      w.history = history.slice(-12);
      w.latest = {
        checkedAt,
        matched:found ? wishSnapshot(found) : null,
        sameProduct,
        missing:!found,
        error:'',
        change,
      };
    }
    const synced = sess ? await persistWishlistItems(items) : false;
    await saveProfile();
    drawWishlist(synced
      ? 'Actualización terminada. La lista y el historial quedaron sincronizados con tu cuenta.'
      : 'Actualización terminada en este dispositivo. Iniciá sesión para sincronizar y recibir avisos automáticos.');
  } catch (e) {
    drawWishlist('No se pudo completar la actualización: ' + String(e?.message || e));
  } finally {
    button.disabled = false;
    drawProd(true);
  }
};
$('pres').addEventListener('click', async e => {
  const button = e.target.closest('[data-wish-add]');
  if (!button) return;
  const p = prod.items[Number(button.dataset.wishAdd)];
  await addProductToWishlist(p);
});
$('productWishlist').addEventListener('click', async e => {
  const button = e.target.closest('[data-wish-remove]');
  if (!button) return;
  try {
    const synced = await deleteWishlistItem(button.dataset.wishRemove);
    if (sess && !synced) throw new Error('La sesión expiró. Volvé a iniciar sesión.');
  } catch (e) { toast('No se pudo eliminar en la nube: ' + String(e?.message || e)); return; }
  profile.productWishlist = profile.productWishlist.filter(w => w.id !== button.dataset.wishRemove);
  await saveProfile();
  drawWishlist('Producto eliminado de tu wishlist.');
  drawProd(true);
});
$('wishRefresh').onclick = refreshProductWishlist;
drawWishlist();
let realtimeClient = null;
const startWishlistRealtime = async () => {
  if (!sess || !realtimeSdk?.createClient) return;
  try {
    const userId = await ensureUserId();
    if (!userId) return;
    realtimeClient = realtimeSdk.createClient(SB, SBK, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    realtimeClient.realtime.setAuth(await token());
    realtimeClient.channel('panel-wishlist-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'panel_product_wishlist' }, async payload => {
        const owner = payload.new?.user_id || payload.old?.user_id;
        if (owner && owner !== userId) return;
        try {
          await syncProductWishlist();
          drawWishlist();
          drawProd(true);
        } catch (e) {
          wishlistSyncError = String(e?.message || e);
          drawWishlist();
        }
      })
      .subscribe((status, error) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          wishlistSyncError = error?.message || 'La conexión en tiempo real no está disponible.';
          drawWishlist('Sin conexión en tiempo real. Se sincronizará al volver a abrir o enfocar esta pestaña.');
        }
      });
  } catch (e) {
    wishlistSyncError = String(e?.message || e);
    drawWishlist('Sin conexión en tiempo real. La wishlist se sincronizará al volver a abrir o enfocar esta pestaña.');
  }
};
if (sess) startWishlistRealtime();
addEventListener('focus', async () => {
  if (!sess) return;
  try { await syncProductWishlist(); drawWishlist(); drawProd(true); }
  catch (e) { wishlistSyncError = String(e?.message || e); drawWishlist(); }
});
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || !sess) return;
  try { await syncProductWishlist(); drawWishlist(); drawProd(true); }
  catch (e) { wishlistSyncError = String(e?.message || e); drawWishlist(); }
});
$('pSort').onchange = () => drawProd();
$('pCategory').onchange = () => drawProd();
$('pMinPrice').oninput = () => drawProd();
$('pMaxPrice').oninput = () => drawProd();
$('pOff').onclick = e => { const b = e.currentTarget; b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true'); drawProd(); };
$('pChips').onclick = e => { const n = e.target.closest('[data-s]')?.dataset.s; if (n == null) return; prod.shop = n; drawProd(); reveal('#pres .pcard'); };
$('pq').onsubmit = async e => {
  e.preventDefault();
  const raw = e.target.q.value.trim(); if (!raw) return;
  const q = encodeURIComponent(raw);
  const row = (t, l) => `<div class="chips"><span class="mut">${t}</span>${l.map(([n, u]) => A(u + q, esc(n), 'chip')).join('')}</div>`;
  $('plinks').innerHTML = `<p class="mut">Buscar directo en cada tienda</p>${row('General', GENERAL)}${row('Electro', SHOPS)}`;
  prod = { items: [], shop: '' };
  $('pCategory').value = '';
  $('pMinPrice').value = '';
  $('pMaxPrice').value = '';
  $('pSort').value = 'pa';
  $('pOff').setAttribute('aria-pressed', 'false');
  $('pResultCount').textContent = '';
  $('pTools').hidden = true;
  $('pres').hidden = false; $('pChips').innerHTML = '';
  paged($('pres'), [], prodCard, '<div class="skel"></div><div class="skel"></div>');
  let ok = true;
  try { prod.items = await searchProducts(raw); } catch { ok = false; }
  if ($('pq').q.value.trim() !== raw) return;
  if (!ok) return paged($('pres'), [], prodCard, empty('No se pudieron traer precios. Probá en las tiendas de abajo.'));
  if (!prod.items.length) return paged($('pres'), [], prodCard, empty('Sin resultados con precio. Probá en las tiendas de abajo.'));
  drawProd(); reveal('#pres .pcard');
};
// ?q=producto abre Tarjetas con la búsqueda de precios hecha (enlace compartible)
{ const q = new URLSearchParams(location.search).get('q'); if (q) { if (location.hash !== '#tarjetas') location.hash = 'tarjetas'; $('pq').q.value = q; $('pq').requestSubmit(); } }

const watch = await load('watch');
const onSale = (watch.items || []).filter(w => w.off);
$('watchHead').hidden = !onSale.length;
$('watch').innerHTML = onSale.map(w => `<div class="lk">${A(w.url, esc(w.name))}<span class="pill ac">-${w.off}%</span></div>`).join('');

// Cartelera: portada primero; cadena > sede, y género, con contador
const movies = cn.movies || [];
const chainOf = n => /ita[uú]/i.test(n) ? 'Itaú Cinema Pop' : /cinemark/i.test(n) ? 'Cinemark' : /cineart/i.test(n) ? 'Cineart' : 'Otros cines';
const sedeOf = n => { const t = n.replace(/^cines?\s+/i, '').replace(/^(ita[uú]\s+cinema\s?pop|ita[uú]|cinemark|cineart)\s*-?\s*/i, '').replace(/^-\s*/, '').trim() || n; return t[0].toUpperCase() + t.slice(1); };
const fl = { c: store.get('cine2', ''), s: '', g: '' };
const inCine = (a, c, s) => (!c || chainOf(a.cine) === c) && (!s || sedeOf(a.cine) === s);
const hasM = (m, c, s, g) => (!g || (m.genres || []).includes(g)) && m.at.some(a => inCine(a, c, s));
const cnt = (c, s, g) => movies.filter(m => hasM(m, c, s, g)).length;
const chip = (attr, v, label, n, on) => `<button class="chip" data-${attr}="${esc(v)}" aria-pressed="${on}">${esc(label)}<i>${n}</i></button>`;
const drawCine = () => {
  const chains = [...new Set(movies.flatMap(m => m.at.map(a => chainOf(a.cine))))].sort((a, b) => (a === 'Otros cines') - (b === 'Otros cines') || cnt(b, '', fl.g) - cnt(a, '', fl.g));
  if (fl.c && !chains.includes(fl.c)) fl.c = '';
  $('cineChips').innerHTML = [chip('c', '', 'Todos', cnt('', '', fl.g), !fl.c), ...chains.map(c => chip('c', c, c, cnt(c, '', fl.g), c === fl.c))].join('');
  const sedes = fl.c ? [...new Set(movies.flatMap(m => m.at.filter(a => chainOf(a.cine) === fl.c).map(a => sedeOf(a.cine))))].sort() : [];
  $('cineSede').hidden = sedes.length < 2;
  if (!sedes.includes(fl.s)) fl.s = '';
  $('sedeSel').innerHTML = `<option value="">Todas las sedes (${cnt(fl.c, '', fl.g)})</option>` + sedes.map(x => `<option value="${esc(x)}"${x === fl.s ? ' selected' : ''}>${esc(x)} (${cnt(fl.c, x, fl.g)})</option>`).join('');
  const gens = [...new Set(movies.flatMap(m => m.genres || []))].sort((a, b) => cnt(fl.c, fl.s, b) - cnt(fl.c, fl.s, a) || a.localeCompare(b));
  $('genreChips').innerHTML = gens.length ? [chip('g', '', 'Todos los géneros', cnt(fl.c, fl.s, ''), !fl.g), ...gens.map(g => chip('g', g, g, cnt(fl.c, fl.s, g), g === fl.g))].join('') : '';
  const list = movies.filter(m => hasM(m, fl.c, fl.s, fl.g));
  paged($('movies'), list, m => {
    const at = m.at.filter(a => inCine(a, fl.c, fl.s));
    return `<article class="movie">
    <a class="poster" href="${esc(m.url)}" target="_blank" rel="noopener" aria-label="${esc(m.title)}">${im(m.img, m.title)}</a>
    <strong>${esc(m.title)}</strong>${m.genres?.length ? `<small class="mut">${esc(m.genres.slice(0, 2).join(' · '))}</small>` : ''}
    <details class="inc"><summary>${at.length === 1 ? 'Horarios' : at.length + ' sedes'}</summary><ul>${at.map(a => `<li><span>${esc(a.cine)}</span><small>${esc(a.times.join(' · '))}</small></li>`).join('')}</ul></details>
  </article>`; }, empty('Sin cartelera con esos filtros.'));
};
$('cineChips').onclick = e => { const b = e.target.closest('[data-c]'); if (!b) return; fl.c = b.dataset.c; fl.s = ''; store.set('cine2', fl.c); drawCine(); reveal('#movies .movie'); };
$('sedeSel').onchange = e => { fl.s = e.target.value; drawCine(); reveal('#movies .movie'); };
$('genreChips').onclick = e => { const b = e.target.closest('[data-g]'); if (!b) return; fl.g = b.dataset.g; drawCine(); reveal('#movies .movie'); };
drawCine();
$('cnAt').textContent = since(cn.at);

// Avisos push: una suscripción por dispositivo; la función notify también vigila bajadas de precio cada 3 h.
const VAPID = 'BG17L2huPA1iogOFzXIsFRfosZEWDv2yy7GwhwsXbKSF158zzrmVVsCRnEmFFaDC233cUqO8eP4bzAy7f_v2F7s';
const NOTIFY = [['price', 'Bajadas de precio'], ['sale', 'Deseados en oferta'], ['bundles', 'Deseados en bundles'], ['playtest', 'Deseados con demo/playtest'], ['free', 'Juegos gratis'], ['watch', 'Ofertas vigiladas'], ['stores', 'Descuentos en locales seguidos'], ['asphalt', 'Códigos de Asphalt']];
profile.notify ??= { price: true, sale: true, bundles: true, playtest: true, free: true, watch: true, stores: true, asphalt: false };
profile.notify.stores ??= true;
profile.notify.price ??= true;
const b64 = s => Uint8Array.from(atob((s + '='.repeat((4 - s.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const canPush = 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined';
let localPushSub = null;
const savePushRecord = async subscription => {
  const t = await token();
  if (!t) throw new Error('Iniciá sesión para guardar esta suscripción.');
  await ensureUserId();
  const data = typeof subscription?.toJSON === 'function' ? subscription.toJSON() : subscription;
  if (!data?.endpoint) throw new Error('El navegador no devolvió una suscripción válida.');
  await sb('/rest/v1/panel_push_subscriptions?on_conflict=user_id,endpoint', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ endpoint: data.endpoint, subscription: data, updated_at: new Date().toISOString() }),
  }, t);
};
const removePushRecord = async endpoint => {
  const t = await token();
  if (!t || !endpoint) return;
  await sb('/rest/v1/panel_push_subscriptions?endpoint=eq.' + encodeURIComponent(endpoint), { method: 'DELETE' }, t);
};
const drawNotify = () => {
  $('notifyChips').innerHTML = NOTIFY.map(([k, l]) => `<button class="chip" type="button" data-n="${k}" aria-pressed="${!!profile.notify[k]}">${l}</button>`).join('');
  const on = !!sess && !!localPushSub && Notification.permission === 'granted';
  $('pushOn').hidden = on; $('pushOff').hidden = !on;
  $('pushMsg').textContent = !canPush ? 'Este navegador no permite avisos push. En iPhone: agregá el panel a la pantalla de inicio.'
    : !sess ? 'Iniciá sesión arriba para activar avisos en este dispositivo.'
    : on ? 'Avisos activos en este dispositivo. Elegí abajo de qué querés enterarte.'
    : 'Se revisa todo cada 3 horas. Activá este dispositivo para recibir lo que marques abajo.';
  $('pushOn').disabled = !canPush || !sess;
  if (pushReady !== on) { pushReady = on; drawFollowedStores(); drawWishlist(); }
};
$('notifyChips').onclick = e => {
  const k = e.target.closest('[data-n]')?.dataset.n;
  if (!k) return;
  profile.notify[k] = !profile.notify[k];
  saveProfile(); drawNotify();
};
$('pushOn').onclick = async () => {
  try {
    if (!sess) return toast('Iniciá sesión primero');
    if (await Notification.requestPermission() !== 'granted') return toast('Permiso de avisos denegado');
    const reg = await navigator.serviceWorker.register('sw.js');
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(VAPID) });
    await savePushRecord(sub);
    localPushSub = sub;
    if (profile.push?.endpoint) { delete profile.push; await saveProfile(); }
    drawNotify(); toast('Avisos activados en este dispositivo');
  } catch (e) { toast('No se pudo activar: ' + authErrorMessage(e)); }
};
$('pushOff').onclick = async () => {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await removePushRecord(sub.endpoint);
      await sub.unsubscribe();
    }
    localPushSub = null;
    drawNotify(); toast('Avisos desactivados en este dispositivo');
  } catch (e) { toast('No se pudieron desactivar: ' + String(e?.message || e)); }
};
if (canPush) {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    localPushSub = await reg?.pushManager.getSubscription() || null;
    if (sess && localPushSub) await savePushRecord(localPushSub);
    if (sess && profile.push?.endpoint) {
      await savePushRecord(profile.push);
      delete profile.push;
      await saveProfile();
    }
  } catch (e) { console.warn('push sync', e?.message || e); }
  drawNotify();
} else {
  $('notifyChips').innerHTML = '';
  $('pushOn').disabled = true;
  $('pushMsg').textContent = 'Este navegador no permite avisos push. En iPhone: agregá el panel a la pantalla de inicio.';
}

