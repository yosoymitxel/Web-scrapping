import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findWishlistMatch,
  isSameProductModel,
  safeProductUrl,
} from '../supabase/functions/notify/product-matching.mjs';

const product = (name, price, shop, slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')) => ({
  name,
  price,
  shop,
  url: 'https://example.com/' + slug,
});

const crossStoreCases = [
  {
    label: 'Xiaomi Redmi Buds 8 Pro entre Nissei y Cellshop',
    wanted: product('Auricular Xiaomi Redmi Buds 8 Pro Bluetooth M2535E1 Obsidian Black', 460000, 'Nissei'),
    found: product('Auricular Xiaomi Redmi Buds 8 Pro Bluetooth M2535E1 Negro', 403248, 'Cellshop'),
  },
  {
    label: 'AMD Ryzen 7 5700X entre Contimarket y Cellshop',
    wanted: product('CPU AMD AM4 RYZEN R7-5700X 3.4GHZ/36MB', 1734600, 'Contimarket'),
    found: product('Processador AMD Ryzen 7 5700X 4.60GHz 8 Núcleos 36MB Socket AM4 Sem Cooler', 1539646, 'Cellshop'),
  },
  {
    label: 'Samsung Galaxy S24 Ultra con código de modelo',
    wanted: product('Samsung Galaxy S24 Ultra 5G 256GB SM-S928B', 8000000, 'Nissei'),
    found: product('Smartphone Samsung S24 Ultra 5G SM-S928B 256 GB Dual SIM', 7800000, 'Cellshop'),
  },
  {
    label: 'Lenovo IdeaPad con código alfanumérico iniciado en números',
    wanted: product('Notebook Lenovo IdeaPad 3 15ITL6 Intel Core i5 8GB 256GB SSD', 3200000, 'Nissei'),
    found: product('Lenovo IdeaPad 3 15ITL6 i5 8GB SSD 256GB', 3100000, 'Tupi'),
  },
  {
    label: 'Samsung 990 PRO SSD con SKU',
    wanted: product('SSD Samsung 990 PRO 2TB MZ-V9P2T0BW NVMe', 1450000, 'Cellshop'),
    found: product('Samsung 990 PRO MZ-V9P2T0BW 2 TB PCIe 4.0', 1390000, 'Nissei'),
  },
  {
    label: 'Router TP-Link Archer AX55',
    wanted: product('Router TP-Link Archer AX55 Wi-Fi 6 Dual Band Gigabit', 650000, 'Tupi'),
    found: product('TP-Link Archer AX55 Gigabit WiFi 6 Router', 610000, 'Nissei'),
  },
  {
    label: 'Monitor LG UltraGear 27GP850-B',
    wanted: product('Monitor Gamer LG UltraGear 27GP850-B 27 pulgadas QHD', 2500000, 'Cellshop'),
    found: product('LG UltraGear 27GP850-B IPS 165Hz 27 QHD Monitor', 2390000, 'Nissei'),
  },
  {
    label: 'MSI RTX 4070 SUPER con nombres distintos entre tiendas',
    wanted: product('Placa de video MSI GeForce RTX 4070 SUPER Ventus 2X 12GB OC', 4300000, 'Cellshop'),
    found: product('MSI VGA RTX4070 SUPER 12G Ventus 2X OC', 4150000, 'Nissei'),
  },
  {
    label: 'Adidas HQ8708 con título abreviado',
    wanted: product('Zapatilla Adidas Ultraboost 22 HQ8708 Negro', 950000, 'Tupi'),
    found: product('Adidas Ultraboost 22 HQ8708 Shoes Black', 900000, 'Bristol'),
  },
];

test('reconoce el mismo modelo entre tiendas con títulos y formatos diferentes', () => {
  for (const fixture of crossStoreCases) {
    assert.equal(isSameProductModel(fixture.wanted, fixture.found), true, fixture.label);
    const cheaperNoise = product('Calzado Converse CTAS Lift Ox White', 10000, 'Tienda barata');
    assert.equal(findWishlistMatch([cheaperNoise, fixture.found], fixture.wanted), fixture.found, fixture.label);
  }
});

test('no interpreta capacidades técnicas como códigos de modelo', () => {
  const gpuSuper = product('MSI GeForce RTX 4070 SUPER Ventus 2X 12GB OC', 4300000, 'Cellshop');
  const gpuTi = product('MSI GeForce RTX 4070 Ti Ventus 2X 12GB OC', 4800000, 'Nissei');
  assert.equal(isSameProductModel(gpuSuper, gpuTi), false);

  const laptop = product('Notebook Lenovo IdeaPad 3 15ITL6 Intel Core i5 8GB 256GB SSD', 3200000, 'Nissei');
  const sameLaptop = product('Lenovo IdeaPad 3 15ITL6 i5 8GB SSD 256GB', 3100000, 'Tupi');
  assert.equal(isSameProductModel(laptop, sameLaptop), true);
});


test('coincidencia confirmada de Xiaomi M2535E1 aunque una tienda simplifique el título', () => {
  const wanted = product('Auricular Xiaomi Redmi Buds 8 Pro M2535E1 Bluetooth Obsidian Black', 460000, 'Nissei');
  const otherStore = product('Auricular Xiaomi M2535E1 Bluetooth', 410000, 'Tienda alternativa');
  assert.equal(isSameProductModel(wanted, otherStore), true);
});

