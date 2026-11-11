const REDEEM = 'https://www.gameloft.com/redeem/asphalt-legends?playerId=u-79g1efe';
const PROMOS = 'https://yosoymitxel.github.io/promociones-tarjetas-bancos-paraguay-py/promos.json';

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
  return 'act. ' + (h < 1 ? 'hace minutos' : h < 24 ? `hace ${h | 0} h` : `hace ${h / 24 | 0} d`);
};
const day = s => s ? new Date(s + 'T12:00').toLocaleDateString('es', { day: 'numeric', month: 'short' }) : '';
const empty = (msg) => `<div class="empty">${msg}</div>`;
const icon = id => `<svg class="ic"><use href="#i-${id}"/></svg>`;
let toastT;
const toast = msg => { const t = $('toast'); t.innerHTML = icon('check') + esc(msg); t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1800); };

const [as, fx, fr, wl, hb] = await Promise.all(['asphalt', 'fx', 'free', 'wishlist', 'humble'].map(load));

// Dólar: un solo tipo de cambio que usan todos los precios
const R = fx.PYG || 0;
const gs = usd => R ? '₲ ' + Math.round(usd * R).toLocaleString('es-PY') : '';
$('rate').textContent = R ? gs(1) : '—';
$('fxBtn').title = since(fx.at);
$('fxBtn').onclick = () => {
  const open = $('fxBox').hidden;
  $('fxBox').hidden = !open;
  $('fxBtn').setAttribute('aria-expanded', open);
  if (open) $('usd').focus();
};
$('usd').oninput = e => $('pyg').value = e.target.value ? Math.round(e.target.value * R) : '';
$('pyg').oninput = e => $('usd').value = e.target.value ? (e.target.value / R).toFixed(2) : '';

// Pestañas por hash
const views = ['asphalt', 'juegos', 'tarjetas'];
const route = () => {
  const v = views.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'asphalt';
  views.forEach(id => $(id).classList.toggle('on', id === v));
  document.querySelectorAll('.tabs a').forEach(a => a.setAttribute('aria-selected', a.hash === '#' + v));
  if (v === 'tarjetas') document.querySelector('#tq input').focus({ preventScroll: true });
};
addEventListener('hashchange', route);
route();

// Asphalt: copia el código, abre el canje y lo pasa a canjeados
const used = new Set(store.get('used'));
const seen = new Set(store.get('seen'));
const firstVisit = !seen.size;
const codeRow = (c, done) => `<li class="code">
  <div><b>${esc(c.code)}</b>${c.reward ? `<small>${esc(c.reward)}</small>` : ''}${!done && !firstVisit && !seen.has(c.code) ? '<small class="new">Nuevo</small>' : ''}</div>
  ${done ? `<button class="btn ghost" data-undo="${esc(c.code)}">Deshacer</button>`
    : `<button class="btn" data-c="${esc(c.code)}">${icon('copy')}Canjear</button>`}
</li>`;
const drawCodes = () => {
  const list = as.codes || [];
  const todo = list.filter(c => !used.has(c.code)), done = list.filter(c => used.has(c.code));
  $('codes').innerHTML = todo.map(c => codeRow(c, false)).join('')
    || empty(list.length ? 'Todo canjeado. Se revisan códigos nuevos cada 6 h.' : 'Sin datos todavía. Se cargan en la próxima actualización.');
  $('done').innerHTML = done.map(c => codeRow(c, true)).join('');
  $('doneBox').hidden = !done.length;
  $('nDone').textContent = done.length;
  $('nAs').textContent = todo.length || '';
  $('allDone').hidden = todo.length < 5;
};
$('allDone').onclick = () => {
  (as.codes || []).forEach(c => used.add(c.code));
  store.set('used', [...used]); drawCodes(); toast('Todos marcados');
};
$('asAt').textContent = since(as.at);
drawCodes();
store.set('seen', (as.codes || []).map(c => c.code));
document.querySelector('#asphalt').onclick = async e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.c) {
    await navigator.clipboard.writeText(b.dataset.c).catch(() => {});
    window.open(REDEEM, 'gameloft');
    used.add(b.dataset.c); toast(`${b.dataset.c} copiado`);
  } else used.delete(b.dataset.undo);
  store.set('used', [...used]); drawCodes();
};

// Juegos: subpestañas
const seg = s => {
  document.querySelectorAll('#seg button').forEach(b => b.setAttribute('aria-selected', b.dataset.s === s));
  document.querySelectorAll('[data-p]').forEach(p => p.hidden = p.dataset.p !== s);
  store.set('seg', s);
};
$('seg').onclick = e => e.target.dataset.s && seg(e.target.dataset.s);
seg(store.get('seg', 'gratis'));

// Gratis: Steam y Epic primero
const free = fr.items || [];
const groups = ['Todos', ...new Set(free.map(g => g.store))];
let frStore = 'Todos';
const drawFree = () => {
  $('frChips').innerHTML = groups.map(s => `<button class="chip" data-s="${esc(s)}" aria-pressed="${s === frStore}">${esc(s)} ${s === 'Todos' ? free.length : free.filter(g => g.store === s).length}</button>`).join('');
  const list = free.filter(g => frStore === 'Todos' || g.store === frStore);
  $('free').innerHTML = list.map(g => `<a class="card" href="${esc(g.url)}" target="_blank" rel="noopener">
    <img loading="lazy" src="${esc(g.img)}" alt="" width="320" height="180">
    <div><strong>${esc(g.title)}</strong>
    <span class="meta"><span class="store">${esc(g.store)}</span>${g.worth ? `<s>${esc(g.worth)}</s>` : ''}${g.end ? `<span>hasta ${day(g.end)}</span>` : ''}</span></div></a>`).join('')
    || empty(free.length ? 'Nada en esta tienda.' : 'Sin datos todavía.');
};
$('frChips').onclick = e => { if (e.target.dataset.s) { frStore = e.target.dataset.s; drawFree(); } };
$('frAt').textContent = since(fr.at);
drawFree();

