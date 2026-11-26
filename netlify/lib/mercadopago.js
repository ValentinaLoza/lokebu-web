/*
  Cliente mínimo de la API de Mercado Pago (Checkout Pro).
  El Access Token NUNCA va al navegador: se lee de MP_ACCESS_TOKEN en Netlify.
*/
const crypto = require("node:crypto");

const API = process.env.MP_API_URL || "https://api.mercadopago.com"; // MP_API_URL solo para pruebas locales

function token() {
  const t = process.env.MP_ACCESS_TOKEN;
  if (!t) throw new Error("Falta MP_ACCESS_TOKEN");
  return t;
}

const habilitado = () => !!process.env.MP_ACCESS_TOKEN;

async function mp(path, { method = "GET", body, idempotencyKey } = {}) {
  const headers = { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" };
  if (idempotencyKey) headers["X-Idempotency-Key"] = idempotencyKey;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    const err = new Error(json.message || `Mercado Pago HTTP ${res.status}`);
    err.status = res.status;
    err.detail = json;
    throw err;
  }
  return json;
}

/*
  Crea la preferencia de pago para un pedido ya guardado.
  Los montos salen del pedido (calculados en el servidor), nunca del navegador.
*/
async function crearPreferencia(pedido, siteUrl) {
  const items = [
    {
      id: pedido.productoId,
      title: `${pedido.producto} (${pedido.variante})${pedido.cupon ? ` · ${pedido.cupon} -${pedido.descuento}` : ""}`,
      quantity: 1,
      unit_price: pedido.precioProducto - (pedido.descuento || 0),
      currency_id: "ARS",
    },
  ];
  if (pedido.envio > 0) {
    items.push({
      id: "envio",
      title: "Envío Correo Argentino",
      quantity: 1,
      unit_price: pedido.envio,
      currency_id: "ARS",
    });
  }

  const volver = (estado) =>
    `${siteUrl}/seguimiento.html?id=${encodeURIComponent(pedido.id)}&t=${encodeURIComponent(pedido.acceso)}&pago=${estado}`;

  const expira = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

  return mp("/checkout/preferences", {
    method: "POST",
    idempotencyKey: `pref-${pedido.id}`,
    body: {
      items,
      payer: {
        name: pedido.nombre,
        email: pedido.email || undefined,
      },
      external_reference: pedido.id,
      statement_descriptor: "LOKEBU",
      back_urls: { success: volver("ok"), pending: volver("pendiente"), failure: volver("error") },
      auto_return: "approved",
      notification_url: `${siteUrl}/api/mp-webhook`,
      expires: true,
      expiration_date_to: expira,
      metadata: { pedido: pedido.id },
    },
  });
}

const obtenerPago = (id) => mp(`/v1/payments/${encodeURIComponent(id)}`);

/*
  Valida la firma x-signature de las notificaciones (si MP_WEBHOOK_SECRET está configurado).
  Manifiesto según la documentación de Mercado Pago: id:<data.id>;request-id:<x-request-id>;ts:<ts>;
*/
function firmaValida({ signature, requestId, dataId }) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true; // sin secreto configurado se confía en la verificación vía API
  if (!signature) return false;

  const partes = Object.fromEntries(
    String(signature).split(",").map((p) => p.split("=").map((s) => s.trim()))
  );
  const ts = partes.ts;
  const v1 = partes.v1;
  if (!ts || !v1) return false;

  let manifest = "";
  if (dataId) manifest += `id:${String(dataId).toLowerCase()};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;

  const esperado = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(esperado);
  const b = Buffer.from(v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { habilitado, crearPreferencia, obtenerPago, firmaValida };
