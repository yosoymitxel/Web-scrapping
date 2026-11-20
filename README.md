# Panel

**https://yosoymitxel.github.io/Web-scrapping/**

| Pestaña | Qué hace | Fuente |
|---|---|---|
| Asphalt | Códigos vigentes; «Canjear» copia y abre el canje | PocketGamer → Gameloft |
| Juegos · Gratis | Juegos gratis de PC, Steam y Epic primero | GamerPower |
| Juegos · Deseados | Lista de deseados con precio Steam (región PY) y la tienda más barata | Steam + CheapShark |
| Juegos · Bundles | Bundles de juegos activos | Humble Bundle |
| Tarjetas | Promociones bancarias, descuentos directos en locales, búsqueda de precios en tiendas paraguayas, wishlist sincronizada y avisos push | [PromoScraper](https://yosoymitxel.github.io/promociones-tarjetas-bancos-paraguay-py/) · [Comparaguay](https://comparaguay.com.py/evento/black-friday/) |
| Cabecera | Dólar en ₲ y conversor; todos los precios usan esa cotización | open.er-api.com |

Datos: `scripts/update.mjs`, que corre en Actions → **update** cada 3 h (o «Run workflow»).
Lo canjeado y las búsquedas recientes quedan en el navegador.


La wishlist de productos se sincroniza por cuenta entre dispositivos. Los avisos push por dispositivo se registran en Supabase y la función `notify` revisa precios y posibles bajadas cada 3 horas junto con las actualizaciones programadas.


Los descuentos directos de locales comparan precio anterior y actual (fuente Comparaguay). Se mantienen separados de cuotas y reintegros; las alertas push avisan de nuevas ofertas o nuevas bajadas en Nissei y Cellshop. Los precios de esa fuente pueden requerir IVA para residentes en Paraguay.
