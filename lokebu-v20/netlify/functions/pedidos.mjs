import { getStore } from "@netlify/blobs";

/*
  Pedidos LOKEBU.
  POST   ?                 -> crea pedido (público)
  GET    ?id=&tel=         -> seguimiento del pedido (público, valida teléfono)
  GET    ?admin=1          -> lista todos los pedidos (header x-admin-token)
  PATCH  (body con id)     -> cambia estado / tracking (header x-admin-token)
*/

// Tarifas: DEBEN coincidir con checkout.js
const TARIFA_ZONA = { 1: 7755, 2: 8955, 3: 9750, 4: 9808 };
const PROVINCIA_ZONA = {
  C: 1, B: 2, S: 2, X: 2, E: 2, L: 2,
  D: 3, F: 3, G: 3, H: 3, J: 3, K: 3, M: 3, N: 3, P: 3, Q: 3, R: 3, T: 3, W: 3,
  A: 4, Y: 4, U: 4, V: 4, Z: 4
};
const ZONA_EXCEPCIONES = [{ provincia: "B", desde: 1600, hasta: 1999, zona: 1 }];
const PRODUCTOS = { "1": { name: "1 LOKEBU", price: 29990 }, "2": { name: "Pack x2 LOKEBU", price: 49990 } };
const RETIROS = { "retiro-ituzaingo": "Retiro en Ituzaingó (Mansilla 928)", "retiro-luzuriaga": "Retiro en Villa Luzuriaga (Thames 689)" };
const ESTADOS = ["Pendiente de pago", "Pago confirmado", "Preparando", "Despachado", "Listo para retirar", "Entregado"];

const HEADERS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, x-admin-token", "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS" };
const reply = (statusCode, obj) => ({ statusCode, headers: HEADERS, body: JSON.stringify(obj) });
// Sin opción "consistency": la consistencia fuerte exige credenciales manuales (siteID/token) y falla dentro de Netlify.
const store = () => getStore({ name: "pedidos" });
const soloDigitos = (s) => String(s || "").replace(/\D/g, "");

function zonaPara(provincia, cp) {
  const n = Number(cp);
  const exc = ZONA_EXCEPCIONES.find((e) => e.provincia === provincia && n >= e.desde && n <= e.hasta);
  return exc ? exc.zona : PROVINCIA_ZONA[provincia] || null;
}

function generarId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `LK-${yy}${mm}-${s}`;
}

function esAdmin(event) {
  const t = event.headers["x-admin-token"] || event.headers["X-Admin-Token"];
  return !!process.env.ADMIN_TOKEN && t === process.env.ADMIN_TOKEN;
}

async function crearPedido(body) {
  const v = body;
  if (!PRODUCTOS[v.producto]) return reply(400, { error: "Producto inválido" });
  if (!["iOS", "Android"].includes(v.variante)) return reply(400, { error: "Variante inválida" });
  if (!v.nombre || String(v.nombre).trim().length < 3) return reply(400, { error: "Nombre inválido" });
  if (soloDigitos(v.telefono).length < 8) return reply(400, { error: "Teléfono inválido" });
  if (v.politicas !== true) return reply(400, { error: "Debés aceptar las políticas" });
  if (!["transferencia", "efectivo"].includes(v.pago)) return reply(400, { error: "Forma de pago inválida" });

  const producto = PRODUCTOS[v.producto];
  let envioPrecio = 0;
  let zona = null;
  let entregaTxt;

  if (RETIROS[v.entrega]) {
    entregaTxt = RETIROS[v.entrega];
  } else if (v.entrega === "envio") {
    if (!v.provincia || !PROVINCIA_ZONA[v.provincia]) return reply(400, { error: "Provincia inválida" });
    if (!/^\d{4}$/.test(String(v.cp || ""))) return reply(400, { error: "Código postal inválido" });
    if (!v.calle || !v.localidad) return reply(400, { error: "Completá la dirección" });
    zona = zonaPara(v.provincia, v.cp);
    envioPrecio = TARIFA_ZONA[zona];
    entregaTxt = `Envío a domicilio: ${String(v.calle).trim()}${v.depto ? " " + String(v.depto).trim() : ""}, ${String(v.localidad).trim()}, ${v.provincia} (CP ${v.cp})`;
  } else {
    return reply(400, { error: "Entrega inválida" });
  }

  const total = producto.price + envioPrecio;
  const id = generarId();
  const ahora = new Date().toISOString();
  const pedido = {
    id,
    creado: ahora,
    estado: "Pendiente de pago",
    historial: [{ estado: "Pendiente de pago", fecha: ahora }],
    tracking: null,
    producto: producto.name,
    precioProducto: producto.price,
    envio: envioPrecio,
    zona,
    total,
    variante: v.variante,
    nombre: String(v.nombre).trim(),
    telefono: String(v.telefono).trim(),
    email: v.email ? String(v.email).trim() : "",
    entrega: entregaTxt,
    pago: v.pago,
    comentarios: v.comentarios ? String(v.comentarios).trim().slice(0, 500) : ""
  };

  await store().setJSON(`orders/${id}`, pedido);
  return reply(200, { id, total, pago: pedido.pago });
}

