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

Define una clave en **Ajustes → Operación** (o la variable `CRON_SECRET`) y
programa en Coolify una tarea cada 10 minutos:

```
curl -fsS "https://tusseguidores.cl/api/cron/sincronizar?key=TU_CLAVE"
```

Ese cron hace dos cosas: reintenta los pedidos pagados que no alcanzaron a
salir al proveedor y actualiza el avance de los que ya están en curso. **No es
opcional**: es lo que rescata los pedidos que quedaron atascados.

### Si el proveedor se queda sin saldo

El cobro y la entrega son dos cosas separadas: Flow cobra, y recién después la
tienda le pide el pedido al proveedor. Si en ese momento no hay saldo, el
proveedor lo rechaza y el pedido queda **pagado sin enviar**. No se pierde:

- Queda registrado el motivo exacto en el historial del pedido.
- El resumen del panel muestra una alerta roja con cuántos son y por cuánta
  plata, más el saldo actual del proveedor.
- El cron los reintenta en cada pasada, así que **al recargar el saldo salen
  solos**, sin tocar nada.
- También puedes forzarlo con «Reintentar pedidos sin enviar» en la lista de
  pedidos, o enviar uno suelto desde su ficha.

En **Ajustes → Proveedor** se configura a partir de qué monto avisar (por
defecto US$10). Y en **Ajustes → La tienda** puedes desmarcar «Recibir pedidos»
para dejar de vender mientras recargas.

---

## Configuración inicial en el panel

Todo se configura en `/admin/ajustes`; no hace falta volver a desplegar.

| Sección | Qué poner |
|---|---|
| **La tienda** | Nombre, dominio, correo de contacto y WhatsApp. |
| **Precios** | Valor del dólar, margen global y precios mínimos. |
| **Proveedor** | La API key de honestsmm (la sacas de tu página de cuenta). |
| **Pagos** | API key y secret key de Flow. Arriba de la sección dice en qué entorno se está cobrando de verdad. |
| **SEO** | Título, descripción y verificación de Google Search Console. |

En el panel de **Flow** configura:

- URL de confirmación: `https://tusseguidores.cl/api/flow/confirmar`
- URL de retorno: `https://tusseguidores.cl/pago/retorno`

> **Deja `FLOW_SANDBOX` sin definir en Coolify.** Si tiene un valor, manda sobre
> la casilla «Modo de pruebas» del panel: la desmarcas, guardas, y el sitio
> sigue cobrando en sandbox sin decir por qué. Lo mismo vale para
> `FLOW_API_KEY`, `FLOW_SECRET_KEY` y `PROVIDER_API_KEY`. Cuando una variable
> está pisando un valor, el panel ahora lo avisa junto al campo.

> **Las credenciales de pruebas y las de producción son distintas.** Las de
> `sandbox.flow.cl` no sirven en `www.flow.cl` ni al revés: si las mezclas, Flow
> responde `apiKey not found` y nadie puede pagar. En **Ajustes** hay un botón
> «Probar las credenciales de Flow» que consulta sin cobrar nada y te dice si el
> problema es el entorno, la secret key o la conexión.

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

### Agregar un producto

**Panel → Productos → Agregar producto.** Eliges la red y qué quieres vender:
las opciones que aparecen son las combinaciones que el proveedor realmente
puede atender, no los casi 2.000 servicios sueltos. Cada tarjeta muestra el
mejor servicio que encontró, cuántos hay de repuesto, la calidad y los precios
que va a tener. Un clic en «Crear» deja el producto publicado con nombre,
descripción, preguntas frecuentes y SEO en español, listos para editar.

El catálogo del proveedor sigue disponible para cuando necesites un servicio
concreto (un país específico, un subtipo raro), pero no es la vía normal.

### Formas de pedido

La API del proveedor no pide lo mismo para todos los servicios, y equivocarse
entrega cualquier cosa. Cada servicio queda marcado con su forma de pedido
(`order_kind`), leída del campo `type` que devuelve la API —o del nombre, para
el catálogo importado desde la lista de precios:

| Forma | Qué se le envía | Estado |
|---|---|---|
| `default` | `quantity` | Soportada |
| `custom_comments` | `comments`, el texto de cada comentario | Soportada |
| `poll`, `mentions`, `package`, `subscriptions`, `drip` | parámetros propios | No se venden |

En **comentarios personalizados** el formulario cambia solo: el cliente escribe
los comentarios en un cuadro de texto, uno por línea, y la cantidad —y el
precio— salen de cuántas líneas escribió. Al despachar se envía `comments` y
nunca `quantity`.

Las formas que la tienda no implementa quedan fuera del enrutado y del creador
de productos, para que no se puedan vender por accidente.

### Elección del servicio del proveedor

El cliente elige **un producto** ("Seguidores para Instagram"), nunca un servicio
del proveedor. La tienda decide sola a cuál de los servicios equivalentes se lo
pide, y lo vuelve a decidir en el momento de despacharlo.

Cada servicio importado se puntúa de 0 a 100 en dos ejes, leídos de su nombre,
sus banderas de reposición y su tiempo promedio:

- **Retención** (`drop_score`): Non Drop, Low Drop, High Drops, días de
  reposición, "Real / HQ" frente a "Bot Users".
- **Velocidad** (`speed_score`): tiempo promedio real y, si falta, lo que promete
  el nombre (Instant, 0-1H Start, Superfast…).

Al despachar se elige el de mayor `retención × 0,55 + velocidad × 0,45` entre los
que:

- están **activos** en el proveedor (los desactivados quedan fuera solos);
- aceptan la cantidad pedida;
- son del **mismo subtipo** (los likes de una publicación no se enrutan a likes
  de transmisión en vivo) y de la **misma forma de pedido**;
- apuntan a una **audiencia neutra** (global o latinoamericana): un servicio
  marcado como estadounidense, italiano o indio es otro producto —se nota, sobre
  todo en los comentarios— y hay que elegirlo a mano;
- no cuestan más que el servicio de referencia por el **presupuesto** del
  producto (1,35× por defecto), para que el margen no se caiga.

El `provider_service_id` del producto queda como **servicio de referencia**: fija
el precio de venta y los límites. La ficha muestra la entrega y la garantía del
servicio que realmente se va a usar, no las del de referencia.

Todo esto se ve y se ajusta por producto en **Panel → Productos → Elección del
servicio**, que muestra a qué servicio se enviaría un pedido hecho ahora mismo y
las alternativas que se consideraron.

### Pedido, de principio a fin

1. El cliente elige un pack (o una cantidad libre) y deja su enlace y correo.
2. El servidor **recalcula el precio** — nunca confía en el del formulario —,
   elige el mejor servicio disponible y crea el pedido con un código tipo
   `TS-7K2F9Q`.
3. Se crea el pago en Flow y se redirige al cliente.
4. Flow confirma por webhook en `/api/flow/confirmar`. El webhook vuelve a
   consultar el estado a Flow (no confía en el POST), valida el monto y es
   idempotente porque Flow reintenta.
5. Con el pago confirmado se vuelve a elegir el mejor servicio (pudo cambiar
   entre la compra y el pago) y el pedido se envía solo al proveedor.
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
    quality.mjs                 retención, velocidad, región, subtipo y forma de pedido
    routing.ts                  elección del servicio al que se despacha
    offers.ts                   combinaciones vendibles para el creador de productos
    copy.mjs                    textos y SEO en español de cada producto
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
