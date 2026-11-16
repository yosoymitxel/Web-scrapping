// Diagnóstico puntual: de dónde salen los locales de Paseo La Galería
const h = await (await fetch('https://paseolagaleria.com.py/locales.php', { headers: { 'user-agent': 'Mozilla/5.0 Chrome/124' } })).text();
console.log('img/locales', (h.match(/img\/locales/g) || []).length);
console.log([...h.matchAll(/(ajax|\$\.get|\$\.post|fetch\(|\.php\?|json)[^\n]{0,160}/g)].slice(0, 15).map(m => m[0]).join('\n'));
console.log(h.slice(h.indexOf('ADIDAS') - 300, h.indexOf('ADIDAS') + 200));
