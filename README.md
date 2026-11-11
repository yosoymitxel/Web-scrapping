# Panel

**https://yosoymitxel.github.io/Web-scrapping/**

| Pestaña | Qué hace | Fuente |
|---|---|---|
| Asphalt | Códigos vigentes; «Canjear» copia y abre el canje | PocketGamer → Gameloft |
| Juegos · Gratis | Juegos gratis de PC, Steam y Epic primero | GamerPower |
| Juegos · Deseados | Lista de deseados con precio Steam (región PY) y la tienda más barata | Steam + CheapShark |
| Juegos · Bundles | Bundles de juegos activos | Humble Bundle |
| Tarjetas | Descuentos por comercio | [PromoScraper](https://yosoymitxel.github.io/promociones-tarjetas-bancos-paraguay-py/) |
| Cabecera | Dólar en ₲ y conversor; todos los precios usan esa cotización | open.er-api.com |

Datos: `scripts/update.mjs`, que corre en Actions → **update** cada 6 h (o «Run workflow»).
Lo canjeado y las búsquedas recientes quedan en el navegador.
