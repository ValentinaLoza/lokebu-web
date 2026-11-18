/* Checkout LOKEBU. Precios y envío salen de tienda-config.js (los mismos que usa el servidor). */
const C = window.LOKEBU;
const PEDIDOS_URL = "/api/pedidos";

const form = document.getElementById("checkout-form");
const fmt = (n) => "$" + Number(n).toLocaleString("es-AR");
const $ = (id) => document.getElementById(id);

const marcado = (name) => (form.querySelector(`input[name="${name}"]:checked`) || {}).value || "";
const esEnvio = () => marcado("entrega") === "envio";
const esRetiro = () => !!C.retiros[marcado("entrega")];
const productoActual = () => C.productos[marcado("producto")];

function envioActual() {
  if (!esEnvio()) return null;
  const cp = form.cp.value.trim();
  const prov = form.provincia.value;
  if (!prov || !/^\d{4}$/.test(cp)) return null;
  return C.costoEnvio(prov, cp);
}

/* ---------- Resumen ---------- */
function updateSummary() {
  const p = productoActual();
  form.querySelector(".address").hidden = !esEnvio();

  // Efectivo solo con retiro en persona.
  const efectivo = form.querySelector('input[name="pago"][value="efectivo"]');
  efectivo.disabled = esEnvio();
  $("opt-efectivo").classList.toggle("is-disabled", esEnvio());
  if (esEnvio() && efectivo.checked) efectivo.checked = false;

  const envio = envioActual();
  const status = $("envio-status");
  if (esEnvio()) {
    if (envio) status.textContent = `${C.envio.nombre} · ${C.envio.plazo} · ${fmt(envio.precio)}`;
    else if (form.cp.value || form.provincia.value) status.textContent = "Completá provincia y código postal (4 dígitos) para calcular el envío.";
    else status.textContent = "";
  }

  // Texto del botón según la forma de pago.
  const pago = marcado("pago");
  $("submit-btn").textContent = pago === "mercadopago" ? "Ir a pagar con Mercado Pago" : "Confirmar pedido";
  $("submit-note").textContent =
    pago === "mercadopago"
      ? "Te llevamos al sitio seguro de Mercado Pago para completar el pago."
      : "Tu pedido queda reservado hasta que se acredite el pago.";

  if (!p) {
    $("sum-producto").textContent = "Elegí un producto";
    $("sum-precio").textContent = "—";
    $("sum-envio").textContent = "—";
    $("sum-total").textContent = "—";
    return;
  }
  $("sum-producto").textContent = p.nombre;
  $("sum-precio").textContent = fmt(p.precio);

  if (esRetiro()) {
    $("sum-envio").textContent = "Sin costo (retiro)";
    $("sum-total").textContent = fmt(p.precio);
  } else if (envio) {
    $("sum-envio").textContent = fmt(envio.precio);
    $("sum-total").textContent = fmt(p.precio + envio.precio);
  } else {
    $("sum-envio").textContent = esEnvio() ? "Ingresá tu código postal" : "Elegí cómo recibirlo";
    $("sum-total").textContent = fmt(p.precio) + " + envío";
  }
}

/* Precarga desde la landing: checkout.html?p=1|2 */
const inicial = new URLSearchParams(location.search).get("p");
if (C.productos[inicial]) form.querySelector(`input[name="producto"][value="${inicial}"]`).checked = true;

form.addEventListener("change", updateSummary);
form.addEventListener("input", (e) => { if (e.target.name === "cp") updateSummary(); });
updateSummary();

/* ---------- Validación ---------- */
function showError(name, show, text) {
  const el = form.querySelector(`[data-error-for="${name}"]`);
  if (!el) return;
  if (text) el.textContent = text;
  el.hidden = !show;
}

