import { isSameProductModel } from '../supabase/functions/notify/product-matching.mjs';

const endpoint = 'https://uxhftljmnljmtyynzyie.supabase.co/functions/v1/products';
const queries = ['M2535E1', 'Ryzen 7 5700X', 'Archer AX55', 'Samsung 990 PRO 2TB'];

const clean = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const targetFor = {
  'M2535E1': product => clean(product.name).includes('m2535e1'),
  'Ryzen 7 5700X': product => clean(product.name).includes('5700x'),
  'Archer AX55': product => clean(product.name).includes('ax55'),
  'Samsung 990 PRO 2TB': product => clean(product.name).includes('990 pro') && clean(product.name).includes('2tb'),
};

for (const query of queries) {
  const response = await fetch(endpoint + '?q=' + encodeURIComponent(query) + '&refresh=1', {
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) throw new Error(query + ': products endpoint HTTP ' + response.status);

  const products = await response.json();
  if (!Array.isArray(products)) throw new Error(query + ': invalid products response');
  const candidates = products.filter(targetFor[query]);
  if (!candidates.length) throw new Error(query + ': no products matched the requested model in the live catalogue');
  const stores = [...new Set(candidates.map(product => product.shop).filter(Boolean))].sort();
  const pairs = [];

  for (let left = 0; left < candidates.length; left++) {
    for (let right = left + 1; right < candidates.length; right++) {
      const a = candidates[left], b = candidates[right];
      if (a.shop && b.shop && a.shop !== b.shop && isSameProductModel(a, b)) {
        pairs.push({ stores: a.shop + ' / ' + b.shop, names: [a.name, b.name] });
      }
    }
  }

  console.log(JSON.stringify({
    query,
    catalogProducts: products.length,
    targetProducts: candidates.length,
    stores,
    crossStoreSameModelPairs: pairs.length,
    examples: pairs.slice(0, 5),
  }));

  for (const item of products) {
    if (!item.name || !item.shop || !Number.isFinite(Number(item.price)) || !item.url) {
      throw new Error(query + ': invalid product record from ' + (item.shop || 'unknown store'));
    }
  }
}
