import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeWishlistPrice,
  findComparableOffers,
  targetPriceState,
} from '../supabase/functions/notify/wishlist-tracking.mjs';

const phone = (shop, price, name = 'Samsung Galaxy S24 Ultra 5G 256GB SM-S928B') => ({
  name, shop, price,
  url: 'https://example.com/' + shop.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
});

test('tracks a price drop against the latest sample from the same store', () => {
  const item = {
    history: [{ price: 9000000, shop: 'Nissei', at: '2026-11-20T00:00:00.000Z' }],
  };
  const result = analyzeWishlistPrice(item, phone('Nissei', 8500000), '2026-11-26T12:00:00.000Z');
  assert.equal(result.change.direction, 'down');
  assert.equal(result.change.amount, 500000);
  assert.equal(result.change.percent, 6);
  assert.equal(result.lowestPrice, 8500000);
  assert.equal(result.history.length, 2);
});

test('tracks price increases without appending duplicate samples', () => {
  const item = {
    history: [
      { price: 8500000, shop: 'Nissei', at: '2026-11-20T00:00:00.000Z' },
      { price: 8400000, shop: 'Cellshop', at: '2026-11-21T00:00:00.000Z' },
    ],
  };
  const increased = analyzeWishlistPrice(item, phone('Nissei', 8700000), '2026-11-26T12:00:00.000Z');
  assert.equal(increased.change.direction, 'up');
  assert.equal(increased.change.amount, 200000);
  assert.equal(increased.lowestPrice, 8400000);

  const unchanged = analyzeWishlistPrice(
    { ...item, history: increased.history },
    phone('Nissei', 8700000),
    '2026-11-26T15:00:00.000Z',
  );
  assert.equal(unchanged.change, null);
  assert.equal(unchanged.history.length, increased.history.length);
});

test('caps price history at 24 distinct samples', () => {
  const history = Array.from({ length: 30 }, (_, index) => ({
    price: 1000000 + index * 1000,
    shop: 'Nissei',
    at: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
  }));
  const result = analyzeWishlistPrice({ history }, phone('Nissei', 900000), '2026-11-26T12:00:00.000Z');
  assert.equal(result.history.length, 24);
  assert.equal(result.lowestPrice, 900000);
});

test('notifies a target once and rearms when the target changes', () => {
  assert.equal(targetPriceState({ targetPrice: 8000000 }, 7900000).shouldNotify, true);
  assert.equal(targetPriceState({ targetPrice: 8000000, targetAlertedFor: 8000000 }, 7800000).shouldNotify, false);
  assert.equal(targetPriceState({ targetPrice: 7500000, targetAlertedFor: 8000000 }, 7400000).shouldNotify, true);
});

test('ignores invalid targets and prices above the goal', () => {
  assert.equal(targetPriceState({ targetPrice: 0 }, 100).shouldNotify, false);
  assert.equal(targetPriceState({ targetPrice: -10 }, 100).configured, false);
  assert.equal(targetPriceState({ targetPrice: 500 }, 501).reached, false);
});

test('compares the cheapest identical model in each other store', () => {
  const wanted = phone('Nissei', 9000000);
  const offers = [
    phone('Cellshop', 8700000),
    phone('Cellshop', 8600000),
    phone('Tupi', 8800000),
    phone('Bristol', 7500000, 'Samsung Galaxy S24 Ultra SM-S928B'),
    phone('Tienda Naranja', 1000, 'Xiaomi Redmi Note 13 256GB'),
    phone('Nissei', 8000000),
  ];
  const result = findComparableOffers(offers, wanted, 4);
  assert.deepEqual(result.map(offer => [offer.shop, offer.price]), [
    ['Bristol', 7500000],
    ['Cellshop', 8600000],
    ['Tupi', 8800000],
  ]);
});