function validate() {
  const v = (n) => (form.elements[n] ? form.elements[n].value.trim() : "");
  const checks = {
    producto: !!marcado("producto"),
    variante: !!marcado("variante"),
    nombre: v("nombre").length >= 3,
    telefono: /^[\d\s()+-]{8,20}$/.test(v("telefono")),
    email: !v("email") || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v("email")),
    entrega: !!marcado("entrega"),
    pago: !!marcado("pago"),
    politicas: form.politicas.checked,
    direccion: !esEnvio() || !!(v("calle") && v("localidad") && envioActual()),
  };
  let ok = true;
  Object.entries(checks).forEach(([k, good]) => {
    showError(k, !good);
    if (!good) ok = false;
  });
  return ok;
}

/* ---------- Envío del pedido ---------- */
function payloadPedido() {
  const v = (n) => (form.elements[n] ? form.elements[n].value.trim() : "");
  return {
    producto: marcado("producto"),
    variante: marcado("variante"),
    nombre: v("nombre"),
    telefono: v("telefono"),
    email: v("email"),
    entrega: marcado("entrega"),
    calle: v("calle"),
    depto: v("depto"),
    localidad: v("localidad"),
    provincia: v("provincia"),
    cp: v("cp"),
    pago: marcado("pago"),
    comentarios: v("comentarios"),
    politicas: form.politicas.checked,
    empresa: v("empresa"),
  };
}

function mostrarPanelPago(res, pedido) {
  const efectivo = pedido.pago === "efectivo";
  $("pp-id").textContent = res.id;
  $("pp-total").textContent = fmt(res.total);
  $("pp-alias").textContent = C.transferencia.alias;
  $("pp-titular").textContent = C.transferencia.titular;
  $("pp-banco").textContent = C.transferencia.banco;
  $("pp-transfer").hidden = efectivo;
  $("pp-efectivo").hidden = !efectivo;

  const msg = efectivo
    ? `Hola! Hice el pedido ${res.id} por ${fmt(res.total)} para retirar y pagar en efectivo. ¿Coordinamos día y horario?`
    : `Hola! Te envío el comprobante de la transferencia del pedido ${res.id} por ${fmt(res.total)}. Nombre: ${pedido.nombre}.`;
  $("pp-wa").href = `https://wa.me/${C.whatsapp}?text=${encodeURIComponent(msg)}`;
  $("pp-wa").textContent = efectivo ? "Coordinar retiro por WhatsApp" : "Enviar comprobante por WhatsApp";
  $("pp-track").href = `seguimiento.html?id=${encodeURIComponent(res.id)}&t=${encodeURIComponent(res.acceso)}`;

  $("checkout-grid").hidden = true;
  $("pago-panel").hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

$("pp-copy").addEventListener("click", async () => {
  const btn = $("pp-copy");
  try {
    await navigator.clipboard.writeText(C.transferencia.alias);
    btn.textContent = "¡Copiado!";
  } catch {
    btn.textContent = "No se pudo copiar";
  }
  setTimeout(() => (btn.textContent = "Copiar alias"), 2000);
});

let enviando = false;
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (enviando) return;
  const errBox = $("submit-error");
  errBox.hidden = true;

  if (!validate()) {
    const first = form.querySelector(".field-error:not([hidden])");
    if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const btn = $("submit-btn");
  const textoOriginal = btn.textContent;
  enviando = true;
  btn.disabled = true;
  btn.textContent = "Registrando pedido…";

  const pedido = payloadPedido();
  try {
    const res = await fetch(PEDIDOS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pedido),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "No pudimos registrar el pedido");

    if (data.linkPago) {
      btn.textContent = "Abriendo Mercado Pago…";
      window.location.assign(data.linkPago);
      return; // se queda bloqueado mientras se va a Mercado Pago
    }
    mostrarPanelPago(data, pedido);
  } catch (err) {
    errBox.textContent = (err.message || "No pudimos registrar el pedido") + ". Si el problema sigue, escribinos por WhatsApp.";
    errBox.hidden = false;
  }
  enviando = false;
  btn.disabled = false;
  btn.textContent = textoOriginal;
});
