# Panel

**https://yosoymitxel.github.io/Web-scrapping/**

| Pestaña | Qué hace | Fuente |
|---|---|---|
| Asphalt | Códigos vigentes; «Canjear» copia y abre el canje | PocketGamer → Gameloft |
| Juegos · Gratis | Juegos gratis de PC, Steam y Epic primero | GamerPower |
| Juegos · Deseados | Lista de deseados con precio Steam (región PY) y la tienda más barata | Steam + CheapShark |
| Juegos · Bundles | Bundles de juegos activos | Humble Bundle |
| Tarjetas | Descuentos por comercio y búsqueda de precios en tiendas paraguayas, con wishlist sincronizada por cuenta, historial y avisos push de bajadas | [PromoScraper](https://yosoymitxel.github.io/promociones-tarjetas-bancos-paraguay-py/) |
| Cabecera | Dólar en ₲ y conversor; todos los precios usan esa cotización | open.er-api.com |

Datos: `scripts/update.mjs`, que corre en Actions → **update** cada 6 h (o «Run workflow»).
Lo canjeado y las búsquedas recientes quedan en el navegador.


La wishlist de productos se sincroniza por cuenta entre dispositivos. Los avisos push por dispositivo se registran en Supabase y la función `notify` revisa precios y posibles bajadas cada 3 horas junto con las actualizaciones programadas.


La sección «¿Dónde comprás?» permite seguir comercios por cuenta y por un período configurable. `notify` revisa las promociones publicadas en PromoPY cada 3 horas y avisa solo cuando aparece un descuento directo; las cuotas sin interés y el cashback no disparan alertas.
