const values = value => Array.isArray(value) ? value : value == null ? [] : [value];

export const normalizePromoSearchText = value => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const searchableFields = promo => ({
  title: normalizePromoSearchText(promo.title),
  cards: normalizePromoSearchText([
    ...values(promo.cards),
    ...values(promo.card),
    ...values(promo.cardName),
    ...values(promo.card_name),
    ...values(promo.paymentCards),
    ...values(promo.payment_cards),
  ].join(' ')),
  bank: normalizePromoSearchText([promo.bankShort, promo.bankName, promo.bankId].join(' ')),
  description: normalizePromoSearchText(promo.desc),
  metadata: normalizePromoSearchText([
    promo.category,
    promo.group,
    promo.when,
    ...values(promo.days),
    promo.discount_percent,
    promo.installments,
    promo.installments ? `${promo.installments} cuotas` : '',
  ].join(' ')),
});

export const scorePromoSearch = (promo, query) => {
  const tokens = normalizePromoSearchText(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return -1;

  const fields = searchableFields(promo);
  const allText = Object.values(fields).join(' ');
  if (!tokens.every(token => allText.includes(token))) return -1;

  return tokens.reduce((score, token) => {
    if (fields.cards.includes(token)) return score + 12;
    if (fields.title.includes(token)) return score + 10;
    if (fields.bank.includes(token)) return score + 9;
    if (fields.description.includes(token)) return score + 5;
    if (fields.metadata.includes(token)) return score + 2;
    return score;
  }, 0);
};

export const searchPromos = (promos, query, preferredBanks = []) => {
  if (!Array.isArray(promos)) return [];
  const preferred = new Set(values(preferredBanks).map(normalizePromoSearchText));

  return promos
    .map((promo, index) => ({
      promo,
      index,
      score: scorePromoSearch(promo, query),
      preferred: preferred.has(normalizePromoSearchText(promo.bankShort)),
    }))
    .filter(result => result.score >= 0)
    .sort((a, b) =>
      Number(b.preferred) - Number(a.preferred) ||
      b.score - a.score ||
      (Number(b.promo.discount_percent) || 0) - (Number(a.promo.discount_percent) || 0) ||
      a.index - b.index
    )
    .map(result => result.promo);
};
