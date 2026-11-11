const r = await fetch('https://fxjhuodttsbcyncpkcxb.supabase.co/functions/v1/products?q=tv');
console.log('status', r.status, 'cache', r.headers.get('x-cache'), 'counts', r.headers.get('x-counts'), 'errs', r.headers.get('x-errors'));
const t = await r.text();
try { const d = JSON.parse(t); console.log('total', d.length); const by = {}; d.forEach(p => (by[p.shop] = by[p.shop] || []).push(p)); for (const [s, a] of Object.entries(by)) console.log(s, a.length, JSON.stringify(a.find(p => p.old) || a[0])); console.log('primeros', d.slice(0, 3).map(p => p.shop + ' ' + p.price + ' ' + p.name).join(' | ')); } catch { console.log(t.slice(0, 500)); }
const r2 = await fetch('https://fxjhuodttsbcyncpkcxb.supabase.co/functions/v1/products?q=tv'); console.log('2da', r2.headers.get('x-cache'));