test('interpreta correctamente tipos principales y nombres equivalentes de audio', () => {
  const buds = product('Auricular Xiaomi Redmi Buds 8 Pro M2535E1 Bluetooth', 460000, 'Nissei');
  const generic = product('Auricular Xiaomi M2535E1 Bluetooth', 410000, 'Cellshop');
  assert.equal(isSameProductModel(buds, generic), true);

  const laptop = product('Notebook Lenovo IdeaPad 3 15ITL6 Intel Core i5 8GB 256GB SSD', 3200000, 'Nissei');
  const sameLaptop = product('Lenovo IdeaPad 3 15ITL6 i5 8GB SSD 256GB', 3100000, 'Tupi');
  assert.equal(isSameProductModel(laptop, sameLaptop), true);
});


test('no confunde generaciones ni variantes de modelo distintas', () => {
  const earbuds = product('Auricular Xiaomi Redmi Buds 8 Pro M2535E1 Bluetooth', 460000, 'Nissei');
  const olderBuds = product('Auricular Xiaomi Redmi Buds 6 Play M2420E1 Bluetooth', 86000, 'Tupi');
  assert.equal(isSameProductModel(earbuds, olderBuds), false);

  const cpu = product('AMD Ryzen 7 5700X Socket AM4', 1700000, 'Contimarket');
  const otherCpu = product('AMD Ryzen 7 5700G Socket AM4', 900000, 'Nissei');
  assert.equal(isSameProductModel(cpu, otherCpu), false);

  const gpuSuper = product('MSI GeForce RTX 4070 SUPER Ventus 2X 12GB OC', 4300000, 'Cellshop');
  const gpuTi = product('MSI GeForce RTX 4070 Ti Ventus 2X 12GB OC', 4800000, 'Nissei');
  assert.equal(isSameProductModel(gpuSuper, gpuTi), false);

  const ssd2tb = product('SSD Samsung 990 PRO 2TB MZ-V9P2T0BW', 1450000, 'Cellshop');
  const ssd1tb = product('SSD Samsung 990 PRO 1TB MZ-V9P1T0BW', 900000, 'Tupi');
  assert.equal(isSameProductModel(ssd2tb, ssd1tb), false);
});

test('rechaza marcas o categorías incompatibles aunque coincida un código', () => {
  const samsungPhone = product('Samsung Galaxy S24 Ultra Smartphone SM-S928B', 8000000, 'Nissei');
  const otherBrand = product('Xiaomi Smartphone SM-S928B', 5000000, 'Tupi');
  assert.equal(isSameProductModel(samsungPhone, otherBrand), false);

  const adapter = product('Adaptador PCI TP-Link AC1200 Archer T4E', 300000, 'Contimarket');
  const router = product('Router TP-Link Archer C20 AC1200 Dual Band', 350000, 'Nissei');
  assert.equal(isSameProductModel(adapter, router), false);

  const nanoT3U = product('Adaptador WiFi TP-Link Archer T3U Nano AC1300 USB', 180000, 'Tienda Naranja');
  const nanoTX10 = product('Adaptador TP-Link AX900 Archer TX10UB Nano', 200000, 'Contimarket');
  assert.equal(isSameProductModel(nanoT3U, nanoTX10), false);

  const routerC20 = product('Router TP-Link Archer C20 AC1200 Dual Band', 350000, 'Nissei');
  const routerC64 = product('Router TP-Link Archer C64 AC1200 Dual Band MIMO', 390000, 'Tienda Naranja');
  assert.equal(isSameProductModel(routerC20, routerC64), false);

  const ssd1tb = product('SSD Samsung 990 PRO 1TB NVMe MZ-V9P1T0B/AM', 900000, 'Tupi');
  const ssd2tb = product('SSD Samsung 990 PRO 2TB NVMe MZ-V9P2T0B/AM', 1400000, 'Cellshop');
  assert.equal(isSameProductModel(ssd1tb, ssd2tb), false);

  const phone = product('Samsung Galaxy A07 4G 128GB SM-A075M/DS', 800000, 'Nissei');
  const tablet = product('Tablet Samsung Galaxy S10 Lite 10.9 6+128GB 2025', 1500000, 'Tienda Naranja');
  assert.equal(isSameProductModel(phone, tablet), false);

  const earbuds = product('Auricular Xiaomi M2535E1 Bluetooth', 460000, 'Nissei');
  const television = product('Televisor Xiaomi M2535E1 4K', 1000000, 'Tupi');
  assert.equal(isSameProductModel(earbuds, television), false);
});

test('no devuelve un producto de otra categoría cuando no hay modelo equivalente', () => {
  const wanted = product('CPU AMD Ryzen 7 5700X Socket AM4', 1734600, 'Contimarket');
  const unrelated = product('Calzado Converse CTAS Lift Ox White', 430000, 'Tupi');
  assert.equal(findWishlistMatch([unrelated], wanted), null);
});

test('la URL que se usa como coincidencia debe ser HTTPS', () => {
  assert.equal(safeProductUrl('https://cellshop.com.py/producto/5700x').startsWith('https://'), true);
  assert.equal(safeProductUrl('javascript:alert(1)'), '');
  assert.equal(safeProductUrl('http://cellshop.com.py/producto/5700x'), '');
});
