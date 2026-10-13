/* ==============================================
   CONFIGURACIÓN
   ============================================== */
const WHATSAPP_NUMBER = "5491135941335";
const COTIZAR_URL = "/.netlify/functions/cotizar";

const TRANSFER = {
  titular: "Valentina Miranda Loza",
  alias: "lokebu",
  banco: "Mercado Pago"
};
const RETIRO = {
  "retiro-ituzaingo": "Retiro en Ituzaingó (Mansilla 928)",
  "retiro-luzuriaga": "Retiro en Villa Luzuriaga (Thames 689)"
};
const PRODUCTS = {
  "1": { name: "1 LOKEBU", price: 29990 },
  "2": { name: "Pack x2 LOKEBU", price: 49990 }
};

/* ==============================================
   ENVÍO ESTANDARIZADO (sin API)
   Precios PAQ.AR Clásico, paquete de 20 g y 2 × 9 × 12 cm, despachado desde Villa Luzuriaga.
   Verificados en el panel de MiCorreo: CABA/conurbano, Córdoba, Mar del Plata, Mendoza, Ushuaia.
   Las zonas son radiales desde el origen; por provincia es una aproximación en los bordes.
   ============================================== */
const ENVIO_MODO = "tabla";   // "tabla" = precios fijos por zona | "api" = cotizar con MiCorreo (Fase 2)
const TARIFA_CLASICO = { 1: 7755, 2: 8955, 3: 9750, 4: 9808 };
const PLAZO_CLASICO = "2 a 5";

// Zona por código de provincia (códigos oficiales de Correo). 1 = CABA/AMBA, 4 = más de 1.300 km.
const ZONA_POR_PROVINCIA = {
  A: 3, C: 1, D: 2, E: 2, F: 3, G: 3, H: 3, J: 3, K: 3, L: 2, M: 3, N: 3,
  P: 3, Q: 3, R: 3, S: 2, T: 3, U: 4, V: 4, W: 3, X: 2, Y: 4, Z: 4
};

// Zona según provincia y CP. La provincia de Buenos Aires se separa por CP.
// La localidad no define la zona: se usa solo para la dirección.
function zonaEnvio(provincia, cp) {
  if (provincia === "B") {
    const n = Number(cp);
    if (n >= 1600 && n <= 1999) return 1;   // Conurbano bonaerense
    if (n >= 8500) return 3;                // Sur de la provincia (Carmen de Patagones, etc.)
    return 2;                               // Resto de la provincia
  }
  return ZONA_POR_PROVINCIA[provincia] ?? null;
}

/* ==============================================
   ESTADO
   ============================================== */
const form = document.getElementById("checkout-form");
const fmt = n => "$" + Number(n).toLocaleString("es-AR");
const envio = { status: "idle", precio: null, producto: "", plazoMin: null, plazoMax: null };
let debounceTimer = null;

const esEnvio = () => form.entrega.value === "envio";
const esRetiro = () => !!RETIRO[form.entrega.value];
const productoActual = () => PRODUCTS[form.producto.value];

/* ==============================================
   RESUMEN
   ============================================== */
function setEnvioStatus(text) {
  const el = document.getElementById("envio-status");
  if (el) el.textContent = text || "";
}

function updateSummary() {
  const p = productoActual();
  const sumP = document.getElementById("sum-producto");
  const sumPrice = document.getElementById("sum-precio");
  const sumEnvioEl = document.getElementById("sum-envio");
  const sumTotal = document.getElementById("sum-total");

  form.querySelector(".address").hidden = !esEnvio();

  if (!p) {
    sumP.textContent = "Elegí un producto";
    sumPrice.textContent = "—";
    sumEnvioEl.textContent = "—";
    sumTotal.textContent = "—";
    return;
  }

  sumP.textContent = p.name;
  sumPrice.textContent = fmt(p.price);

  if (esRetiro()) {
    sumEnvioEl.textContent = "Sin costo (retiro)";
    sumTotal.textContent = fmt(p.price);
    return;
  }

  if (!esEnvio()) {
    sumEnvioEl.textContent = "Elegí cómo recibirlo";
    sumTotal.textContent = fmt(p.price) + " + envío";
    return;
  }

  if (envio.status === "ok") {
    sumEnvioEl.textContent = fmt(envio.precio);
    sumTotal.textContent = fmt(p.price + envio.precio);
  } else if (envio.status === "loading") {
    sumEnvioEl.textContent = "Calculando…";
    sumTotal.textContent = fmt(p.price) + " + envío";
  } else if (envio.status === "error") {
    sumEnvioEl.textContent = "A confirmar por WhatsApp";
    sumTotal.textContent = fmt(p.price) + " + envío";
  } else {
    sumEnvioEl.textContent = "Ingresá tu código postal";
    sumTotal.textContent = fmt(p.price) + " + envío";
  }
}

