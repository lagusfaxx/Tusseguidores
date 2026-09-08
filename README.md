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
| **Correos (Resend)** | API key de Resend y el remitente. Sin esto la tienda no manda ningún correo. |
| **Panel mayorista** | Margen de reventa, recarga mínima y cobro mínimo por pedido. |
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
escala  = (1 + margen%) / (1 + margen_de_referencia%)

precio = max(
  precio_mínimo × escala,
  redondeo( max( costo_usd × dólar × (1 + margen%),
                 cantidad/1000 × piso_por_tipo × factor_del_nivel × escala ) )
)
```

El **piso por tipo de servicio** (una tabla editable en Ajustes → Precios) es lo
que mantiene la escalera de packs siempre creciente: sin él, servicios que le
cuestan centavos al proveedor harían que 100 y 5.000 unidades costaran lo mismo,
el precio mínimo de la tienda.

**Los dos pisos se mueven con el margen.** Como el costo del proveedor es de
centavos en casi todo el catálogo, el que fija el precio de verdad suele ser el
piso: con los valores por defecto, el margen manda en uno de cada cinco packs, el
piso en el 44% y el ticket mínimo en el 36%. Con los pisos quietos, bajar el
margen del 180% al 30% no movía ni un peso en la mayoría de la tienda.

Por eso los pisos se escriben **al margen de referencia** (`margin_reference`,
también en Ajustes → Precios) y se escalan con el margen vigente. Deja la
referencia en el margen que tengas hoy: los precios actuales no se mueven, y a
partir de ahí bajar el margen a la mitad del recargo baja toda la tienda en la
misma proporción. Medido sobre el catálogo real: 180% → 120% baja la tienda un
21%, y 180% → 90% un 32%.

Ese piso también explica algo que confunde al mirar el catálogo: cuando es más
alto que el costo con margen, **servicios de costo muy distinto terminan con el
mismo precio de venta**. Con los comentarios pasa siempre — el costo tendría que
superar los US$14 por mil para que mandara el margen. Por eso el catálogo del
panel marca cada precio con su origen (`piso`, `mínimo` o nada si lo fija el
costo) y muestra la **ganancia** como múltiplo sobre el costo: ahí sí se ve la
diferencia entre un servicio de 40× y uno de 325×.

Cada producto puede además tener su propio margen o precios totalmente manuales.

**Con el catálogo por niveles, mover el dólar y el margen global alcanza para
repreciar toda la tienda.** El económico, el estándar y el premium de cada
servicio salen de servicios distintos del proveedor, así que sus costos son
distintos y sus precios se separan solos. Para que el piso por tipo no los
aplaste contra el mismo número, se escala con el nivel: ×1 el económico, ×1,3 el
estándar y ×1,75 el premium.

### Catálogo automático por niveles

**Panel → Productos → Generar catálogo por niveles.** De cada combinación red +
servicio publica hasta tres productos:

| Nivel | Qué servicio elige | Para quién |
|---|---|---|
| Económico | el más barato que todavía es defendible (retención ≥ 25/100) | subir el número gastando poco |
| Estándar | el que más calidad da por dólar entre los dos extremos | la compra normal |
| Premium | el de mejor retención y velocidad | cuentas que no pueden retroceder |

Cada ficha explica **en qué se diferencia de las otras dos** con los datos del
servicio que hay detrás —retención, tiempo de entrega, días de reposición y
cuántas veces más o menos cuesta—, y lleva un comparador con los tres precios
calculados a la misma cantidad: la primera en la que los precios se separan, así
el ticket mínimo de la tienda no los hace parecer idénticos.

Detalles que importan:

- **Es idempotente.** Se puede correr las veces que quieras: lo que ya existe se
  actualiza en vez de duplicarse.
- **Se mantiene solo.** Con «Mantener el catálogo por niveles al día» activo
  (Ajustes → Precios), cada sincronización con el proveedor —y cada pasada del
  cron— vuelve a elegir los tres servicios. Si el proveedor da de baja el que
  estaba detrás del premium, entra el mejor que quede.
- **No pisa tu trabajo.** Solo toca los productos marcados como automáticos.
  Desmarca «Mantenerlo al día automáticamente» en el editor y ese producto queda
  congelado.
- **Reemplaza, no borra.** El producto suelto que vendía lo mismo sin niveles se
  despublica para no mostrar cuatro fichas del mismo servicio; vuelve a
  publicarse desde el listado con un clic.
- Si una combinación tiene un solo servicio utilizable, se publica uno solo: tres
  fichas idénticas a distinto precio no son un catálogo.

### Agregar un producto

**Panel → Productos → Agregar producto.** Eliges la red y qué quieres vender:
las opciones que aparecen son las combinaciones que el proveedor realmente
puede atender, no los casi 2.000 servicios sueltos. Cada tarjeta muestra el
mejor servicio que encontró, cuántos hay de repuesto, la calidad y los precios
que va a tener. Un clic en «Crear» deja el producto publicado con nombre,
descripción, preguntas frecuentes y SEO en español, listos para editar.

El catálogo del proveedor sigue disponible para cuando necesites un servicio
concreto (un país específico, un subtipo raro), pero no es la vía normal.

### A dónde va el pedido

Los servicios que se entregan sobre una publicación —me gusta, visualizaciones,
comentarios, guardados, compartidos, votos, vistas de historias— **exigen el
enlace de la publicación**. Si el comprador pega el de su perfil, o escribe su
usuario, el formulario lo rechaza en el momento y le dice qué copiar, con un
ejemplo de esa red. Antes eso se aceptaba, el usuario suelto se convertía en la
URL del perfil y el error aparecía recién en el proveedor, con la plata ya
cobrada. Al revés también se revisa: un enlace de publicación en un servicio de
seguidores no pasa.

**Repartir entre varias publicaciones.** En esos mismos servicios, el comprador
puede pegar varios enlaces (uno por línea) y cada publicación recibe la cantidad
elegida: 500 me gusta en tres publicaciones son 1.500 en total y se cobran tres
veces el pack de 500, que es lo que le cuesta a la tienda.

Por dentro, cada publicación es un pedido del proveedor: es la única forma en
que sabe entregar —un enlace por pedido—. La tabla `order_targets` guarda uno
por destino con su número de pedido del proveedor, su estado y su error, y el
pedido que ve el cliente sigue siendo uno solo: se le suma lo entregado y se le
resume el estado (todas completas = completado; alguna en curso = en proceso).
Si una publicación no entra —el proveedor rechaza ese enlace, o se queda sin
saldo— el resto sale igual, el pedido queda marcado como pendiente de envío por
esa parte y el cron reintenta solo la que falta, sin repetir las que ya
salieron. El destino se puede corregir desde el seguimiento y desde el panel
mientras no haya salido, con las mismas revisiones.

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

### Dos formas de pagar

En la ficha del producto hay dos botones. El de **Webpay** es el camino
automático de siempre: Flow cobra y el pedido sale solo al proveedor.

El de **transferencia** no cobra nada: reserva el pedido, le muestra al cliente
los datos de tu cuenta con su código de pedido como mensaje, y ahí se detiene.
El pedido **no sale al proveedor hasta que tú lo confirmes** en el panel.

1. El cliente elige transferencia y ve tus datos bancarios y el monto exacto.
   Los mismos datos le llegan por correo, que es donde los va a buscar cuando
   abra el banco.
2. Cuando transfiere puede apretar «Ya transferí» y dejar el número de
   comprobante. Eso no confirma nada: solo te avisa, en el panel y por correo.
3. En el resumen aparece una alerta y el pedido queda en el filtro
   **Transferencias por confirmar**.
4. Revisas tu cuenta y aprietas «Confirmar transferencia y enviar». Recién ahí
   se despacha al proveedor y se gasta tu saldo.

El cron nunca despacha una transferencia sin confirmar: solo reintenta pedidos
que ya están pagados.

Se activa en **Ajustes → Transferencia bancaria**, y el botón solo aparece si
están el banco, el número de cuenta y el titular: un botón que lleva a una
pantalla sin datos pierde la venta.

### Correos automáticos (Resend)

La tienda avisa por correo en los cuatro momentos que importan, con
[Resend](https://resend.com). Se configura en **Ajustes → Correos**:

| Cuándo | A quién | Qué dice |
|---|---|---|
| Pedido por transferencia recién creado | Cliente | Los datos de tu cuenta, el monto exacto y el código que tiene que poner como mensaje. |
| Pago confirmado (Flow o transferencia) | Cliente | Que el pedido va en camino, con el enlace de seguimiento. |
| Entrega terminada o parcial | Cliente | Qué se entregó y qué hacer si algo no cuadra. |
| **Entra un pedido**, aunque no esté pagado | Tienda | Qué compraron, por cuánto, con qué forma de pago y quién. |
| **Se confirma el pago** | Tienda | La venta, con el enlace a la ficha del pedido. |
| El cliente avisa que transfirió | Tienda | Que hay una transferencia por revisar, con el comprobante. |
| Un pedido pagado no pudo salir al proveedor | Tienda | El motivo (normalmente falta de saldo) y el enlace a la ficha. |

Los dos avisos internos de arriba tienen su propia casilla: «Recibir los avisos
internos» manda sobre todos, y «Avisarme también de cada pedido nuevo» apaga
solo el primero, que es el único que llega aunque el cliente nunca pague.

Tres cosas que conviene saber:

- **Cada correo sale una sola vez por pedido.** Flow reintenta la confirmación
  y el cron pasa cada diez minutos: el registro de `email_log` es lo que evita
  que el cliente reciba el mismo aviso veinte veces. Un envío que falló sí se
  puede reintentar; uno que salió, no se repite.
- **Un correo caído nunca tumba una venta.** Si Resend responde con un error,
  el pedido sigue su curso y el motivo queda escrito en el historial del pedido
  («no se pudo enviar el correo…»), donde se lee sin entrar al servidor.
- **El dominio del remitente tiene que estar verificado en Resend** (SPF y
  DKIM). Mientras no lo esté, Resend rechaza los envíos con un mensaje claro:
  el botón «Enviar prueba» de Ajustes te lo muestra tal cual.

Para no dejar la clave en la base de datos, `RESEND_API_KEY` como variable de
entorno manda sobre el panel, igual que las de Flow y el proveedor.

### Panel mayorista (reventa con saldo)

Además de la tienda, el sitio tiene un **panel SMM de reventa** en `/panel`.
Es la otra mitad del negocio: quien compra seguido no paga el precio de la
tienda, sino el costo del proveedor más un margen chico, y a cambio carga saldo
por adelantado.

**Cómo funciona para el cliente**

1. Crea su cuenta en `/panel/crear-cuenta` (gratis, sin aprobación).
2. Recarga saldo desde el mínimo configurado, por **Webpay** (se acredita solo)
   o por **transferencia** (la confirmas tú).
3. En **Servicios** entra por red y dentro de cada una encuentra sus categorías
   plegadas, con cuántos servicios tiene y desde qué precio. Al abrir una ve los
   doce mejores —con precio por 1.000, rango, retención, velocidad, reposición y
   plazo— y, si quiere todos, pasa a la página de esa categoría, paginada. El
   buscador se salta los dos pasos y busca en todo el catálogo por nombre o ID.
   Casi dos mil servicios en una sola lista no se recorren: se abandonan.
4. Elige uno, pega el enlace y la cantidad. El precio se calcula mientras
   escribe y el botón queda bloqueado si la cantidad está fuera de rango o el
   saldo no alcanza.
5. Al enviar, **el saldo se descuenta y el pedido sale al proveedor**, con el
   mismo despacho, reintento y seguimiento de estados que los de la tienda.
6. Sigue cada pedido en `/panel/pedidos`, pide la **reposición** cuando el
   servicio la incluye, y abre **tickets** de soporte que se responden desde el
   panel de administración.

**Cómo funciona para ti**

| Dónde | Qué haces |
|---|---|
| **Mayoristas** | Ves cada cuenta, su saldo, su libro de movimientos, sus pedidos; le pones un descuento propio, le ajustas el saldo a mano (con motivo) o la suspendes. |
| **Recargas** | Confirmas o rechazas las transferencias. Las de Webpay ya están acreditadas cuando las ves. |
| **Tickets** | Respondes, cierras y, en las solicitudes de reposición, se la pides al proveedor con un botón. |
| **Pedidos** | Los del panel se ven igual que los de la tienda, con un botón extra para devolver el saldo si no se pudieron entregar. |

Se configura en **Ajustes → Panel mayorista**: margen, recarga mínima, cobro
mínimo por pedido y un interruptor para apagarlo entero.

#### El saldo no se puede descuadrar

Es lo más delicado del panel, así que está construido para que no dependa de
que el código se porte bien:

- **Un solo módulo toca el saldo** (`wallet.ts`). Nadie más escribe
  `balance_clp`.
- **Cada peso deja una línea en el libro** (`wallet_entries`) con el saldo que
  quedó, y la línea y el saldo se escriben en la misma transacción de SQLite.
- **El saldo se lee dentro de la transacción**, así que dos pedidos a la vez no
  pueden gastar la misma plata: el segundo ve el saldo ya descontado. Un saldo
  negativo es imposible.
- **Un pedido cobra una vez y se reembolsa una vez**, y **una recarga acredita
  una vez**, lo garantiza un índice único de la base —no el código—, así que ni
  un doble clic, ni dos pestañas, ni un reintento de Flow pueden duplicar nada.
- La ficha del cliente en el panel compara el libro con el saldo y avisa en
  rojo si alguna vez no cuadran.

Si un pedido del panel no se puede entregar, el dinero no se pierde: queda
pagado y sin despachar (el cron lo reintenta solo) y, si no hay forma, el botón
de **devolver el saldo** lo acredita de vuelta con su línea en el libro.

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
6. Sale el correo de «pago confirmado» y el cron consulta el avance, que el
   cliente también sigue en `/pedido/<código>`. Al terminar la entrega se manda
   el último correo.

Si Flow todavía no está configurado, el pedido queda **pendiente de pago manual**
y se aprueba desde el panel: la tienda nunca deja al cliente en una pantalla rota.

### En el teléfono

La mayoría de las visitas llegan desde el celular, así que la tienda está
pensada primero para esa pantalla:

- **En la ficha de producto el formulario de compra va arriba**, justo después
  del título. La descripción larga, la tabla de precios y las preguntas van
  debajo. Antes había que bajar casi cuatro pantallas para encontrar el botón
  de pagar; ahora está a menos de media.
- **Las tarjetas del catálogo son filas compactas** bajo los 640px: foto chica
  a la izquierda, precio a la derecha. La misma tarjeta vertical de siempre
  desde ahí para arriba.
- **Los bloques largos se recortan con un «leer más» de puro CSS.** El texto no
  sale del HTML, así que Google lo sigue leyendo completo.
- La portada y el catálogo muestran menos productos por sección en el teléfono,
  con un enlace para ver el resto.
- Los datos de la transferencia y el código de pedido traen botón de copiar.

Ninguna página se desliza hacia el lado en 375, 390 ni 412 px de ancho, ni la
tienda ni el panel.

### SEO

**El texto largo se escribe solo.** La portada y cada página de red social
llevan un cuerpo de 250 a 320 palabras armado con los datos reales de la
tienda: los precios de partida de cada servicio, los plazos de entrega que
promete el servicio que se va a usar, los días de reposición y cuántos
servicios hay. Como los números son distintos en cada red, las páginas son
distintas de verdad —no plantillas con sinónimos cambiados— y se actualizan
solas cuando cambias precios o publicas productos.

Con los niveles publicados, cada página de red agrega además un bloque
«Económico, estándar o premium» con los precios reales de los tres a la misma
cantidad, y cada ficha explica cuál conviene. Es contenido que no existe en
ninguna otra página del sitio y se actualiza solo al cambiar el margen o el
dólar.

Cada red además trae sus propias preguntas frecuentes, que es donde vive la
búsqueda de cola larga: monetización en YouTube, el Para Ti en TikTok, cuentas
privadas en Instagram. Van marcadas como `FAQPage` para Google.

En **Panel → SEO** ves cuántas palabras tiene cada página, si usa el texto
generado o uno tuyo, y puedes reemplazar cualquiera por el que quieras (el
generado te queda a mano para copiarlo y editarlo). Se apaga entero desde
Ajustes → SEO.

**Una página por búsqueda.** Además de la página de cada red, hay una por
combinación red + servicio: `/instagram/seguidores`, `/tiktok/likes`,
`/youtube/suscriptores`. Es la que responde a lo que la gente escribe de
verdad —«seguidores instagram»—, con el término en la URL, en el título, en el
`<h1>` y en un texto armado solo con los productos de esa categoría. Antes ese
término competía contra la página de Instagram entera, que habla de seguidores,
likes, vistas y guardados a la vez.

Estas páginas se enlazan entre ellas y desde la portada («Lo más buscado») y
desde el título de cada categoría en la página de la red, entran al
`sitemap.xml` con prioridad más alta que la red completa, y llevan `Product`
con `AggregateOffer` y `ItemList` en sus datos estructurados. Su texto también
se edita desde **Panel → SEO**, debajo de la red a la que pertenecen.

**Calificación con estrellas.** En **Ajustes → Calificación del servicio**
pones la nota (1 a 5) y el número de opiniones de tu tienda. Se muestra en la
portada, en las fichas, en las tarjetas del catálogo y en las páginas de
categoría, y se publica como `aggregateRating`, que es lo que hace que el
resultado de Google salga con estrellas debajo del título. Cada producto puede
llevar su propia nota desde su ficha en el panel; con los dos campos en 0 usa
la de la tienda. **Con el número de opiniones en 0 no se muestra nada**: una
nota sin opiniones detrás ni Google la valida ni le sirve a nadie. Pon tus
números reales.

- Metadatos, canonical y Open Graph por página, editables por producto. El
  título va absoluto: antes la plantilla del layout le sumaba la marca a
  títulos que ya la traían y el resultado salía con el nombre dos veces.
- JSON-LD: `Organization`, `WebSite`, `Product` con `AggregateOffer` y
  `AggregateRating`, `ItemList`, `BreadcrumbList` y `FAQPage`.
- `sitemap.xml` y `robots.txt` generados desde la base de datos.
- Buscador en `/buscar`, que es el que los datos estructurados ya prometían
  (`SearchAction`) y hasta ahora devolvía 404. Sus resultados van con `noindex`
  y fuera del rastreo: son la misma información con otra URL.
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
    [platform]/[tipo]/          página por red + servicio (/instagram/seguidores)
    buscar/                     buscador de la tienda
    producto/[slug]/            ficha de producto
    pedido/[code]/              seguimiento
    pago/retorno/               vuelta desde Flow
    admin/(panel)/              panel de administración (protegido)
    panel/                      panel mayorista de reventa (clientes con saldo)
    api/flow/confirmar/         webhook de Flow
    api/cron/sincronizar/       actualización de estados
    api/flow/recarga/           webhook de las recargas de saldo
  lib/
    schema.sql                  esquema de la base de datos
    pricing.ts                  motor de precios
    provider.ts                 cliente de honestsmm
    quality.mjs                 retención, velocidad, región, subtipo y forma de pedido
    routing.ts                  elección del servicio al que se despacha
    offers.ts                   combinaciones vendibles para el creador de productos
    level-defs.ts               definición de los niveles (económico/estándar/premium)
    levels.ts                   elección de los tres servicios y sus diferencias
    autolevels.ts               publicación automática del catálogo por niveles
    copy.mjs                    textos y SEO en español de cada producto
    flow.ts                     cliente de Flow
    email.ts                    cliente de Resend
    email-templates.ts          los correos que ve el cliente
    notify.ts                   qué correo sale en cada momento del pedido
    orders.ts                   ciclo de vida de los pedidos
    wallet.ts                   saldo de los mayoristas (libro + transacciones)
    reseller-auth.ts            sesiones del panel de reventa
    reseller-catalog.ts         catálogo y precios mayoristas
    reseller-orders.ts          pedidos pagados con saldo
    topups.ts                   recargas por Webpay y transferencia
    tickets.ts                  soporte y solicitudes de reposición
    taxonomy.mjs                clasificación de servicios
    targets.ts                  destino del pedido: perfil o publicación
    ratings.ts                  calificación de la tienda y de cada producto
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
- Las variables de entorno `PROVIDER_API_KEY`, `FLOW_API_KEY`, `FLOW_SECRET_KEY`,
  `RESEND_API_KEY` y `CRON_SECRET` tienen prioridad sobre lo guardado en el
  panel: úsalas si prefieres no dejar las claves en la base de datos.
