const patterns = [
  ['Gaming', /\b(playstation|ps[345]|xbox|nintendo|switch lite|switch oled|switch v2|videoconsola|joystick|gamepad)\b/],
  ['Tablets', /\b(tablet|ipad|galaxy tab|kindle|e reader)\b/],
  ['Celulares', /\b(iphone|celular(?:es)?|smartphones?|redmi note|redmi [0-9]+|poco [a-z]?[0-9]+|galaxy [sa][0-9]+|moto g[0-9]+|motorola edge)\b/],
  ['Computación', /\b(notebook|laptop|desktop|pc|cpu|procesador|ryzen|intel core|motherboard|placa madre|memoria ram|ram|ssd|hdd|nvme|gpu|tarjeta de video|monitor|teclado|mouse|router|switch de red|gabinete|fuente de alimentacion)\b/],
  ['TV y video', /\b(televisor|smart tv|tv|qled|oled|proyector|projector|blu ray|reproductor de video)\b/],
  ['Audio', /\b(auriculares?|audifonos?|fone|headphones?|headset|earbuds|parlantes?|speakers?|sound ?bar|home theater|microfonos?|microphone|amplificador|consola de audio)\b/],
  ['Electrodomésticos', /\b(heladera|refrigerador|freezer|congelador|lavarropas|lavadora|secadora|microondas|horno|anafe|cocina a gas|freidora|air fryer|licuadora|batidora|cafetera|pava electrica|aspiradora|plancha|ventilador|aire acondicionado|acondicionador de aire|purificador|humidificador|deshumidificador)\b/],
  ['Hogar', /\b(sofa|sillon|colchon|mueble|mesa|silla|ropero|placard|escritorio|estanteria|cama|almohada|juego de comedor|vajilla|cortina|lampara)\b/],
  ['Herramientas', /\b(taladro|amoladora|atornillador|sierra|soldadora|compresor|hidrolavadora|herramienta|llave de impacto)\b/],
  ['Moda', /\b(zapatillas?|calzados?|zapatos?|botas?|sandalias?|remeras?|camisetas?|camisas?|pantalones?|jeans|vestidos?|camperas?|buzos?|ropa|mochilas?|carteras?|billeteras?|relojes?)\b/],
  ['Belleza y cuidado personal', /\b(perfumes?|fragancias?|maquillaje|cremas?|shampoo|acondicionador|afeitadora|depiladora|secador de pelo|planchita|cuidado personal|skincare)\b/],
  ['Deportes', /\b(pelota|balon|futbol|basquet|tenis|bicicleta|mancuernas?|pesas|colchoneta|fitness|deportivo|deportes)\b/],
  ['Juguetes', /\b(juguete|muñec[oa]s?|lego|bloques de construccion|peluche|puzzle|rompecabezas)\b/],
  ['Alimentos y bebidas', /\b(galletitas?|galletas?|arroz|aceite|yerba|cafe|cacao|leche|queso|fideos|pasta|harina|azucar|bebida|gaseosa|jugo|snack|chocolate|conserva)\b/],
];

const normalize = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

export const categoryOfProduct = name => {
  const normalized = normalize(name);
  return patterns.find(([, pattern]) => pattern.test(normalized))?.[0] || 'Otros';
};

export const filterProducts = (items, { shop = '', category = '', minPrice = null, maxPrice = null, onlyOff = false } = {}) =>
  items.filter(product => {
    const price = Number(product.price);
    return (!shop || product.shop === shop) &&
      (!category || categoryOfProduct(product.name) === category) &&
      (minPrice === null || price >= minPrice) &&
      (maxPrice === null || price <= maxPrice) &&
      (!onlyOff || Number(product.off) > 0 || Number(product.old) > price);
  });
