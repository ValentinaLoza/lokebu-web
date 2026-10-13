LOKEBU LANDING V20 — CORRECCIÓN DEL ERROR AL ENVIAR PEDIDO

Causa: la función de pedidos usaba getStore con consistency "strong". Esa opción exige credenciales manuales (siteID y token) y falla dentro de Netlify, por eso el checkout mostraba "Error interno".

Cambio: se quitó esa opción. El almacenamiento queda con la configuración por defecto, que funciona dentro de Netlify sin variables extra.

Cómo verificar después de desplegar:
1. Hacer un pedido de prueba desde el checkout.
2. Si vuelve a fallar, en Netlify ir a Logs > Functions > pedidos: el error completo aparece ahí.
3. Si el pedido se crea, aparece en admin.html con su estado "Pendiente de pago".

Recordatorio: desplegar con Git o Netlify CLI para que se instale @netlify/blobs (package.json).
