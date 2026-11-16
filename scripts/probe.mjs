// Diagnóstico puntual (no commitea): estructura de locales de shoppings
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36' };
const t = u => fetch(u, { headers: UA }).then(async r => [r.status, await r.text()]).catch(e => [0, e.message]);
const show = (h, re, n = 6) => [...h.matchAll(re)].slice(0, n).map(m => m[0].replace(/\s+/g, ' ').slice(0, 300)).join('\n');
let [s, h] = await t('https://www.mariscal.com.py/locales/4/calzados');
console.log('== mariscal cat', s, h.length); console.log(show(h, /<(h[1-6]|p|span|a|div)[^>]*class="[^"]*(titul|title|name|nombre|local)[^"]*"[^>]*>[\s\S]{0,200}/gi));
[s, h] = await t('https://paseolagaleria.com.py/locales-page-2.php');
console.log('== galeria p2', s, h.length); console.log(show(h, /<(h[1-6])[^>]*>[\s\S]{0,120}/gi, 10));
[s, h] = await t('https://www.delsol.com.py/shopping');
console.log('== delsol', s, h.length); console.log(show(h, /(ng-init|ng-controller|\$http|\.get\(|json|locales\s*=|var\s+\w+\s*=\s*\[)[\s\S]{0,200}/gi, 12));
