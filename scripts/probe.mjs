// Revalida un paso de update.mjs sin commitear
process.env.ONLY ||= 'shoppings';
await import('./update.mjs');
