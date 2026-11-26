import { isSameProductModel, safeProductUrl } from './product-matching.mjs';

export const analyzeWishlistPrice = (item, product, checkedAt = new Date().toISOString()) => {
  const price = Number(product?.price);
  if (!Number.isFinite(price) || price <= 0) {
    return { history: Array.isArray(item?.history) ? item.history : [], previousPrice: null, change: null, lowestPrice: null, targetReached: false };
  }

  const shop = String(product?.shop || '');
  const history = Array.isArray(item?.history)
    ? item.history.filter(entry => entry && Number(entry.price) > 0)
    : [];
  const previous = [...history].reverse().find(entry => String(entry.shop || '') === shop);
  const previousPrice = previous ? Number(previous.price) : null;
  let change = null;

  if (previousPrice != null && previousPrice !== price) {
    const amount = Math.abs(previousPrice - price);
    change = {
      direction: price < previousPrice ? 'down' : 'up',
      amount,
      percent: Math.round(amount / previousPrice * 100),
      shop,
      previous: previousPrice,
    };
  }

  const last = history[history.length - 1];
  if (!last || String(last.shop || '') !== shop || Number(last.price) !== price) {
    history.push({ price, shop, url: safeProductUrl(product?.url), at: checkedAt });
  }

  const boundedHistory = history.slice(-24);
  const lowestPrice = Math.min(price, ...boundedHistory.map(entry => Number(entry.price)).filter(value => value > 0));
  const targetPrice = Number(item?.targetPrice);

  return {
    history: boundedHistory,
    previousPrice,
    change,
    lowestPrice,
    targetReached: Number.isFinite(targetPrice) && targetPrice > 0 && price <= targetPrice,
  };
};

export const targetPriceState = (item, currentPrice) => {
  const targetPrice = Number(item?.targetPrice);
  const price = Number(currentPrice);
  const configured = Number.isFinite(targetPrice) && targetPrice > 0;
  const reached = configured && Number.isFinite(price) && price > 0 && price <= targetPrice;
  const alreadyAlerted = configured && Number(item?.targetAlertedFor) === targetPrice;

  return {
    configured,
    targetPrice: configured ? targetPrice : null,
    reached,
    shouldNotify: reached && !alreadyAlerted,
  };
};

export const findComparableOffers = (products, reference, limit = 4) => {
  if (!Array.isArray(products) || !reference?.name) return [];
  const currentShop = String(reference.shop || '');
  const bestByShop = new Map();

  for (const product of products) {
    const shop = String(product?.shop || '');
    const price = Number(product?.price);
    if (!shop || shop === currentShop || !Number.isFinite(price) || price <= 0) continue;
    if (!isSameProductModel(reference, product)) continue;
    const previous = bestByShop.get(shop);
    if (!previous || price < Number(previous.price)) bestByShop.set(shop, product);
  }

  return [...bestByShop.values()]
    .sort((a, b) => Number(a.price) - Number(b.price))
    .slice(0, Math.max(0, Math.min(8, Number(limit) || 4)));
};
