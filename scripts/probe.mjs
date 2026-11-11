const r = await fetch('https://www.cines.com.py/cine/2--Ita%C3%BA%20Cinema%20Pop%20del%20Sol', { headers: { 'user-agent': 'Mozilla/5.0 Chrome/126.0.0.0' } });
const b = await r.text();
const bl = b.split('cartelera_cuadro');
console.log('blocks', bl.length, 'estrenos', b.indexOf('id="contenido_estrenos"'));
console.log(bl[2].replace(/\s+/g, ' '));
console.log('----'); console.log(bl[3].replace(/\s+/g, ' ').slice(0, 1500));
console.log('cines', [...new Set([...b.matchAll(/href="(\/cine\/\d+--[^"]+)"/g)].map(m => m[1]))].join(' | '));
