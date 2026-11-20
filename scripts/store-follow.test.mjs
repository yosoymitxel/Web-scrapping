import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isDirectDiscount,
  matchesFollowedStore,
  storePromotionFingerprint,
  updateFollowedStore,
} from '../supabase/functions/notify/store-follow.mjs';

test('encuentra el nombre completo aunque el título agregue texto o cambie los espacios', () => {
  assert.equal(matchesFollowedStore({ title: 'Nissei - promoción especial con tarjetas' }, 'Nissei'), true);
  assert.equal(matchesFollowedStore({ title: 'Descuento exclusivo en CELL SHOP Paraguay' }, 'Cellshop'), true);
  assert.equal(matchesFollowedStore({ title: 'Beneficio exclusivo de Cellshop Paraguay' }, 'Cell Shop'), true);
  assert.equal(matchesFollowedStore({ title: 'Promo Banco Atlas en Shopping del Sol' }, 'Nissei'), false);
});

test('no confunde Cell Shop con otros comercios que comparten solo Cell o Shop', () => {
  const unrelated = [
    'Atlantico Shop',
    'CYCLES SHOP S.A',
    'Alemania Cell',
    'Teko Baby Shop & Juguetería',
    'Master Shop',
    'Carni Shop (Filas) - Miércoles de Supermercados',
    'Estilo Sport Shop',
    'Hoc Cell',
    'Beef Shop - Miércoles de Supermercados',
    'Vane Shop',
    'Sport Shop',
    'Shop Center La Economía',
  ];

  for (const title of unrelated) {
    assert.equal(matchesFollowedStore({ title }, 'Cell Shop'), false, title);
  }

  assert.equal(matchesFollowedStore({ title: 'Descuento para Cellshop Paraguay' }, 'Cell Shop'), true);
  assert.equal(matchesFollowedStore({ title: 'Descuento para Anissei Shop' }, 'Nissei'), false);
  assert.equal(matchesFollowedStore({ title: 'Atlantico Shop' }, 'Shop'), false);
});

test('solo considera descuento directo y excluye cuotas y cashback', () => {
  assert.equal(isDirectDiscount({ discount_percent: 20 }), true);
  assert.equal(isDirectDiscount({ discount_percent: '15' }), true);
  assert.equal(isDirectDiscount({ discount_percent: 0, installments: 12 }), false);
  assert.equal(isDirectDiscount({ discount_percent: null, cashback: 20 }), false);
});

test('guarda solo las promociones del comercio seguido y detecta solo promociones nuevas', () => {
  const promotions = [
    { id: 'cellshop', title: 'Descuento exclusivo en CELL SHOP Paraguay', discount_percent: 20, bankShort: 'Atlas', cards: ['Visa'], href: 'https://example.com/bases' },
    { id: 'atlantico', title: 'Atlantico Shop', discount_percent: 10, bankShort: 'BASA' },
    { id: 'hoc', title: 'Hoc Cell', discount_percent: 10, bankShort: 'Continental' },
    { id: 'cycles', title: 'CYCLES SHOP S.A', discount_percent: 20, bankShort: 'BASA' },
    { id: 'installments', title: 'CELL SHOP', discount_percent: 0, installments: 12, bankShort: 'Atlas' },
    { id: 'cashback', title: 'CELL SHOP', discount_percent: null, cashback: 20, bankShort: 'Atlas' },
  ];
  const date = new Date('2026-11-20T15:00:00.000Z');
  const first = updateFollowedStore({ name: 'Cell Shop', notified: [] }, promotions, date);
  assert.deepEqual(first.follow.latestDeals.map(deal => deal.title), ['Descuento exclusivo en CELL SHOP Paraguay']);
  assert.equal(first.follow.latestDeals[0].discountPercent, 20);
  assert.equal(first.newPromotions.length, 1);
  assert.equal(first.follow.lastCheckedAt, date.toISOString());

  const second = updateFollowedStore(first.follow, promotions, new Date('2026-11-20T18:00:00.000Z'));
  assert.equal(second.follow.latestDeals.length, 1);
  assert.equal(second.newPromotions.length, 0);
});

test('avisa de nuevo cuando cambia el porcentaje y no duplica el mismo beneficio', () => {
  const original = { id: 'promo', title: 'Nissei', discount_percent: 10, bankShort: 'Atlas' };
  const changed = { ...original, discount_percent: 20 };
  const first = updateFollowedStore({ name: 'Nissei', notified: [] }, [original], new Date('2026-11-20T00:00:00Z'));
  const second = updateFollowedStore(first.follow, [changed], new Date('2026-11-20T03:00:00Z'));
  assert.equal(second.newPromotions.length, 1);
  assert.notEqual(storePromotionFingerprint(original), storePromotionFingerprint(changed));
});

test('el seguimiento vencido no produce alertas ni descuentos activos', () => {
  const expired = { name: 'Nissei', expiresAt: '2026-11-19T00:00:00.000Z', notified: [] };
  const result = updateFollowedStore(expired, [{ title: 'Nissei', discount_percent: 30 }], new Date('2026-11-20T00:00:00Z'));
  assert.equal(result.expired, true);
  assert.equal(result.follow.latestDeals.length, 0);
  assert.equal(result.newPromotions.length, 0);
});
