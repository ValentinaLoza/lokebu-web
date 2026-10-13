const { api } = require("../lib/micorreo");

/*
  POST /.netlify/functions/importar-envio
  Header: x-admin-token: <ADMIN_TOKEN>
  Úsala SOLO después de confirmar el pago. Crea el envío en MiCorreo.
  body: {
    extOrderId, orderNumber, nombre, email, telefono,
    calle, altura, piso, depto, localidad, provinciaCode, cp,
    pesoGramos, alto, ancho, largo, valorDeclarado
  }
*/

const HEADERS = { "Content-Type": "application/json" };
const reply = (statusCode, obj) => ({ statusCode, headers: HEADERS, body: JSON.stringify(obj) });

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return reply(405, { error: "Método no permitido" });

  const token = event.headers["x-admin-token"] || event.headers["X-Admin-Token"];
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return reply(401, { error: "No autorizado" });
  }

  let b;
  try { b = JSON.parse(event.body || "{}"); } catch { return reply(400, { error: "JSON inválido" }); }

  const required = ["extOrderId", "nombre", "email", "calle", "altura", "localidad", "provinciaCode", "cp", "pesoGramos", "alto", "ancho", "largo", "valorDeclarado"];
  const faltan = required.filter((k) => b[k] === undefined || b[k] === "");
  if (faltan.length) return reply(400, { error: "Faltan datos", faltan });

  const payload = {
    customerId: process.env.MICORREO_CUSTOMER_ID,
    extOrderId: String(b.extOrderId),
    orderNumber: String(b.orderNumber || b.extOrderId),
    sender: {
      name: process.env.REMITENTE_NOMBRE || null,
      phone: process.env.REMITENTE_TELEFONO || null,
      cellPhone: process.env.REMITENTE_TELEFONO || null,
      email: process.env.REMITENTE_EMAIL || null,
      originAddress: {
        streetName: process.env.REMITENTE_CALLE || null,
        streetNumber: process.env.REMITENTE_ALTURA || null,
        floor: null,
        apartment: null,
        city: process.env.REMITENTE_LOCALIDAD || null,
        provinceCode: process.env.REMITENTE_PROVINCIA || null,
        postalCode: process.env.MICORREO_CP_ORIGEN || null,
      },
    },
    recipient: {
      name: b.nombre,
      phone: b.telefono || "",
      cellPhone: b.telefono || "",
      email: b.email,
    },
    shipping: {
      deliveryType: "D",
      agency: null,
      address: {
        streetName: b.calle,
        streetNumber: String(b.altura),
        floor: (b.piso || "").slice(0, 3),
        apartment: (b.depto || "").slice(0, 3),
        city: b.localidad,
        provinceCode: b.provinciaCode,
        postalCode: String(b.cp),
      },
      productType: "CP",
      weight: Number(b.pesoGramos),
      declaredValue: Number(b.valorDeclarado),
      height: Number(b.alto),
      width: Number(b.ancho),
      length: Number(b.largo),
    },
  };

  try {
    const r = await api("/shipping/import", { body: payload });
    return reply(200, { ok: true, createdAt: r.createdAt });
  } catch (err) {
    console.error("Error importando envío:", err.status, err.detail || err.message);
    return reply(502, { error: "No se pudo importar el envío", detalle: err.detail || null });
  }
};