/* ==============================================
   COTIZACIÓN DE ENVÍO
   ============================================== */
async function cotizar() {
  const cp = form.cp.value.trim();
  const prov = form.provincia.value;
  const p = form.producto.value;

  if (!esEnvio() || !PRODUCTS[p] || !/^\d{4}$/.test(cp) || !prov) {
    envio.status = "idle";
    setEnvioStatus(esEnvio() && (cp || prov) ? "Completá provincia y código postal (4 dígitos)." : "");
    updateSummary();
    return;
  }

  if (ENVIO_MODO === "tabla") {
    const zona = zonaEnvio(prov, cp);
    if (!zona) {
      envio.status = "error";
      setEnvioStatus("No pudimos calcular el envío para esa zona. Lo confirmamos por WhatsApp.");
    } else {
      envio.status = "ok";
      envio.precio = TARIFA_CLASICO[zona];
      envio.producto = "Correo Argentino Clásico";
      envio.plazoMin = "2";
      envio.plazoMax = "5";
      setEnvioStatus(`${envio.producto} · ${PLAZO_CLASICO} días hábiles · Zona ${zona}`);
    }
    updateSummary();
    return;
  }

  // Modo API (Fase 2)
  envio.status = "loading";
  setEnvioStatus("Calculando envío…");
  updateSummary();
  try {
    const res = await fetch(COTIZAR_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cp, producto: p })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error");
    envio.status = "ok";
    envio.precio = Number(data.precio);
    envio.producto = data.producto;
    envio.plazoMin = data.plazoMin;
    envio.plazoMax = data.plazoMax;
    setEnvioStatus(`${data.producto} · ${data.plazoMin} a ${data.plazoMax} días hábiles`);
  } catch (err) {
    envio.status = "error";
    setEnvioStatus("No pudimos calcular el envío automáticamente. Lo confirmamos por WhatsApp.");
  }
  updateSummary();
}

/* ==============================================
   PRECARGA DESDE LA LANDING: checkout.html?p=1|2
   ============================================== */
const initial = new URLSearchParams(location.search).get("p");
if (PRODUCTS[initial]) form.producto.value = initial;

form.addEventListener("change", (e) => {
  if (e.target.name === "entrega" || e.target.name === "producto" || e.target.name === "provincia") {
    cotizar();
  } else {
    updateSummary();
  }
});

form.addEventListener("input", (e) => {
  if (e.target.name === "cp") {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(cotizar, 500);
  }
});

updateSummary();

/* ==============================================
   VALIDACIÓN
   ============================================== */
function showError(name, show, text) {
  const el = form.querySelector(`[data-error-for="${name}"]`);
  if (!el) return;
  if (text) el.textContent = text;
  el.hidden = !show;
}

function validate() {
  let ok = true;
  const v = (n) => (form.elements[n] ? form.elements[n].value.trim() : "");

  const checks = {
    producto: !!form.producto.value,
    variante: !!form.querySelector('input[name="variante"]:checked'),
    nombre: v("nombre").length >= 3,
    telefono: /^[\d\s()+-]{8,20}$/.test(v("telefono")),
    entrega: !!form.querySelector('input[name="entrega"]:checked'),
    pago: !!form.querySelector('input[name="pago"]:checked'),
    politicas: form.politicas.checked,
    direccion: !esEnvio() || (v("calle") && v("localidad") && v("provincia") && /^\d{4}$/.test(v("cp")))
  };

  Object.entries(checks).forEach(([k, good]) => {
    showError(k, !good);
    if (!good) ok = false;
  });

  // El envío a domicilio necesita un costo calculado (o quedar para confirmar por WhatsApp).
  if (esEnvio() && envio.status === "loading") {
    showError("direccion", true, "Esperá a que termine de calcularse el envío.");
    ok = false;
  }

  return ok;
}

/* ==============================================
   MENSAJE DE WHATSAPP
   ============================================== */
