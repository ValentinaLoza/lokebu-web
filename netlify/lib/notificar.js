/*
  Mails de la tienda, enviados con Resend (resend.com).

  A la tienda (vos):     "Nuevo pedido" y "¡Tuviste una venta!"
  Al cliente:            "Recibimos tu pedido", "Pago confirmado", "En camino", "Listo para retirar"

  Variables en Netlify:
    RESEND_API_KEY   clave de la API de Resend (obligatoria para enviar)
    NOTIFY_EMAIL     mail donde recibís los avisos (y adonde llegan las respuestas de los clientes)
    MAIL_FROM        remitente con tu dominio verificado en Resend, ej: LOKEBU <ventas@lokebu.com.ar>
                     Sin MAIL_FROM se usa onboarding@resend.dev, que solo puede escribirte a vos:
                     en ese caso los mails al cliente NO se envían.
  Si falta algo o Resend falla, la venta sigue normalmente: un mail nunca rompe un pedido.
*/
const CONFIG = require("../../tienda-config.js");

const API = process.env.RESEND_API_URL || "https://api.resend.com"; // RESEND_API_URL solo para pruebas locales
const SEGUIMIENTO_CORREO = "https://www.correoargentino.com.ar/formularios/e-commerce";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => "$" + Number(n || 0).toLocaleString("es-AR");
const siteUrl = () => (process.env.URL || "").replace(/\/$/, "");
const remitente = () => process.env.MAIL_FROM || "LOKEBU <onboarding@resend.dev>";
const clienteHabilitado = () => !!process.env.MAIL_FROM && !/resend\.dev/i.test(process.env.MAIL_FROM);
const primerNombre = (n) => String(n || "").trim().split(/\s+/)[0] || "";
const linkPedido = (p) =>
  `${siteUrl()}/seguimiento.html?id=${encodeURIComponent(p.id)}&t=${encodeURIComponent(p.acceso || "")}`;
const waTienda = (texto) => `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(texto)}`;

const NOMBRE_PAGO = { mercadopago: "Mercado Pago", transferencia: "Transferencia", efectivo: "Efectivo al retirar" };

/* ---------- Bloques de la plantilla (tablas y estilos en línea: lo que entienden los clientes de mail) ---------- */

function fila(etiqueta, valorHtml) {
  if (!valorHtml) return "";
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #ece8dd;color:#66645f;font-size:13px;width:120px;vertical-align:top">${esc(etiqueta)}</td>
    <td style="padding:10px 0;border-bottom:1px solid #ece8dd;color:#151515;font-size:14px;font-weight:600">${valorHtml}</td>
  </tr>`;
}

function boton(texto, href, claro) {
  if (!href) return "";
  const estilo = claro ? "background:#d8ff3f;color:#151515" : "background:#151515;color:#ffffff";
  return `<a href="${esc(href)}" style="display:inline-block;${estilo};text-decoration:none;font-weight:800;font-size:14px;padding:14px 22px;border-radius:999px;margin:0 8px 8px 0">${esc(texto)}</a>`;
}

function recuadro(htmlInterno) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f2ea;border-radius:14px;margin:0 0 8px">
    <tr><td style="padding:18px 20px;font-size:14px;color:#151515;line-height:1.6">${htmlInterno}</td></tr>
  </table>`;
}

function plantilla({ etiqueta, etiquetaColor, titulo, bajada, pedido, extra = "", filas = "", botones = "", pie }) {
  const url = siteUrl();
  const logo = url
    ? `<img src="${esc(url)}/assets/email-logo.png" width="120" height="36" alt="lokebu" style="display:block;border:0;height:36px;width:120px">`
    : `<span style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-1px">lokebu</span>`;

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(titulo)}</title></head>
<body style="margin:0;padding:0;background:#f5f2ea;font-family:Manrope,'Segoe UI',Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f2ea;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e6e1d4">
        <tr><td style="background:#151515;padding:26px 28px">${logo}</td></tr>
        <tr><td style="padding:30px 28px 8px">
          <div style="display:inline-block;background:${etiquetaColor};color:#151515;border-radius:999px;padding:6px 12px;font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase">${esc(etiqueta)}</div>
          <h1 style="margin:16px 0 8px;font-size:30px;line-height:1.1;color:#151515;letter-spacing:-1px">${esc(titulo)}</h1>
          <p style="margin:0 0 20px;color:#66645f;font-size:15px;line-height:1.5">${esc(bajada)}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#151515;border-radius:14px;margin:0 0 16px">
            <tr>
              <td style="padding:18px 20px;color:#bdbdb8;font-size:13px">Pedido <b style="color:#ffffff;letter-spacing:.5px;white-space:nowrap">${esc(pedido.id)}</b></td>
              <td align="right" style="padding:18px 20px;color:#d8ff3f;font-size:24px;font-weight:800">${fmt(pedido.total)}</td>
            </tr>
          </table>
          ${extra}
        </td></tr>
        <tr><td style="padding:0 28px 4px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filas}</table>
        </td></tr>
        <tr><td style="padding:22px 28px 30px">${botones}</td></tr>
      </table>
      <p style="color:#8b887f;font-size:12px;line-height:1.5;margin:16px 0 0;max-width:520px">${pie}</p>
    </td></tr>
  </table>