async function seguimiento(params) {
  const id = String(params.id || "").trim().toUpperCase();
  const tel = soloDigitos(params.tel);
  if (!id || tel.length < 8) return reply(400, { error: "Completá número de pedido y teléfono" });

  const pedido = await store().get(`orders/${id}`, { type: "json" });
  // Respuesta genérica si no coincide, para no revelar qué pedidos existen.
  const ok = pedido && soloDigitos(pedido.telefono).slice(-8) === tel.slice(-8);
  if (!ok) return reply(404, { error: "No encontramos un pedido con esos datos" });

  return reply(200, {
    id: pedido.id,
    estado: pedido.estado,
    creado: pedido.creado,
    tracking: pedido.tracking,
    historial: pedido.historial,
    producto: pedido.producto
  });
}

async function listar(event) {
  if (!esAdmin(event)) return reply(401, { error: "No autorizado" });
  const { blobs } = await store().list({ prefix: "orders/" });
  const pedidos = [];
  for (const b of blobs) {
    const p = await store().get(b.key, { type: "json" });
    if (p) pedidos.push(p);
  }
  pedidos.sort((a, b) => (a.creado < b.creado ? 1 : -1));
  return reply(200, { pedidos, estados: ESTADOS });
}

async function actualizar(event) {
  if (!esAdmin(event)) return reply(401, { error: "No autorizado" });
  let b;
  try { b = JSON.parse(event.body || "{}"); } catch { return reply(400, { error: "JSON inválido" }); }
  const id = String(b.id || "").trim().toUpperCase();
  const pedido = await store().get(`orders/${id}`, { type: "json" });
  if (!pedido) return reply(404, { error: "Pedido no encontrado" });

  if (b.estado && b.estado !== pedido.estado) {
    if (!ESTADOS.includes(b.estado)) return reply(400, { error: "Estado inválido" });
    pedido.estado = b.estado;
    pedido.historial.push({ estado: b.estado, fecha: new Date().toISOString() });
  }
  if (b.tracking !== undefined) pedido.tracking = String(b.tracking || "").trim() || null;

  await store().setJSON(`orders/${id}`, pedido);
  return reply(200, { ok: true, pedido });
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return reply(204, {});
  try {
    if (event.httpMethod === "POST") {
      let body;
      try { body = JSON.parse(event.body || "{}"); } catch { return reply(400, { error: "JSON inválido" }); }
      return await crearPedido(body);
    }
    if (event.httpMethod === "GET") {
      if (event.queryStringParameters && event.queryStringParameters.admin) return await listar(event);
      return await seguimiento(event.queryStringParameters || {});
    }
    if (event.httpMethod === "PATCH") return await actualizar(event);
    return reply(405, { error: "Método no permitido" });
  } catch (err) {
    console.error("Error en pedidos:", err && err.stack ? err.stack : err);
    return reply(500, { error: "Error interno. Intentá de nuevo o escribinos por WhatsApp." });
  }
};
