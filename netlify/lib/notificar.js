/*
  Aviso por mail a la tienda cuando entra un pedido o se confirma una venta.
  Se envía con Resend (resend.com). Variables en Netlify:
    RESEND_API_KEY   clave de la API de Resend (obligatoria para enviar)
    NOTIFY_EMAIL     mail donde querés recibir los avisos
    MAIL_FROM        opcional. Por defecto "LOKEBU <onboarding@resend.dev>", que solo puede
                     enviar al mail con el que creaste la cuenta de Resend (alcanza para avisos propios).
  Si falta alguna variable, no se envía nada y la venta sigue normalmente.
*/
const API = process.env.RESEND_API_URL || "https://api.resend.com"; // RESEND_API_URL solo para pruebas locales

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => "$" + Number(n || 0).toLocaleString("es-AR");
const siteUrl = () => (process.env.URL || "").replace(/\/$/, "");

const NOMBRE_PAGO = { mercadopago: "Mercado Pago", transferencia: "Transferencia", efectivo: "Efectivo al retirar" };

function fila(etiqueta, valor) {
  if (!valor) return "";
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #ece8dd;color:#66645f;font-size:13px;width:120px;vertical-align:top">${esc(etiqueta)}</td>
    <td style="padding:10px 0;border-bottom:1px solid #ece8dd;color:#151515;font-size:14px;font-weight:600">${valor}</td>
  </tr>`;
}

function armarMail(pedido, tipo) {
  const venta = tipo === "venta";
  const url = siteUrl();
  const titulo = venta ? "¡Tuviste una venta!" : "Nuevo pedido";
  const bajada = venta
    ? "Mercado Pago confirmó el pago. Ya podés preparar el envío."
    : `Quedó pendiente de pago (${NOMBRE_PAGO[pedido.pago] || pedido.pago}). Confirmalo en el panel cuando recibas el comprobante.`;

  const mp = pedido.pagoMP || {};
  let pago = esc(NOMBRE_PAGO[pedido.pago] || pedido.pago);
  if (venta && mp.medio) pago += ` · ${esc(mp.medio)}${mp.cuotas > 1 ? ` en ${esc(mp.cuotas)} cuotas` : ""}`;
  if (mp.id) pago += `<br><span style="color:#66645f;font-weight:400;font-size:12px">Operación Mercado Pago #${esc(mp.id)}</span>`;

  const tel = String(pedido.telefono || "").replace(/\D/g, "");
  const waCliente = tel ? `https://wa.me/${tel.startsWith("54") ? tel : "549" + tel}` : null;

  const logo = url
    ? `<img src="${esc(url)}/assets/email-logo.png" width="120" height="36" alt="lokebu" style="display:block;border:0;height:36px;width:120px">`
    : `<span style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-1px">lokebu</span>`;

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(titulo)}</title></head>
<body style="margin:0;padding:0;background:#f5f2ea;font-family:Manrope,'Segoe UI',Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f2ea;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e6e1d4">
        <tr><td style="background:#151515;padding:26px 28px">${logo}</td></tr>
        <tr><td style="padding:30px 28px 8px">
          <div style="display:inline-block;background:${venta ? "#d8ff3f" : "#fff4cc"};color:#151515;border-radius:999px;padding:6px 12px;font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase">${venta ? "Pago confirmado" : "Pendiente de pago"}</div>
          <h1 style="margin:16px 0 8px;font-size:30px;line-height:1.1;color:#151515;letter-spacing:-1px">${esc(titulo)}</h1>
          <p style="margin:0 0 20px;color:#66645f;font-size:15px;line-height:1.5">${esc(bajada)}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#151515;border-radius:14px">
            <tr>
              <td style="padding:18px 20px;color:#bdbdb8;font-size:13px">Pedido <b style="color:#ffffff;letter-spacing:.5px;white-space:nowrap">${esc(pedido.id)}</b></td>
              <td align="right" style="padding:18px 20px;color:#d8ff3f;font-size:24px;font-weight:800">${fmt(pedido.total)}</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:8px 28px 4px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${fila("Producto", `${esc(pedido.producto)} · ${esc(pedido.variante)}`)}
            ${fila("Cliente", esc(pedido.nombre))}
            ${fila("WhatsApp", esc(pedido.telefono))}
            ${fila("Email", esc(pedido.email))}
            ${fila("Entrega", esc(pedido.entrega))}
            ${fila("Envío", pedido.envio ? fmt(pedido.envio) : "Sin costo")}
            ${fila("Pago", pago)}
            ${fila("Comentarios", esc(pedido.comentarios))}
          </table>
        </td></tr>
        <tr><td style="padding:22px 28px 30px">
          ${url ? `<a href="${esc(url)}/admin.html" style="display:inline-block;background:#151515;color:#ffffff;text-decoration:none;font-weight:800;font-size:14px;padding:14px 22px;border-radius:999px;margin:0 8px 8px 0">Abrir el panel</a>` : ""}
          ${waCliente ? `<a href="${esc(waCliente)}" style="display:inline-block;background:#d8ff3f;color:#151515;text-decoration:none;font-weight:800;font-size:14px;padding:14px 22px;border-radius:999px;margin:0 0 8px">Escribirle al cliente</a>` : ""}
        </td></tr>
      </table>
      <p style="color:#8b887f;font-size:12px;margin:16px 0 0">Aviso automático de tu tienda LOKEBU.</p>
    </td></tr>
  </table>
</body></html>`;

  const asunto = venta
    ? `💸 Venta confirmada ${pedido.id} · ${fmt(pedido.total)}`
    : `🛒 Nuevo pedido ${pedido.id} · ${fmt(pedido.total)} (pendiente de pago)`;

  const texto = [
    titulo,
    bajada,
    "",
    `Pedido: ${pedido.id}`,
    `Total: ${fmt(pedido.total)}`,
    `Producto: ${pedido.producto} · ${pedido.variante}`,
    `Cliente: ${pedido.nombre} · ${pedido.telefono}${pedido.email ? " · " + pedido.email : ""}`,
    `Entrega: ${pedido.entrega}`,
    `Pago: ${NOMBRE_PAGO[pedido.pago] || pedido.pago}`,
    url ? `Panel: ${url}/admin.html` : "",
  ].join("\n");

  return { asunto, html, texto };
}

/*
  tipo: "venta" (pago confirmado) | "pedido" (nuevo pedido pendiente de pago).
  Nunca lanza error: un mail que falla no puede romper una venta.
*/
async function notificarVenta(pedido, tipo) {
  const key = process.env.RESEND_API_KEY;
  const para = process.env.NOTIFY_EMAIL;
  if (!key || !para) return false;

  const { asunto, html, texto } = armarMail(pedido, tipo);
  try {
    const res = await fetch(`${API}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `${tipo}-${pedido.id}`, // evita mails duplicados si se reintenta
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || "LOKEBU <onboarding@resend.dev>",
        to: para.split(",").map((s) => s.trim()).filter(Boolean),
        reply_to: pedido.email || undefined,
        subject: asunto,
        html,
        text: texto,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("Resend respondió", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("No se pudo enviar el aviso por mail:", err.message);
    return false;
  }
}

module.exports = { notificarVenta, armarMail };