// Deseados: precio Steam (región PY) vs la tienda más barata, en ₲
const games = (wl.games || []).slice().sort((a, b) => b.off - a.off || (a.usd ?? 1e9) - (b.usd ?? 1e9));
const wlRow = g => {
  const q = encodeURIComponent(g.name);
  const cheaper = g.best && g.usd != null && g.best.usd < g.usd;
  const steam = g.free ? 'Gratis' : g.usd == null ? '—' : `${g.off ? `<span class="off">-${g.off}%</span> ` : ''}$${g.usd.toFixed(2)}`;
  return `<li>
    <a href="https://store.steampowered.com/app/${g.id}" target="_blank" rel="noopener"><img loading="lazy" src="${esc(g.img || `https://cdn.akamai.steamstatic.com/steam/apps/${g.id}/capsule_231x87.jpg`)}" alt="" width="120" height="56"></a>
    <div style="min-width:0"><span class="name">${esc(g.name)}</span>
      <span class="links"><a href="https://steamdb.info/app/${g.id}/" target="_blank" rel="noopener">SteamDB</a><a href="https://www.eneba.com/latam/store/all?text=${q}" target="_blank" rel="noopener">Eneba</a><a href="https://www.humblebundle.com/store/search?search=${q}" target="_blank" rel="noopener">Humble</a></span></div>
    <div class="price"><span>${steam}</span>${g.usd ? `<small>${gs(g.usd)}</small>` : ''}
      ${cheaper ? `<a class="alt" href="${esc(g.best.url)}" target="_blank" rel="noopener">${esc(g.best.store)} $${g.best.usd.toFixed(2)}</a>` : ''}</div>
  </li>`;
};
const drawWl = () => {
  const q = $('wlq').value.trim().toLowerCase(), sale = $('wlSale').checked;
  const list = games.filter(g => g.name.toLowerCase().includes(q) && (!sale || g.off || (g.best && g.best.usd < g.usd)));
  $('wl').innerHTML = list.map(wlRow).join('');
  $('wlAt').innerHTML = games.length ? `${list.length} de ${games.length} · ${since(wl.at)}` : '';
  if (!list.length) $('wlAt').innerHTML = games.length ? 'Ninguno coincide.' : 'Sin datos todavía. La lista de deseados de Steam tiene que ser pública.';
};
$('wlq').oninput = $('wlSale').onchange = drawWl;
drawWl();

// Bundles de Humble
$('hbAt').textContent = since(hb.at);
$('hb').innerHTML = (hb.items || []).map(b => `<a class="card" href="${esc(b.url)}" target="_blank" rel="noopener">
  ${b.img ? `<img loading="lazy" src="${esc(b.img)}" alt="" width="320" height="180">` : ''}
  <div><strong>${esc(b.name)}</strong>${b.end ? `<span class="meta">hasta ${day(b.end)}</span>` : ''}</div></a>`).join('')
  || empty('Sin datos todavía.');

// Tarjetas: busca en las promos de PromoScraper (se actualiza a diario)
let promos;
const recent = store.get('recent');
const drawRecent = () => $('recent').innerHTML = recent.map(r => `<button class="chip" data-q="${esc(r)}">${esc(r)}</button>`).join('');
const search = async q => {
  q = q.trim(); if (!q) return;
  const ql = q.toLowerCase();
  document.querySelector('#tq input').value = q;
  $('tjt').href = 'https://tarjetea.com.py/stores?q=' + encodeURIComponent(q);
  $('promos').innerHTML = '<li><div class="skel" style="grid-column:1/-1"></div></li>';
  promos ??= await fetch(PROMOS).then(r => r.json()).catch(() => null);
  if (!promos) { $('promos').innerHTML = `<li>${empty('No se pudo leer PromoScraper. Usá Tarjeteá.')}</li>`; promos = undefined; return; }
  // Primero por nombre del comercio; la descripción solo si no hay ninguno
  const byTitle = promos.filter(p => p.title?.toLowerCase().includes(ql));
  const hit = (byTitle.length ? byTitle : promos.filter(p => p.desc?.toLowerCase().includes(ql)))
    .sort((a, b) => (b.discount_percent || 0) - (a.discount_percent || 0));
  $('promos').innerHTML = hit.slice(0, 30).map(p => `<li class="promo">
    <span class="bank" style="background:${esc(p.bankColor || '#555')}">${esc(p.bankShort)}</span>
    <div style="min-width:0"><a class="name" href="${esc(p.href)}" target="_blank" rel="noopener">${esc(p.title)}</a>
      <span class="mut">${esc([(p.days || []).join(', '), p.installments ? `${p.installments} cuotas` : ''].filter(Boolean).join(' · ') || p.category || '')}</span></div>
    <span class="pct">${p.discount_percent ? p.discount_percent + '%' : ''}</span>
  </li>`).join('') || `<li>${empty(`Sin promos para «${esc(q)}».`)}</li>`;
  recent.splice(0, recent.length, q, ...recent.filter(r => r.toLowerCase() !== ql).slice(0, 7));
  store.set('recent', recent); drawRecent();
};
$('tq').onsubmit = e => { e.preventDefault(); search(e.target.q.value); };
$('recent').onclick = e => e.target.dataset.q && search(e.target.dataset.q);
drawRecent();