</body></html>`;
}

/* ---------- Mails a la tienda ---------- */

function armarMail(pedido, tipo) {
  const venta = tipo === "venta";
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
  const url = siteUrl();

  const html = plantilla({
    etiqueta: venta ? "Pago confirmado" : "Pendiente de pago",
    etiquetaColor: venta ? "#d8ff3f" : "#fff4cc",
    titulo,
    bajada,
    pedido,
    filas: [
      fila("Producto", `${esc(pedido.producto)} · ${esc(pedido.variante)}`),
      fila("Cliente", esc(pedido.nombre)),
      fila("WhatsApp", esc(pedido.telefono)),
      fila("Email", esc(pedido.email)),
      fila("Entrega", esc(pedido.entrega)),
      fila("Envío", pedido.envio ? fmt(pedido.envio) : "Sin costo"),
      fila("Pago", pago),
      fila("Comentarios", esc(pedido.comentarios)),
    ].join(""),
    botones: boton("Abrir el panel", url && `${url}/admin.html`) + boton("Escribirle al cliente", waCliente, true),
    pie: "Aviso automático de tu tienda LOKEBU.",
  });

  const asunto = venta
    ? `💸 Venta confirmada ${pedido.id} · ${fmt(pedido.total)}`
    : `🛒 Nuevo pedido ${pedido.id} · ${fmt(pedido.total)} (pendiente de pago)`;

  const texto = [
    titulo, bajada, "",
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

/* ---------- Mails al cliente ---------- */

const TIPOS_CLIENTE = ["recibido", "pagado", "despachado", "retirar"];

function armarMailCliente(pedido, tipo) {
  const nombre = primerNombre(pedido.nombre);
  const hola = nombre ? `¡Hola, ${nombre}! ` : "¡Hola! ";
  const filasBase = [
    fila("Producto", `${esc(pedido.producto)} · ${esc(pedido.variante === "iOS" ? "iPhone (iOS)" : pedido.variante)}`),
    fila("Entrega", esc(pedido.entrega)),
    fila("Envío", pedido.envio ? fmt(pedido.envio) : "Sin costo"),
    fila("Pago", esc(NOMBRE_PAGO[pedido.pago] || pedido.pago)),
  ].join("");
  const verPedido = boton("Ver mi pedido", linkPedido(pedido));
  const dudas = boton("Escribinos por WhatsApp", waTienda(`Hola! Tengo una consulta sobre mi pedido ${pedido.id}.`), true);
  const pie =
    "Recibiste este mail porque hiciste una compra en lokebu.com.ar. Si tenés dudas, respondé este mail o escribinos por WhatsApp.";

  let etiqueta, color, titulo, bajada, extra = "", botones = verPedido + dudas, asunto, textoExtra = [];

  if (tipo === "recibido") {
    etiqueta = "Pedido recibido";
    color = "#fff4cc";
    titulo = "Recibimos tu pedido";
    asunto = `Recibimos tu pedido ${pedido.id} 🙌`;
    if (pedido.pago === "transferencia") {
      const t = CONFIG.transferencia;
      bajada = `${hola}Tu pedido quedó reservado. Para confirmarlo, transferí el total y mandanos el comprobante por WhatsApp.`;
      extra = recuadro(
        `<b>Datos para transferir</b><br>Alias: <b>${esc(t.alias)}</b><br>Titular: ${esc(t.titular)}<br>Banco: ${esc(t.banco)}<br>Monto: <b>${fmt(pedido.total)}</b>`
      );
      botones =
        boton("Enviar comprobante por WhatsApp", waTienda(`Hola! Te envío el comprobante de la transferencia del pedido ${pedido.id} por ${fmt(pedido.total)}.`), true) +
        verPedido;
      textoExtra = [`Alias: ${t.alias} · Titular: ${t.titular} · Banco: ${t.banco}`, `Monto: ${fmt(pedido.total)}`, `Enviá el comprobante por WhatsApp: https://wa.me/${CONFIG.whatsapp}`];
    } else {
      bajada = `${hola}Tu pedido quedó reservado. Escribinos por WhatsApp para coordinar el día y horario de retiro. Pagás en efectivo al retirarlo.`;
      botones =
        boton("Coordinar el retiro", waTienda(`Hola! Hice el pedido ${pedido.id} para retirar y pagar en efectivo. ¿Coordinamos día y horario?`), true) +
        verPedido;
      textoExtra = [`Coordiná el retiro por WhatsApp: https://wa.me/${CONFIG.whatsapp}`];
    }
  } else if (tipo === "pagado") {
    etiqueta = "Pago confirmado";
    color = "#d8ff3f";
    titulo = "¡Tu pago está confirmado!";
    asunto = `¡Pago confirmado! Pedido ${pedido.id} ✅`;
    bajada = pedido.direccion
      ? `${hola}Ya estamos preparando tu LOKEBU. Te avisamos por mail cuando lo despachemos, con el número de seguimiento.`
      : `${hola}Ya estamos preparando tu LOKEBU. Te avisamos cuando esté listo para retirar.`;
  } else if (tipo === "despachado") {
    etiqueta = "En camino";
    color = "#d8ff3f";
    titulo = "¡Tu LOKEBU está en camino!";
    asunto = `Tu pedido ${pedido.id} está en camino 📦`;
    bajada = `${hola}Ya lo despachamos por ${CONFIG.envio.nombre}. Llega en ${CONFIG.envio.plazo} aproximadamente.`;
    if (pedido.tracking) {
      extra = recuadro(
        `<b>Número de seguimiento</b><br><span style="font-size:20px;font-weight:800;letter-spacing:1px">${esc(pedido.tracking)}</span><br><span style="color:#66645f;font-size:13px">Copialo y consultalo en la web de Correo Argentino.</span>`
      );
      botones = boton("Seguir en Correo Argentino", SEGUIMIENTO_CORREO, true) + verPedido;
      textoExtra = [`Número de seguimiento: ${pedido.tracking}`, `Seguilo en: ${SEGUIMIENTO_CORREO}`];
    }
  } else if (tipo === "retirar") {
    etiqueta = "Listo para retirar";
    color = "#d8ff3f";
    titulo = "Tu pedido está listo para retirar";
    asunto = `Tu pedido ${pedido.id} está listo para retirar 🎉`;
    bajada = `${hola}Ya podés pasar a buscarlo. Escribinos por WhatsApp para coordinar día y horario.`;
    extra = recuadro(`<b>Dónde retirarlo</b><br>${esc(pedido.entrega)}`);
    botones =
      boton("Coordinar el retiro", waTienda(`Hola! Quiero coordinar el retiro del pedido ${pedido.id}.`), true) + verPedido;
  } else {
    return null;
  }

  const html = plantilla({ etiqueta, etiquetaColor: color, titulo, bajada, pedido, extra, filas: filasBase, botones, pie });
  const texto = [
    titulo, bajada, "", ...textoExtra, textoExtra.length ? "" : null,
    `Pedido: ${pedido.id}`,
    `Total: ${fmt(pedido.total)}`,
    `Producto: ${pedido.producto} · ${pedido.variante}`,
    `Entrega: ${pedido.entrega}`,
    "",
    `Ver tu pedido: ${linkPedido(pedido)}`,
    `WhatsApp: https://wa.me/${CONFIG.whatsapp}`,
  ].filter((l) => l !== null).join("\n");

  return { asunto, html, texto };
}

