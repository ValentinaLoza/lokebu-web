import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";
import CONFIG from "../../tienda-config.js";
import MP from "../lib/mercadopago.js";
import AVISO from "../lib/notificar.js";

/*
  Pedidos LOKEBU (función moderna de Netlify: Blobs funciona sin configuración extra).
  POST   /api/pedidos                    -> crea pedido (público). Con Mercado Pago devuelve el link de pago.
  GET    /api/pedidos?id=&tel=           -> seguimiento (valida teléfono)
  GET    /api/pedidos?id=&t=             -> seguimiento con el código de acceso del link de retorno
  GET    /api/pedidos?admin=1            -> lista todos (header x-admin-token)
  PATCH  /api/pedidos                    -> cambia estado / tracking (header x-admin-token)
*/

export const config = {
  path: "/api/pedidos",
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ["ip", "domain"] },
};

const ESTADOS = ["Pendiente de pago", "Pago confirmado", "Preparando", "Despachado", "Listo para retirar", "Entregado", "Cancelado"];

const json = (status, obj) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const store = () => getStore({ name: "pedidos" });
const soloDigitos = (s) => String(s || "").replace(/\D/g, "");
const texto = (s, max) => String(s ?? "").trim().slice(0, max);
const siteUrl = () => (process.env.URL || "").replace(/\/$/, "");

function iguales(a, b) {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
}

function esAdmin(req) {
  return !!process.env.ADMIN_TOKEN && iguales(req.headers.get("x-admin-token"), process.env.ADMIN_TOKEN);
}

function generarId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(6);
  let s = "";
  for (const b of bytes) s += chars[b % chars.length];
  const d = new Date();
  return `LK-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}-${s}`;
}

async function crearPedido(req) {
  let v;
  try { v = await req.json(); } catch { return json(400, { error: "Datos inválidos" }); }

  // Campo trampa para bots: un humano nunca lo completa.
  if (v.empresa) return json(400, { error: "No pudimos registrar el pedido" });

  const producto = CONFIG.productos[v.producto];
  if (!producto) return json(400, { error: "Producto inválido" });
  if (!CONFIG.variantes.includes(v.variante)) return json(400, { error: "Elegí la variante de tu teléfono" });
  const nombre = texto(v.nombre, 80);
  if (nombre.length < 3) return json(400, { error: "Nombre inválido" });
  const telefono = texto(v.telefono, 25);
  if (soloDigitos(telefono).length < 8) return json(400, { error: "Teléfono inválido" });
  const email = texto(v.email, 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: "Email inválido" });
  if (v.politicas !== true) return json(400, { error: "Debés aceptar las políticas" });
  if (!CONFIG.pagos.includes(v.pago)) return json(400, { error: "Forma de pago inválida" });

  let envio = 0;
  let zona = null;
  let entrega;
  let direccion = null;

  if (CONFIG.retiros[v.entrega]) {
    entrega = CONFIG.retiros[v.entrega];
  } else if (v.entrega === "envio") {
    if (v.pago === "efectivo") return json(400, { error: "El pago en efectivo es solo para retiro en persona" });
    if (!CONFIG.provincias[v.provincia]) return json(400, { error: "Provincia inválida" });
    if (!/^\d{4}$/.test(String(v.cp || ""))) return json(400, { error: "Código postal inválido" });
    const calle = texto(v.calle, 120);
    const localidad = texto(v.localidad, 80);
    if (!calle || !localidad) return json(400, { error: "Completá la dirección" });
    const costo = CONFIG.costoEnvio(v.provincia, v.cp);
    if (!costo) return json(400, { error: "No hacemos envíos a esa zona todavía" });
    zona = costo.zona;
    envio = costo.precio;
    direccion = { calle, depto: texto(v.depto, 30), localidad, provincia: v.provincia, cp: String(v.cp) };
    entrega = `${CONFIG.envio.nombre}: ${calle}${direccion.depto ? " " + direccion.depto : ""}, ${localidad}, ${CONFIG.provincias[v.provincia]} (CP ${v.cp})`;
  } else {
    return json(400, { error: "Elegí cómo recibirlo" });
  }

  if (v.pago === "mercadopago" && (!MP.habilitado() || !siteUrl())) {
    return json(503, { error: "El pago con Mercado Pago no está disponible en este momento. Elegí transferencia" });
  }

  const ahora = new Date().toISOString();
  const pedido = {
    id: generarId(),
    acceso: crypto.randomBytes(12).toString("hex"), // para ver el pedido desde el link de retorno
    creado: ahora,
    estado: "Pendiente de pago",
    historial: [{ estado: "Pendiente de pago", fecha: ahora }],
    tracking: null,
    productoId: v.producto,
    producto: producto.nombre,
    unidades: producto.unidades,
    precioProducto: producto.precio,
    envio,
    zona,
    total: producto.precio + envio,
    variante: v.variante,
    nombre,
    telefono,
    email,
    entrega,
    direccion,
    pago: v.pago,
    pagoMP: null,
    comentarios: texto(v.comentarios, 500),
  };

  let linkPago = null;
  if (pedido.pago === "mercadopago") {
    try {
      const pref = await MP.crearPreferencia(pedido, siteUrl());
      pedido.pagoMP = { preferencia: pref.id, estado: "sin iniciar" };
      linkPago = pref.init_point;
    } catch (err) {
      console.error("Error creando preferencia MP:", err.status, JSON.stringify(err.detail || err.message));
      return json(502, { error: "No pudimos conectar con Mercado Pago. Probá de nuevo o elegí transferencia" });
    }
  }

  await store().setJSON(`orders/${pedido.id}`, pedido);
  // Transferencia y efectivo: aviso de pedido nuevo. Mercado Pago avisa recién cuando se acredita el pago.
  if (pedido.pago !== "mercadopago") await AVISO.notificarVenta(pedido, "pedido");
  return json(200, { id: pedido.id, acceso: pedido.acceso, total: pedido.total, pago: pedido.pago, linkPago });
}

