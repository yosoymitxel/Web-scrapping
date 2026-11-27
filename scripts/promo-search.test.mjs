import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePromoSearchText, scorePromoSearch, searchPromos } from './promo-search.mjs';

const basa = {
  id: 'basa-farmacenter',
  title: 'Farmacenter',
  bankId: 'basa',
  bankShort: 'BASA',
  bankName: 'Banco BASA',
  desc: '20% de reintegro con Visa Signature y Mastercard Black los martes.',
  cards: ['Visa Signature', 'Mastercard Black'],
  category: 'Salud y belleza',
  days: ['Martes'],
  discount_percent: 20,
};

const itau = {
  id: 'itau-superseis',
  title: 'Superseis',
  bankId: 'itau',
  bankShort: 'Itaú',
  desc: '10% de descuento con Visa Signature.',
  cards: ['Visa Signature'],
  category: 'Supermercados',
  days: ['Miércoles'],
  discount_percent: 10,
};

test('normaliza acentos, mayúsculas y signos', () => {
  assert.equal(normalizePromoSearchText('Itaú · Visa Signature 20%'), 'itau visa signature 20');
});

test('encuentra comercios por nombre', () => {
  assert.deepEqual(searchPromos([basa, itau], 'farmacenter'), [basa]);
});

test('encuentra por tarjeta y banco aunque no estén en el título', () => {
  assert.deepEqual(searchPromos([basa, itau], 'BASA Visa Signature'), [basa]);
  assert.deepEqual(searchPromos([basa, itau], 'Mastercard Black'), [basa]);
});

test('combina comercio, banco, tarjeta y porcentaje en una sola consulta', () => {
  assert.deepEqual(searchPromos([basa, itau], 'Farmacenter BASA Visa Signature 20%'), [basa]);
});

test('acepta términos de cuotas y categoría', () => {
  const installments = { ...itau, title: 'Electrodomésticos', installments: 12, discount_percent: null };
  assert.deepEqual(searchPromos([installments], 'electrodomesticos 12 cuotas supermercados'), [installments]);
});

test('exige que coincidan todos los términos de búsqueda', () => {
  assert.deepEqual(searchPromos([basa, itau], 'BASA American Express'), []);
  assert.equal(scorePromoSearch(basa, 'Visa Diners'), -1);
});

test('prioriza los bancos seleccionados en el perfil sin excluir otros resultados', () => {
  assert.deepEqual(searchPromos([itau, basa], 'Visa Signature', ['BASA']), [basa, itau]);
});

test('no devuelve todo el catálogo cuando la consulta está vacía', () => {
  assert.deepEqual(searchPromos([basa, itau], '   '), []);
});
