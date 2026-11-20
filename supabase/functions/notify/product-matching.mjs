const CATEGORY_RULES = [
  // Tipos principales primero: Core i5, SSD o RAM dentro de una notebook
  // son especificaciones, no convierten al equipo en CPU/almacenamiento.
  { id: 'laptop', label: 'Notebooks', pattern: /\b(?:notebooks?|laptops?|ultrabooks?|ideapad|thinkpad|thinkbook|vivobook|zenbook|macbook|aspire|pavilion)\b/i },
  { id: 'tablet', label: 'Tablets', pattern: /\b(?:tablets?|ipad)\b/i },
  { id: 'smartphone', label: 'Celulares', pattern: /\b(?:smartphones?|celulares?|iphone|galaxy\s*[sz]\d|mobile\s*phone)\b/i },
  { id: 'television', label: 'Televisores', pattern: /\b(?:televisor(?:es)?|television(?:es)?|smart\s*tv|tv\s*\d{2,3})\b/i },
  { id: 'monitor', label: 'Monitores', pattern: /\b(?:monitors?|monitores?)\b/i },
  { id: 'keyboard', label: 'Teclados', pattern: /\b(?:teclados?|keyboards?)\b/i },
  { id: 'mouse', label: 'Mouse', pattern: /\b(?:mouse|mouses|ratones?)\b/i },
  { id: 'router', label: 'Routers', pattern: /\b(?:routers?|roteadores?|access\s*points?)\b/i },
  // Las tiendas alternan "Buds", "earbuds", "auricular" y "fonos" para el mismo tipo.
  { id: 'audio', label: 'Audio', pattern: /\b(?:earbuds?|airpods?|air\s*pods|airbuds?|buds|in[\s-]?ear)\b/i },
  { id: 'audio', label: 'Audio', pattern: /\b(?:headphones?|over[\s-]?ear|on[\s-]?ear)\b/i },
  { id: 'audio', label: 'Audio', pattern: /\b(?:auricular(?:es)?|audifono(?:s)?|earphones?|fonos?)\b/i },
  { id: 'cpu', label: 'Procesadores', pattern: /\b(?:processadores?|processors?|cpu|ryzen|threadripper|xeon|core\s*i[3579])\b/i },
  { id: 'gpu', label: 'Placas de video', pattern: /\b(?:placa\s*(?:de\s*)?video|graphics?\s*card|gpu|geforce|rtx\s*\d|radeon)\b/i },
  { id: 'storage', label: 'Almacenamiento', pattern: /\b(?:ssd|hdd|discos?\s*(?:duros?)?|solid\s*state|nvme)\b/i },
  { id: 'ram', label: 'Memoria RAM', pattern: /\b(?:memoria\s*ram|ram\s*(?:ddr[345])?|ddr[345])\b/i },
  { id: 'shoes', label: 'Calzado', pattern: /\b(?:calzados?|zapatos?|sneakers?|tenis|zapatillas)\b/i },
  { id: 'fan', label: 'Ventiladores', pattern: /\b(?:ventilador(?:es)?|fans?)\b/i },
];

const BRANDS = [
  'blackview', 'sennheiser', 'soundcore', 'motorola', 'logitech', 'gigabyte',
  'xiaomi', 'redmi', 'samsung', 'nvidia', 'corsair', 'hyperx', 'razer',
  'philips', 'marshall', 'jabra', 'baseus', 'hisense', 'lenovo', 'huawei',
  'pioneer', 'jbl', 'nokia', 'sony', 'apple', 'anker', 'asus', 'acer',
  'intel', 'amd', 'msi', 'dell', 'hp', 'lg', 'tcl', 'adidas', 'converse',
];

const STOP_WORDS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'con', 'para', 'por', 'y', 'the',
  'new', 'nuevo', 'nueva', 'original', 'color', 'negro', 'negra', 'black',
  'blanco', 'blanca', 'white', 'blue', 'azul', 'red', 'rojo', 'roja',
  'green', 'verde', 'gray', 'grey', 'gris', 'silver', 'plata', 'obsidian',
  'graphite', 'midnight', 'bluetooth', 'wireless', 'inalambrico',
  'inalambricos', 'usb', 'type', 'cable', 'gaming', 'gamer', 'microfono',
  'microfonos', 'auricular', 'auriculares', 'audifono', 'audifonos',
  'headphone', 'headphones', 'headset', 'earbud', 'earbuds', 'earphones',
  'procesador', 'processador', 'processor', 'cpu', 'dispositivo', 'unidad',
]);

const normalizeProductName = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const categoryFor = value => {
  const name = typeof value === 'string'
    ? value
    : [value?.name, value?.category].filter(Boolean).join(' ');
  const rule = CATEGORY_RULES.find(item => item.pattern.test(String(name || '')));
  return rule ? { id: rule.id, label: rule.label } : null;
};

const brandFor = value => {
  const words = normalizeProductName(value).split(' ');
  if (words.includes('xiaomi') || words.includes('redmi')) return 'xiaomi';
  return BRANDS.find(brand => words.includes(brand)) || '';
};

