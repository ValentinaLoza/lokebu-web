const { api } = require("../lib/micorreo");

/*
  POST /.netlify/functions/cotizar
  body: { cp: "1755", producto: "1" | "2" }
  Devuelve el precio de envío a domicilio (Correo Argentino Clásico).
*/

// Medidas del paquete ya armado (sobre o caja chica). Configurables desde Netlify.
// Confirmar con el paquete real antes de publicar.
const PAQUETE = {
  weight: Number(process.env.PAQUETE_PESO_G) || 30,   // gramos por unidad
  height: Number(process.env.PAQUETE_ALTO_CM) || 2,
  width: Number(process.env.PAQUETE_ANCHO_CM) || 12,
  length: Number(process.env.PAQUETE_LARGO_CM) || 8,
};

const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

const reply = (statusCode, obj) => ({ statusCode, headers: HEADERS, body: JSON.stringify(obj) });

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return reply(204, {});
  if (event.httpMethod !== "POST") return reply(405, { error: "Método no permitido" });

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { return reply(400, { error: "JSON inválido" }); }

  const cp = String(body.cp || "").trim();
  if (!/^\d{4}$/.test(cp)) return reply(400, { error: "Código postal inválido" });

  const origen = process.env.MICORREO_CP_ORIGEN;
  const customerId = process.env.MICORREO_CUSTOMER_ID;
  if (!origen || !customerId) {
    console.error("Faltan MICORREO_CP_ORIGEN o MICORREO_CUSTOMER_ID");
    return reply(500, { error: "Envío no disponible" });
  }

  // Pack x2: se duplica el peso y se apilan las unidades en alto.
  const cantidad = String(body.producto) === "2" ? 2 : 1;
  const dimensions = {
    weight: PAQUETE.weight * cantidad,
    height: PAQUETE.height * cantidad,
    width: PAQUETE.width,
    length: PAQUETE.length,
  };

  try {
    const r = await api("/rates", {
      body: {
        customerId,
        postalCodeOrigin: origen,
        postalCodeDestination: cp,
        deliveredType: "D",
        dimensions,
      },
    });

    const rate =
      (r.rates || []).find((x) => x.deliveredType === "D" && x.productType === "CP") || (r.rates || [])[0];
    if (!rate) return reply(422, { error: "Sin cotización para ese código postal" });

    return reply(200, {
      precio: rate.price,
      producto: rate.productName,
      plazoMin: rate.deliveryTimeMin,
      plazoMax: rate.deliveryTimeMax,
    });
  } catch (err) {
    console.error("Error cotizando MiCorreo:", err.status, err.detail || err.message);
    return reply(502, { error: "No pudimos calcular el envío" });
  }
};
