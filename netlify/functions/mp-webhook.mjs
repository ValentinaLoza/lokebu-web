import { getStore } from "@netlify/blobs";
import MP from "../lib/mercadopago.js";
import AVISO from "../lib/notificar.js";

/*
  Notificaciones de Mercado Pago (Webhooks).
  Nunca se confía en el contenido de la notificación: se consulta el pago a la API
  de Mercado Pago y recién ahí se actualiza el pedido.
*/

export const config = { path: "/api/mp-webhook" };

const ok = () => new Response("ok", { status: 200 });

const ESTADO_MP = {
  approved: "aprobado",
  authorized: "autorizado",
  in_process: "en revisión",
  pending: "pendiente",
  rejected: "rechazado",
  cancelled: "cancelado",
  refunded: "devuelto",
  charged_back: "contracargo",
};

export default async (req) => {
  if (req.method !== "POST") return new Response("Método no permitido", { status: 405 });

  const url = new URL(req.url);
  let body = {};
  try { body = await req.json(); } catch {}

  const tipo = body.type || url.searchParams.get("type") || url.searchParams.get("topic");
  const dataId = (body.data && body.data.id) || url.searchParams.get("data.id") || url.searchParams.get("id");
  if (tipo !== "payment" || !dataId) return ok(); // otros avisos no nos interesan

  if (!MP.firmaValida({
    signature: req.headers.get("x-signature"),
    requestId: req.headers.get("x-request-id"),
    dataId: url.searchParams.get("data.id") || dataId,
  })) {
    console.warn("Webhook MP con firma inválida", dataId);
    return new Response("Firma inválida", { status: 401 });
  }

  try {
    const pago = await MP.obtenerPago(dataId);
    const id = String(pago.external_reference || "");
    if (!id) return ok();

    const s = getStore({ name: "pedidos" });
    const pedido = await s.get(`orders/${id}`, { type: "json" });
    if (!pedido) {
      console.warn("Pago MP para pedido inexistente", id, dataId);
      return ok();
    }

    const ahora = new Date().toISOString();
    const { alerta: _alertaAnterior, ...pagoAnterior } = pedido.pagoMP || {};
    pedido.pagoMP = {
      ...pagoAnterior,
      id: pago.id,
      estado: ESTADO_MP[pago.status] || pago.status,
      detalle: pago.status_detail,
      medio: pago.payment_method_id,
      cuotas: pago.installments,
      monto: pago.transaction_amount,
      actualizado: ahora,
    };

    const montoOk = pago.currency_id === "ARS" && Number(pago.transaction_amount) >= Number(pedido.total);
    let ventaNueva = false;
    if (pago.status === "approved" && pedido.estado === "Pendiente de pago") {
      if (montoOk) {
        pedido.estado = "Pago confirmado";
        pedido.historial.push({ estado: "Pago confirmado", fecha: ahora });
        ventaNueva = true;
      } else {
        console.error("Monto MP no coincide", id, pago.transaction_amount, pedido.total);
        pedido.pagoMP.alerta = "El monto pagado no coincide con el total del pedido";
      }
    }

    await s.setJSON(`orders/${id}`, pedido);
    if (ventaNueva) await AVISO.notificarVenta(pedido, "venta");
    return ok();
  } catch (err) {
    console.error("Error procesando webhook MP:", err.status, JSON.stringify(err.detail || err.message));
    // 500 hace que Mercado Pago reintente más tarde.
    return new Response("Error", { status: 500 });
  }
};