const modelCodes = value => {
  // No usar números de familia/especificación como si fueran SKU (Ryzen 7, SSD 990,
  // capacidad 2TB). Se priorizan identificadores compactos con letras y números.
  const matches = String(value || '').match(/\b(?:[a-z]{1,6}-?\d[a-z0-9-]*|\d{2,}[a-z]{1,6}[a-z0-9-]*|\d{4,}[a-z]{0,3})\b/gi) || [];
  const codes = new Set();
  for (const match of matches) {
    const code = match.toLowerCase().replace(/[^a-z0-9]/g, '');
    // Capacidades/unidades y estándares Wi-Fi (8GB, 2TB, 165Hz, AC1200)
    // describen especificaciones compartidas, no identifican el producto.
    if (/^\d+(?:gb|tb|mb|mhz|ghz|hz|mah|inch|in|cm|mm|w|v)$/.test(code)) continue;
    if (/^(?:ac|ax)\d{3,4}$/.test(code) || /^\d{4}$/.test(code) ||
        /^(?:am[45]|lga\d{3,5}|ddr[345]|pcie\d(?:\.\d)?|gen\d|wifi\d|usb\d)$/.test(code)) continue;
    const hasLetter = /[a-z]/.test(code);
    const digitCount = (code.match(/\d/g) || []).length;
    // Modelos cortos como C20, C64, T3U o AX55 son IDs válidos.
    if (code.length >= 3 && hasLetter && digitCount >= 1) codes.add(code);
    else if (/^\d{5,}$/.test(code)) codes.add(code);
    for (const suffix of match.match(/\d{4,}[a-z]{0,3}/gi) || []) {
      const normalized = suffix.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalized.length >= 4 && !/^\d{4}$/.test(normalized)) codes.add(normalized);
    }
  }

  // RTX/GTX/Radeon RX: el sufijo Ti/Super/XT cambia el modelo, no se descarta.
  const gpu = normalizeProductName(value).match(/\b(rtx|gtx|rx)\s*(\d{3,4})\s*(ti\s*super|ti|super|xtx|xt|gre)?\b/i);
  if (gpu) {
    const family = gpu[1].toLowerCase();
    const number = gpu[2];
    const variant = (gpu[3] || '').replace(/\s+/g, '').toLowerCase();
    codes.delete(number);
    codes.delete(family + number);
    codes.add(family + number + variant);
  }
  return [...codes];
};

const capacities = value => [...new Set(
  [...String(value || '').matchAll(/\b(\d+(?:[.,]\d+)?)\s*(tb|gb|mb)\b/gi)]
    .map(match => Number(match[1].replace(',', '.')) + match[2].toLowerCase())
)];

const significantTokens = value => normalizeProductName(value)
  .split(' ')
  .filter(token => token.length > 1 && !STOP_WORDS.has(token) && !BRANDS.includes(token) && !/\d/.test(token));

export const isSameProductModel = (left, right) => {
  const leftName = String(left?.name || '');
  const rightName = String(right?.name || '');
  const leftNormalized = normalizeProductName(leftName);
  const rightNormalized = normalizeProductName(rightName);
  if (!leftNormalized || !rightNormalized) return false;

  const leftBrand = brandFor(leftName);
  const rightBrand = brandFor(rightName);
  if (leftBrand && rightBrand && leftBrand !== rightBrand) return false;

  // Si ambas tiendas describen categorías conocidas y no coinciden, no alcanza
  // con compartir un número/SKU para afirmar que es el mismo producto.
  const leftCategory = categoryFor(leftName);
  const rightCategory = categoryFor(rightName);
  if (leftCategory && rightCategory && leftCategory.id !== rightCategory.id) return false;
  const leftCapacities = capacities(leftName);
  const rightCapacities = capacities(rightName);
  if (leftCapacities.length && rightCapacities.length &&
      (leftCapacities.length !== rightCapacities.length ||
       leftCapacities.some(capacity => !rightCapacities.includes(capacity)))) return false;
  if (leftNormalized === rightNormalized) return true;

  const leftCodes = modelCodes(leftName);
  const rightCodes = modelCodes(rightName);
  if (leftCodes.some(code => rightCodes.includes(code))) return true;
  if ((leftCategory && !rightCategory) || (!leftCategory && rightCategory)) return false;
  if (leftCodes.length || rightCodes.length) return false;

  const a = significantTokens(leftName);
  const b = significantTokens(rightName);
  if (a.length < 3 || b.length < 3) return false;
  const common = a.filter(token => b.includes(token));
  const union = new Set([...a, ...b]).size;
  return common.length >= 3 && common.length / union >= 0.82;
};

export const safeProductUrl = value => {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
};

export const findWishlistMatch = (items, wishlistItem) => {
  const url = safeProductUrl(wishlistItem?.url);
  const name = normalizeProductName(wishlistItem?.name);
  const shop = String(wishlistItem?.shop || '');
  return items.find(item => url && safeProductUrl(item?.url) === url)
    || items.find(item => shop && item?.shop === shop && normalizeProductName(item?.name) === name)
    || items.find(item => isSameProductModel(wishlistItem, item))
    || null;
};