function buildMessage(orderId) {
  const f = form;
  const p = PRODUCTS[f.producto.value];
  const sep = "━━━━━━━━━━━━━━━━";

  const entrega = RETIRO[f.entrega.value]
    ? [RETIRO[f.entrega.value], "Coordinamos día y horario por WhatsApp"]
    : [
        "Envío a domicilio",
        `${f.calle.value.trim()}${f.depto.value.trim() ? " " + f.depto.value.trim() : ""}, ${f.localidad.value.trim()}, ${f.provincia.options[f.provincia.selectedIndex].text} (CP ${f.cp.value.trim()})`
      ];

  let envioLinea;
  let totalLinea;
  if (esRetiro()) {
    envioLinea = "Sin costo (retiro)";
    totalLinea = fmt(p.price);
  } else if (envio.status === "ok") {
    envioLinea = `${fmt(envio.precio)} · ${envio.producto} (${envio.plazoMin} a ${envio.plazoMax} días hábiles)`;
    totalLinea = fmt(p.price + envio.precio);
  } else {
    envioLinea = "A confirmar por WhatsApp";
    totalLinea = `${fmt(p.price)} + envío`;
  }

  const pago = f.pago.value === "transferencia" ? "Transferencia" : "Efectivo";

  const lines = [
    `◆ *NUEVO PEDIDO · LOKEBU*`,
    sep,
    `▸ *Pedido:* ${orderId}`,
    ``,
    `▸ *Producto*`,
    `${p.name} · ${fmt(p.price)}`,
    ``,
    `▸ *Teléfono*`,
    f.variante.value === "iOS" ? "iPhone (iOS)" : "Android",
    ``,
    `▸ *Contacto*`,
    `Nombre: ${f.nombre.value.trim()}`,
    `WhatsApp: ${f.telefono.value.trim()}`,
    f.email.value.trim() ? `Email: ${f.email.value.trim()}` : null,
    ``,
    `▸ *Entrega*`,
    ...entrega,
    ``,
    `▸ *Envío*`,
    envioLinea,
    ``,
    `▸ *Total*`,
    totalLinea,
    ``,
    `▸ *Pago*`,
    pago,
    f.comentarios.value.trim() ? `\n▸ *Comentarios*\n${f.comentarios.value.trim()}` : null,
    sep,
    `¿Me confirmás los datos para pagar?`
  ].filter((l) => l !== null);

  return lines.join("\n");
}

function transferText() {
  if (TRANSFER.alias) {
    return `Alias: ${TRANSFER.alias} (${TRANSFER.banco}) · Titular: ${TRANSFER.titular}`;
  }
  return "Te paso los datos de transferencia por WhatsApp.";
}

/* ==============================================
   ENVÍO DEL PEDIDO (registra en el servidor y muestra el panel de pago)
   ============================================== */
const PEDIDOS_URL = "/.netlify/functions/pedidos";

function payloadPedido() {
  const v = (n) => (form.elements[n] ? form.elements[n].value.trim() : "");
  return {
    producto: form.producto.value,
    variante: (form.querySelector('input[name="variante"]:checked') || {}).value,
    nombre: v("nombre"),
    telefono: v("telefono"),
    email: v("email"),
    entrega: (form.querySelector('input[name="entrega"]:checked') || {}).value,
    calle: v("calle"),
    depto: v("depto"),
    localidad: v("localidad"),
    provincia: v("provincia"),
    cp: v("cp"),
    pago: (form.querySelector('input[name="pago"]:checked') || {}).value,
    comentarios: v("comentarios"),
    politicas: form.politicas.checked
  };
}

function mostrarPanelPago(res, pedido) {
  const efectivo = pedido.pago === "efectivo";
  document.getElementById("pp-id").textContent = res.id;
  document.getElementById("pp-total").textContent = fmt(res.total);
  document.getElementById("pp-alias").textContent = TRANSFER.alias || "Te lo pasamos por WhatsApp";
  document.getElementById("pp-titular").textContent = TRANSFER.titular;
  document.getElementById("pp-banco").textContent = TRANSFER.banco;
  document.getElementById("pp-transfer").hidden = efectivo;
  document.getElementById("pp-efectivo").hidden = !efectivo;

  const msg = efectivo
    ? `Hola! Hice el pedido ${res.id} por ${fmt(res.total)} con pago en efectivo. ¿Coordinamos la entrega?`
    : `Hola! Te envío el comprobante de la transferencia del pedido ${res.id} por ${fmt(res.total)}. Nombre: ${pedido.nombre}.`;
  document.getElementById("pp-wa").href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
  document.getElementById("pp-track").href = `seguimiento.html?id=${encodeURIComponent(res.id)}`;

  document.getElementById("checkout-grid").hidden = true;
  document.getElementById("pago-panel").hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.getElementById("pp-copy").addEventListener("click", async () => {
  const btn = document.getElementById("pp-copy");
  try {
    await navigator.clipboard.writeText(TRANSFER.alias);
    btn.textContent = "¡Copiado!";
  } catch (e) {
    btn.textContent = "No se pudo copiar";
  }
  setTimeout(() => (btn.textContent = "Copiar alias"), 2000);
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const errBox = document.getElementById("submit-error");
  errBox.hidden = true;

  if (!validate()) {
    const first = form.querySelector(".field-error:not([hidden])");
    if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = "Registrando pedido…";

  const pedido = payloadPedido();
  try {
    const res = await fetch(PEDIDOS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pedido)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "No pudimos registrar el pedido");
    mostrarPanelPago(data, pedido);
  } catch (err) {
    errBox.textContent = (err.message || "No pudimos registrar el pedido") + ". Si el problema sigue, escribinos por WhatsApp.";
    errBox.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = "Enviar pedido";
  }
});
