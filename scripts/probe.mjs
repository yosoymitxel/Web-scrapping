// Diagnóstico puntual: páginas de locales de Paseo La Galería
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36' };
for (const u of ['https://paseolagaleria.com.py/locales.php', 'https://paseolagaleria.com.py/locales-page-2.php', 'https://paseolagaleria.com.py/locales-page-3.php', 'https://paseolagaleria.com.py/locales-page-4.php']) {
  const r = await fetch(u, { headers: UA }); const h = await r.text();
  const h3 = [...h.matchAll(/<h3[^>]*>([\s\S]{0,80}?)<\/h3>/g)].map(m => m[0].replace(/\s+/g, ' '));
  console.log('==', u, r.status, h.length, 'h3', h3.length); console.log(h3.slice(0, 4).join('\n'));
  console.log('pag', [...new Set(h.match(/href="[^"]*locales[^"]*"/g) || [])].join(' '));
}