/* ---------- Envío ---------- */

async function enviar({ to, replyTo, asunto, html, texto, idempotencia }) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to.length) return false;
  try {
    const res = await fetch(`${API}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencia, // evita mails duplicados si se reintenta
      },
      body: JSON.stringify({ from: remitente(), to, reply_to: replyTo || undefined, subject: asunto, html, text: texto }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("Resend respondió", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("No se pudo enviar el mail:", err.message);
    return false;
  }
}

const listaTienda = () => String(process.env.NOTIFY_EMAIL || "").split(",").map((s) => s.trim()).filter(Boolean);

/* Aviso a la tienda. tipo: "venta" | "pedido". Nunca lanza error. */
async function notificarVenta(pedido, tipo) {
  const { asunto, html, texto } = armarMail(pedido, tipo);
  return enviar({ to: listaTienda(), replyTo: pedido.email, asunto, html, texto, idempotencia: `${tipo}-${pedido.id}` });
}

/*
  Mail al cliente. tipo: "recibido" | "pagado" | "despachado" | "retirar".
  Marca pedido.avisos[tipo] si se envió (quien llama guarda el pedido), para no repetirlo nunca.
  Nunca lanza error.
*/
async function notificarCliente(pedido, tipo) {
  if (!TIPOS_CLIENTE.includes(tipo) || !clienteHabilitado() || !pedido.email) return false;
  pedido.avisos = pedido.avisos || {};
  if (pedido.avisos[tipo]) return false;
  const mail = armarMailCliente(pedido, tipo);
  const ok = await enviar({
    to: [pedido.email],
    replyTo: listaTienda()[0],
    ...mail,
    idempotencia: `cliente-${tipo}-${pedido.id}`,
  });
  if (ok) pedido.avisos[tipo] = new Date().toISOString();
  return ok;
}

/* Qué mail le corresponde al cliente cuando el pedido pasa a un estado. */
const AVISO_POR_ESTADO = { "Pago confirmado": "pagado", Despachado: "despachado", "Listo para retirar": "retirar" };

module.exports = { notificarVenta, notificarCliente, armarMail, armarMailCliente, AVISO_POR_ESTADO };
