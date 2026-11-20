import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseLocalizedMoney,
  parseStoreDealText,
  normalizeStoreName,
  buildStoreDealAlerts,
} from './store-deals.mjs';

test('interpreta precios con coma y punto decimal', () => {
  assert.equal(parseLocalizedMoney('90,00'), 90);
  assert.equal(parseLocalizedMoney('1.234,56'), 1234.56);
  assert.equal(parseLocalizedMoney('1,234.56'), 1234.56);
  assert.equal(parseLocalizedMoney('1.234'), 1234);
});

test('extrae el precio anterior, el actual y el porcentaje publicado', () => {
  assert.deepEqual(parseStoreDealText('Antes ~~US$ 90,00~~ Ahora US$ 19,90 -78% 78% de descuento'), {
    oldPriceUsd: 90, priceUsd: 19.9, off: 78,
  });
});

test('prioriza el porcentaje publicado aunque el redondeo de precios no coincida', () => {
  assert.equal(parseStoreDealText('Antes US$ 100,00 Ahora US$ 60,00 -56% 56% de descuento').off, 56);
});

test('rechaza cuotas sin precio anterior y precios que no bajaron', () => {
  assert.equal(parseStoreDealText('12 cuotas sin intereses'), null);
  assert.equal(parseStoreDealText('Antes US$ 100 Ahora US$ 100'), null);
  assert.equal(parseStoreDealText('Antes US$ 100 Ahora US$ 120'), null);
});

test('normaliza los nombres de Nissei y Cellshop', () => {
  assert.equal(normalizeStoreName('NISSEI'), 'Nissei');
  assert.equal(normalizeStoreName('Cellshop'), 'Cellshop');
  assert.equal(normalizeStoreName('Mega Eletrônicos'), 'Mega Eletrônicos');
});

test('no genera avisos masivos al inicializar el primer histórico', () => {
  const old = { complete: false, items: [] };
  const next = [{ id: 'cellshop-x', store: 'Cellshop', name: 'X', priceUsd: 10, oldPriceUsd: 20, off: 50 }];
  assert.deepEqual(buildStoreDealAlerts(next, old, '2026-11-20T15:00:00.000Z'), []);
});

test('avisa cuando un precio baja o aparece una oferta nueva en locales vigilados', () => {
  const previous = {
    complete: true,
    items: [
      { id: 'cellshop-a', store: 'Cellshop', name: 'Auricular A', priceUsd: 50, oldPriceUsd: 70, off: 29 },
      ...Array.from({ length: 19 }, (_, i) => ({ id: 'other-' + i, store: 'Nissei', priceUsd: 20 })),
    ],
    alerts: [],
  };
  const current = [
    { id: 'cellshop-a', store: 'Cellshop', name: 'Auricular A', priceUsd: 40, oldPriceUsd: 70, off: 43, url: 'https://example.com/a' },
    { id: 'nissei-new', store: 'Nissei', name: 'Juego B', priceUsd: 15, oldPriceUsd: 30, off: 50 },
    { id: 'mega-new', store: 'Mega', name: 'Otro C', priceUsd: 10, oldPriceUsd: 20, off: 50 },
  ];
  const alerts = buildStoreDealAlerts(current, previous, '2026-11-20T18:00:00.000Z');
  assert.equal(alerts.length, 2);
  assert.deepEqual(alerts.map(x => x.type).sort(), ['new-deal', 'price-drop']);
  assert.equal(alerts.find(x => x.type === 'price-drop').fromPriceUsd, 50);
  assert.equal(alerts.some(x => x.store === 'Mega'), false);
});

test('conserva avisos recientes durante el despliegue de Pages', () => {
  const recent = { id: 'recent', at: '2026-11-20T17:00:00.000Z' };
  const previous = { complete: true, items: Array.from({ length: 20 }, (_, i) => ({id:String(i)})), alerts: [recent] };
  assert.deepEqual(buildStoreDealAlerts([], previous, '2026-11-20T18:00:00.000Z'), [recent]);
});

test('compara históricos completos aunque el catálogo tenga pocos descuentos', () => {
  const previous = {
    complete: true,
    items: [{ id: 'nissei-a', store: 'Nissei', name: 'Notebook A', priceUsd: 500, oldPriceUsd: 600, off: 17 }],
    alerts: [],
  };
  const current = [{ id: 'nissei-a', store: 'Nissei', name: 'Notebook A', priceUsd: 450, oldPriceUsd: 600, off: 25 }];
  const alerts = buildStoreDealAlerts(current, previous, '2026-11-20T18:00:00.000Z');
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].type, 'price-drop');
  assert.equal(alerts[0].fromPriceUsd, 500);
});

test('no genera avisos si el catálogo está vacío y el precio no se puede comparar', () => {
  const previous = { complete: true, items: [], alerts: [] };
  const current = [];
  assert.deepEqual(buildStoreDealAlerts(current, previous, '2026-11-20T18:00:00.000Z'), []);
});
