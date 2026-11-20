const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export const normalizeStoreName = value => {
  const raw = String(value ?? '').replace(/\s+/g, ' ').trim();
  const key = norm(raw);
  if (key.includes('nissei')) return 'Nissei';
  if (key.includes('cellshop')) return 'Cellshop';
  return raw;
};

export const parseLocalizedMoney = value => {
  let raw = String(value ?? '').replace(/[^\d.,-]/g, '');
  if (!raw || !/\d/.test(raw)) return null;
  const comma = raw.lastIndexOf(',');
  const dot = raw.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    raw = comma > dot ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  } else if (comma >= 0) {
    raw = raw.length - comma - 1 <= 2 ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  } else if (dot >= 0 && raw.length - dot - 1 === 3) {
    raw = raw.replace(/\./g, '');
  }
  const number = Number(raw);
  return Number.isFinite(number) && number > 0 ? number : null;
};

export const parseStoreDealText = text => {
  const source = String(text ?? '');
  const extract = label => {
    const match = source.match(new RegExp(label + '[\\s\\S]{0,45}?(?:US\\s*\\$|USD\\s*|\\$)?\\s*([\\d][\\d.,]*)', 'i'));
    return match ? parseLocalizedMoney(match[1]) : null;
  };
  const oldPriceUsd = extract('Antes');
  const priceUsd = extract('Ahora');
  if (!(oldPriceUsd > 0 && priceUsd > 0 && priceUsd < oldPriceUsd)) return null;
  const declared = source.match(/(?:-|−)?\s*(\d{1,2})\s*%\s*(?:de descuento|descuento|off)/i);
  const off = declared ? Number(declared[1]) : Math.round((1 - priceUsd / oldPriceUsd) * 100);
  return { oldPriceUsd, priceUsd, off };
};

export const buildStoreDealAlerts = (items, previous, checkedAt) => {
  const previousItems = Array.isArray(previous?.items) ? previous.items : [];
  const currentTime = Date.parse(checkedAt) || Date.now();
  const carried = (Array.isArray(previous?.alerts) ? previous.alerts : [])
    .filter(alert => currentTime - Date.parse(alert.at) <= 48 * 60 * 60 * 1000);
  if (previous?.complete !== true || !Array.isArray(previous?.items)) return carried.slice(-100);

  const before = new Map(previousItems.map(item => [item.id, item]));
  const fresh = [];
  for (const item of items) {
    if (!/^(nissei|cellshop)$/i.test(item.store || '')) continue;
    const old = before.get(item.id);
    let type = '';
    if (old && Number(item.priceUsd) < Number(old.priceUsd) - 0.009) type = 'price-drop';
    else if (!old && Number(item.off) > 0) type = 'new-deal';
    if (!type) continue;
    const fromPriceUsd = old ? Number(old.priceUsd) : Number(item.oldPriceUsd);
    fresh.push({
      id: [type, item.id, fromPriceUsd, item.priceUsd].join(':'),
      type,
      at: checkedAt,
      name: item.name,
      store: item.store,
      priceUsd: Number(item.priceUsd),
      fromPriceUsd,
      off: Number(item.off) || 0,
      url: item.url || item.storeUrl || item.sourceUrl || '',
    });
  }
  const merged = new Map([...carried, ...fresh].map(alert => [alert.id, alert]));
  return [...merged.values()].slice(-100);
};
