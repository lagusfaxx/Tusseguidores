# TusSeguidores.cl

Tienda de servicios para redes sociales conectada a la API del proveedor
**honestsmm**, con panel de administración propio, cobros en pesos chilenos por
**Flow** y SEO por producto.

- **Stack**: Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · SQLite
- **Despliegue**: Docker (pensado para Coolify)
- **Base de datos**: un archivo SQLite dentro del volumen de datos. No hay que
  levantar Postgres ni ningún servicio aparte.

---

## Puesta en marcha en Coolify

1. En Coolify crea un recurso nuevo del tipo **Dockerfile** (o **Docker Compose**
   si prefieres usar el `docker-compose.yml` incluido) apuntando a este
   repositorio.
2. Agrega un **volumen persistente** montado en `/app/data`. Ahí viven la base de
   datos y las fotos que subas desde el panel; si lo borras, pierdes todo.
3. Define las variables de entorno (ver `.env.example`). Como mínimo:

   ```
   SITE_URL=https://tusseguidores.cl
   ADMIN_EMAIL=tucorreo@tusseguidores.cl
   ADMIN_PASSWORD=una-contrasena-larga
   ```

4. Despliega. En el primer arranque el contenedor siembra solo la base de datos:
   importa los 1.949 servicios del proveedor, publica 32 productos en español y
   crea tu usuario de administrador.
5. Entra a `https://tusseguidores.cl/admin` y **cambia la contraseña**.

### Cron de seguimiento de pedidos

Para que los pedidos se actualicen solos, define una clave en
**Ajustes → Operación** (o la variable `CRON_SECRET`) y programa en Coolify una
tarea cada 10 minutos:

```
curl -fsS "https://tusseguidores.cl/api/cron/sincronizar?key=TU_CLAVE"
```

---

## Configuración inicial en el panel

Todo se configura en `/admin/ajustes`; no hace falta volver a desplegar.

| Sección | Qué poner |
|---|---|
| **La tienda** | Nombre, dominio, correo de contacto y WhatsApp. |
| **Precios** | Valor del dólar, margen global y precios mínimos. |
| **Proveedor** | La API key de honestsmm (la sacas de tu página de cuenta). |
| **Pagos** | API key y secret key de Flow. Desmarca «modo de pruebas» para cobrar de verdad. |
| **SEO** | Título, descripción y verificación de Google Search Console. |

En el panel de **Flow** configura:

- URL de confirmación: `https://tusseguidores.cl/api/flow/confirmar`
- URL de retorno: `https://tusseguidores.cl/pago/retorno`

---

## Cómo funciona

### Precios

El precio de venta se calcula así:

```
precio = max(
  precio_mínimo,
  redondeo( max( costo_usd × dólar × (1 + margen%),  cantidad/1000 × piso_por_tipo ) )
)
```

El **piso por tipo de servicio** (editable en Ajustes como JSON) es lo que
mantiene la escalera de packs siempre creciente: sin él, servicios que le cuestan
centavos al proveedor harían que 100 y 5.000 unidades costaran lo mismo, el
precio mínimo de la tienda.

Cada producto puede además tener su propio margen o precios totalmente manuales.

### Pedido, de principio a fin

1. El cliente elige un pack (o una cantidad libre) y deja su enlace y correo.
2. El servidor **recalcula el precio** — nunca confía en el del formulario — y
   crea el pedido con un código tipo `TS-7K2F9Q`.
3. Se crea el pago en Flow y se redirige al cliente.
4. Flow confirma por webhook en `/api/flow/confirmar`. El webhook vuelve a
   consultar el estado a Flow (no confía en el POST), valida el monto y es
   idempotente porque Flow reintenta.
5. Con el pago confirmado el pedido se envía solo al proveedor.
6. El cron consulta el avance y el cliente lo sigue en `/pedido/<código>`.

Si Flow todavía no está configurado, el pedido queda **pendiente de pago manual**
y se aprueba desde el panel: la tienda nunca deja al cliente en una pantalla rota.

### SEO

- Metadatos, canonical y Open Graph por página, editables por producto.
- JSON-LD: `Organization`, `WebSite`, `Product` con `AggregateOffer`,
  `BreadcrumbList` y `FAQPage`.
- `sitemap.xml` y `robots.txt` generados desde la base de datos.
- Imagen social en PNG generada al vuelo en `/api/og`.
- El panel de administración y las páginas de pedidos van con `noindex`.

---

## Desarrollo local

```bash
npm install

# 1. Convertir las listas del proveedor en data/catalog.json
npm run parse-catalog -- ruta/precios_panel.txt ruta/services_update.txt

# 2. Sembrar la base de datos (catálogo + productos + usuario admin)
npm run seed

# 3. Generar las portadas de los productos (opcional, ya vienen en el repo)
node scripts/generate-images.mjs

npm run dev
```

La tienda queda en `http://localhost:3000` y el panel en `/admin`
(`admin@tusseguidores.cl` / `cambiaesta123` si no defines otras variables).

### Actualizar el catálogo del proveedor

Lo normal es hacerlo desde **Panel → Catálogo del proveedor → Sincronizar**: se
consulta la API en vivo, se actualizan precios y límites, y los servicios que el
proveedor dio de baja quedan marcados (no se borran, para no romper el historial
de pedidos). El panel te avisa si algún producto publicado quedó apuntando a un
servicio dado de baja.

---

## Estructura

```
src/
  app/
    page.tsx                    portada
    [platform]/                 página por red social
    producto/[slug]/            ficha de producto
    pedido/[code]/              seguimiento
    pago/retorno/               vuelta desde Flow
    admin/(panel)/              panel (protegido)
    api/flow/confirmar/         webhook de Flow
    api/cron/sincronizar/       actualización de estados
  lib/
    schema.sql                  esquema de la base de datos
    pricing.ts                  motor de precios
    provider.ts                 cliente de honestsmm
    flow.ts                     cliente de Flow
    orders.ts                   ciclo de vida de los pedidos
    taxonomy.mjs                clasificación de servicios
scripts/
  parse-catalog.mjs             listas del proveedor -> catalog.json
  seed.mjs                      importación y catálogo inicial
  generate-images.mjs           portadas SVG
```

---

## Notas

- Las contraseñas del panel se guardan con `scrypt` y sal aleatoria.
- El HTML que escribes en el panel se filtra al guardar: solo pasan etiquetas de
  texto, y los enlaces salen con `rel="nofollow noopener"`.
- Las variables de entorno `PROVIDER_API_KEY`, `FLOW_API_KEY`, `FLOW_SECRET_KEY`
  y `CRON_SECRET` tienen prioridad sobre lo guardado en el panel: úsalas si
  prefieres no dejar las claves en la base de datos.
