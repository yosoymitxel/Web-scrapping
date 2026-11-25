import test from 'node:test';
import assert from 'node:assert/strict';
import { categoryOfProduct, filterProducts } from './product-filters.mjs';

test('clasifica categorías frecuentes de productos paraguayos', () => {
  const cases = [
    ['iPhone 16 128GB', 'Celulares'],
    ['Samsung Galaxy Tab S9', 'Tablets'],
    ['Notebook Lenovo IdeaPad 3', 'Computación'],
    ['Mouse Logitech G305', 'Computación'],
    ['PlayStation 5 Slim', 'Gaming'],
    ['Smart TV Samsung 55 QLED', 'TV y video'],
    ['Auriculares Xiaomi Redmi Buds', 'Audio'],
    ['Lavarropas Whirlpool 10kg', 'Electrodomésticos'],
    ['Sillón de 3 cuerpos', 'Hogar'],
    ['Zapatillas Adidas Runfalcon', 'Moda'],
    ['Taladro Bosch 750W', 'Herramientas'],
    ['Perfume Carolina Herrera', 'Belleza y cuidado personal'],
    ['Pelota de fútbol número 5', 'Deportes'],
    ['Set LEGO City', 'Juguetes'],
    ['Galletitas de chocolate', 'Alimentos y bebidas'],
    ['Artículo sin categoría reconocible', 'Otros'],
  ];
  for (const [name, expected] of cases) assert.equal(categoryOfProduct(name), expected, name);
});

test('combina categoría y rango de precios con límites inclusivos', () => {
  const products = [
    { name: 'iPhone 16', price: 5000000, shop: 'Nissei' },
    { name: 'Samsung Galaxy A55', price: 3000000, shop: 'Tupi', off: 10 },
    { name: 'PlayStation 5 Slim', price: 4000000, shop: 'Nissei', old: 4500000 },
    { name: 'Auriculares Xiaomi Redmi Buds', price: 600000, shop: 'Tupi' },
  ];
  assert.deepEqual(
    filterProducts(products, { category: 'Celulares', minPrice: 3000000, maxPrice: 5000000 }),
    products.slice(0, 2)
  );
});

test('combina tienda, descuento, categoría y precio', () => {
  const products = [
    { name: 'Samsung Galaxy A55', price: 3000000, shop: 'Tupi', off: 10 },
    { name: 'iPhone 16', price: 5000000, shop: 'Nissei' },
    { name: 'PlayStation 5 Slim', price: 4000000, shop: 'Tupi', old: 4500000 },
  ];
  assert.deepEqual(
    filterProducts(products, { shop: 'Tupi', category: 'Gaming', minPrice: 3500000, maxPrice: 4500000, onlyOff: true }),
    [products[2]]
  );
});

test('no incluye productos por encima o debajo del rango ni trata categorías desconocidas como universales', () => {
  const products = [
    { name: 'Notebook Lenovo', price: 2500000, shop: 'A' },
    { name: 'Mesa de madera', price: 1000000, shop: 'A' },
    { name: 'Artículo sin categoría', price: 700000, shop: 'A' },
  ];
  assert.deepEqual(filterProducts(products, { minPrice: 1000000, maxPrice: 2000000 }), [products[1]]);
  assert.deepEqual(filterProducts(products, { category: 'Otros' }), [products[2]]);
});