function vistaPublica(p) {
  return {
    id: p.id,
    estado: p.estado,
    creado: p.creado,
    tracking: p.tracking,
    historial: p.historial,
    producto: p.producto,
    total: p.total,
    pago: p.pago,
    pagoEstado: p.pagoMP ? p.pagoMP.estado : null,
    entregaTipo: p.direccion ? "envio" : "retiro",
  };
}

async function seguimiento(params) {
  const id = texto(params.get("id"), 20).toUpperCase();
  const tel = soloDigitos(params.get("tel"));
  const t = params.get("t");
  if (!id || (!t && tel.length < 8)) return json(400, { error: "Completá número de pedido y teléfono" });

  const pedido = await store().get(`orders/${id}`, { type: "json" });
  // Respuesta genérica si no coincide, para no revelar qué pedidos existen.
  const ok =
    pedido &&
    ((t && iguales(t, pedido.acceso)) ||
      (tel.length >= 8 && soloDigitos(pedido.telefono).slice(-8) === tel.slice(-8)));
  if (!ok) return json(404, { error: "No encontramos un pedido con esos datos" });
  return json(200, vistaPublica(pedido));
}

async function listar() {
  const s = store();
  const { blobs } = await s.list({ prefix: "orders/" });
  const pedidos = (await Promise.all(blobs.map((b) => s.get(b.key, { type: "json" })))).filter(Boolean);
  pedidos.sort((a, b) => (a.creado < b.creado ? 1 : -1));
  return json(200, { pedidos, estados: ESTADOS });
}

async function actualizar(req) {
  let b;
  try { b = await req.json(); } catch { return json(400, { error: "Datos inválidos" }); }
  const id = texto(b.id, 20).toUpperCase();
  const s = store();
  const pedido = await s.get(`orders/${id}`, { type: "json" });
  if (!pedido) return json(404, { error: "Pedido no encontrado" });

  if (b.estado && b.estado !== pedido.estado) {
    if (!ESTADOS.includes(b.estado)) return json(400, { error: "Estado inválido" });
    pedido.estado = b.estado;
    pedido.historial.push({ estado: b.estado, fecha: new Date().toISOString() });
  }
  if (b.tracking !== undefined) pedido.tracking = texto(b.tracking, 40) || null;

  await s.setJSON(`orders/${id}`, pedido);
  return json(200, { ok: true, pedido });
}

export default async (req) => {
  try {
    const url = new URL(req.url);
    if (req.method === "POST") return await crearPedido(req);
    if (req.method === "GET") {
      if (url.searchParams.get("admin")) {
        if (!esAdmin(req)) return json(401, { error: "No autorizado" });
        return await listar();
      }
      return await seguimiento(url.searchParams);
    }
    if (req.method === "PATCH") {
      if (!esAdmin(req)) return json(401, { error: "No autorizado" });
      return await actualizar(req);
    }
    return json(405, { error: "Método no permitido" });
  } catch (err) {
    console.error("Error en pedidos:", err && err.stack ? err.stack : err);
    return json(500, { error: "Error interno. Intentá de nuevo o escribinos por WhatsApp." });
  }
};
