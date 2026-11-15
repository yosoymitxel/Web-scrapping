// Diagnóstico puntual (no commitea): GNB API y listas de shoppings
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36' };
const t = u => fetch(u, { headers: UA }).then(async r => [r.status, await r.text()]).catch(e => [0, e.message]);
const [, js] = await t('https://www.beneficiosbancognb.com.py/v2/main.87ca0669a586571d.js');
console.log('GNB js', js.length);
console.log([...new Set(js.match(/["'`][^"'`\s]{0,80}(api|Api|beneficio|categor|comercio|promo)[^"'`\s]{0,80}["'`]/g) || [])].slice(0, 80).join('\n'));
for (const u of ['https://www.delsol.com.py/shopping', 'https://www.mariscal.com.py/locales-comerciales', 'https://paseolagaleria.com.py/locales.php']) {
  const [s, h] = await t(u);
  console.log('\n==', u, s, h.length);
  console.log([...new Set(h.match(/(fetch|axios|ajax|\$\.get|\.json|wp-json|api)[^\n]{0,160}/g) || [])].slice(0, 15).join('\n'));
  console.log('links', [...new Set(h.match(/href="[^"]*(local|tienda|store|page)[^"]*"/gi) || [])].slice(0, 15).join(' '));
}
