const CH = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36';
const get = async (u, ua = CH) => (await fetch(u, { headers: { 'user-agent': ua }, signal: AbortSignal.timeout(25000) })).text();
let b = await get('https://www.contimarket.com/search?Box=False&q=tv');
const i = b.indexOf('"ProductPrice"');
let d = 0, st = -1;
for (let k = i; k >= 0; k--) { if (b[k] === '}') d++; if (b[k] === '{') { if (d === 0) { st = k; break; } d--; } }
let en = st, dd = 0, ins = false;
for (let k = st; k < b.length; k++) { const c = b[k]; if (ins) { if (c === '\\') k++; else if (c === '"') ins = false; } else if (c === '"') ins = true; else if (c === '{') dd++; else if (c === '}') { dd--; if (!dd) { en = k; break; } } }
try { const o = JSON.parse(b.slice(st, en + 1)); console.log('CONTI keys', Object.keys(o).join(','));
  console.log(JSON.stringify({ n: o.Name, p: o.PictureModels?.[0], pic: o.DefaultPictureModel, u: o.Url }).slice(0, 800)); } catch (e) { console.log('parse fail', e.message, b.slice(st, st + 200)); }
console.log('CONTI ctx', b.slice(st - 200, st).replace(/\s+/g, ' '));
b = await get('https://tiendanaranja.com.py/catalogsearch/result/?q=tv');
const j = b.indexOf('<li class="item product product-item');
console.log('NARANJA', b.slice(j, j + 9000).replace(/\s+/g, ' ').match(/product-item-link[\s\S]{0,300}|data-price-amount[\s\S]{0,200}|old-price[\s\S]{0,300}/g)?.join('\n') || 'none');
b = await get('https://tecnoga.com.py/?s=tv&post_type=product', 'curl/8.5.0');
const t = b.indexOf('class="wd-product');
console.log('TECNOGA', (t < 0 ? 'none ' + (b.match(/class="[^"]*product[^"]*"/g) || []).slice(0, 15).join('|') : b.slice(t - 100, t + 3500).replace(/\s+/g, ' ')));
