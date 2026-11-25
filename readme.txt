LOKEBU V21 — TIENDA CON MERCADO PAGO, CORREO ARGENTINO Y SEGURIDAD

QUÉ CAMBIÓ
- Pagos: Mercado Pago Checkout Pro (crédito, débito, cuotas, dinero en cuenta, Rapipago / Pago Fácil),
  transferencia y efectivo (solo con retiro en persona).
- El pago con Mercado Pago se confirma solo: Mercado Pago avisa a /api/mp-webhook, la función consulta
  el pago a la API, verifica el monto y pasa el pedido a "Pago confirmado".
- Envíos: Correo Argentino Clásico con precio por zona. tienda-config.js es la ÚNICA fuente de precios
  y tarifas: la usan la landing, el checkout y el servidor (antes había dos tablas distintas).
- Landing: sección "Comprá tranquilo" con medios de pago, calculadora de envío y garantías; FAQ de pagos.
- Seguimiento: el cliente vuelve de Mercado Pago a su pedido sin tener que escribir el teléfono.
- Seguridad: encabezados (CSP, HSTS, anti-iframe), admin sin XSS, IDs aleatorios seguros, comparación
  segura de la clave, límite de pedidos por IP, campo trampa anti-bots y se bloquea el acceso público a
  netlify/, package.json y este readme.
- Las funciones pasaron al formato moderno de Netlify (/api/pedidos, /api/mp-webhook): Netlify Blobs
  funciona sin configuración extra.

VARIABLES DE ENTORNO EN NETLIFY (Site configuration > Environment variables)
- ADMIN_TOKEN          clave larga para admin.html (obligatoria)
- MP_ACCESS_TOKEN      Access Token de PRODUCCIÓN de Mercado Pago (APP_USR-...)
- MP_WEBHOOK_SECRET    "Clave secreta" de Webhooks de tu aplicación de Mercado Pago
- RESEND_API_KEY       clave de Resend para los avisos por mail (ver abajo)
- NOTIFY_EMAIL         mail donde recibís los avisos de pedidos y ventas
Sin MP_ACCESS_TOKEN la tienda funciona igual, pero la opción Mercado Pago responde "no disponible".
Sin RESEND_API_KEY / NOTIFY_EMAIL la tienda funciona igual, solo que no llegan los mails.

AVISOS POR MAIL (con el logo de LOKEBU)
- "Venta confirmada": cuando Mercado Pago acredita un pago.
- "Nuevo pedido": cuando alguien elige transferencia o efectivo (queda pendiente de pago).
Configuración:
1. Crear una cuenta gratis en https://resend.com con el MISMO mail donde querés recibir los avisos.
2. En Resend > API Keys > Create API Key (permiso "Sending access"). Copiarla.
3. En Netlify cargar RESEND_API_KEY (la clave) y NOTIFY_EMAIL (ese mismo mail) y volver a desplegar.
El remitente por defecto (onboarding@resend.dev) solo puede enviar al mail de tu cuenta de Resend.
Para enviar a otros mails o usar un remitente propio (ej. ventas@tudominio.com.ar), verificá tu
dominio en Resend y cargá MAIL_FROM, por ejemplo: LOKEBU <ventas@tudominio.com.ar>

CONFIGURAR MERCADO PAGO
1. https://www.mercadopago.com.ar/developers/panel > Crear aplicación (Checkout Pro).
2. Copiar el Access Token de producción a MP_ACCESS_TOKEN.
3. En la aplicación > Webhooks: URL https://TU-DOMINIO/api/mp-webhook, evento "Pagos".
   Copiar la clave secreta a MP_WEBHOOK_SECRET.
4. Volver a desplegar y hacer una compra de prueba (se puede reembolsar desde Mercado Pago).

CAMBIAR PRECIOS O TARIFAS DE ENVÍO
Editar tienda-config.js. Los textos fijos "desde $29.990" de index.html y de checkout.html hay que
actualizarlos a mano.
