const normalize = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

// Términos que no identifican por sí solos a un comercio.
const GENERIC_STORE_WORDS = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'y', 'the',
  'shop', 'shops', 'shopping', 'center', 'centers',
  'store', 'stores', 'local', 'locales', 'tienda', 'tiendas',
  'sucursal', 'sucursales',
]);

export const isDirectDiscount = promotion => {
  const percent = Number(promotion?.discount_percent);
  return Number.isFinite(percent) && percent > 0;
};

export const matchesFollowedStore = (promotion, storeName) => {
  const title = normalize(promotion?.title);
  const store = normalize(storeName);
  if (!title || !store) return false;

  const storeWords = store.split(' ').filter(Boolean);
  if (!storeWords.some(word => word.length > 1 && !GENERIC_STORE_WORDS.has(word))) return false;

  // Exige el nombre completo. Permite "Cell Shop" = "Cellshop", pero no
  // acepta una coincidencia por "Cell" o "Shop" de manera aislada.
  const expected = storeWords.join('');
  const titleWords = title.split(' ');
  for (let start = 0; start < titleWords.length; start++) {
    let candidate = '';
    for (let end = start; end < titleWords.length; end++) {
      candidate += titleWords[end];
      if (candidate === expected) return true;
      if (candidate.length >= expected.length) break;
    }
  }
  return false;
};

export const storePromotionFingerprint = promotion => {
  const identity = promotion?.id
    ? String(promotion.id)
    : [promotion?.title, promotion?.href, promotion?.bankShort].map(value => String(value || '')).join('|');
  return [identity, Number(promotion?.discount_percent) || 0, String(promotion?.bankShort || '')].join('|');
};

const snapshot = promotion => ({
  fingerprint: storePromotionFingerprint(promotion),
  title: String(promotion?.title || ''),
  discountPercent: Number(promotion?.discount_percent) || 0,
  bankShort: String(promotion?.bankShort || ''),
  cards: Array.isArray(promotion?.cards) ? promotion.cards.map(String).slice(0, 8) : [],
  when: String(promotion?.when || ''),
  days: Array.isArray(promotion?.days) ? promotion.days.map(String).slice(0, 7) : [],
  href: /^https:\/\//i.test(String(promotion?.href || '')) ? String(promotion.href) : '',
});

export const updateFollowedStore = (follow, promotions, now = new Date()) => {
  const date = now instanceof Date ? now : new Date(now);
  const nowMs = date.getTime();
  const expired = !!follow?.expiresAt && Date.parse(follow.expiresAt) <= nowMs;
  const matches = expired || !Array.isArray(promotions)
    ? []
    : promotions.filter(promotion => isDirectDiscount(promotion) && matchesFollowedStore(promotion, follow?.name));
  const notified = new Set(Array.isArray(follow?.notified) ? follow.notified.map(String) : []);
  const newPromotions = matches.filter(promotion => !notified.has(storePromotionFingerprint(promotion)));
  matches.forEach(promotion => notified.add(storePromotionFingerprint(promotion)));
  const next = {
    ...follow,
    lastCheckedAt: date.toISOString(),
    latestDeals: matches.slice(0, 20).map(snapshot),
    notified: [...notified].slice(-500),
  };
  return { follow: next, newPromotions: newPromotions.map(snapshot), expired };
};
