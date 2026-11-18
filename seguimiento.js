const PEDIDOS_URL = "/api/pedidos";
const PASOS = {
  envio: ["Pendiente de pago", "Pago confirmado", "Preparando", "Despachado", "Entregado"],
  retiro: ["Pendiente de pago", "Pago confirmado", "Preparando", "Listo para retirar", "Entregado"],
};
const WHATSAPP = (window.LOKEBU && window.LOKEBU.whatsapp) || "5491135941335";

const form = document.getElementById("track-form");
const errBox = document.getElementById("track-err");
const result = document.getElementById("track-result");
const banner = document.getElementById("pago-banner");

const params = new URLSearchParams(location.search);
const acceso = params.get("t");
if (params.get("id")) form.id.value = params.get("id");

const fechaCorta = (iso) => new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
const fmt = (n) => "$" + Number(n).toLocaleString("es-AR");

function mostrarBanner(clase, titulo, detalle, link) {
  banner.className = `pago-banner ${clase}`;
  banner.textContent = titulo;
  if (detalle) {
    const small = document.createElement("small");
    small.textContent = detalle + " ";
    if (link) {
      const a = document.createElement("a");
      a.href = link.href;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = link.text;
      small.appendChild(a);
    }
    banner.appendChild(small);
  }
  banner.hidden = false;
}

// Mensaje al volver de Mercado Pago.
const vuelta = params.get("pago");
if (vuelta === "ok") mostrarBanner("ok", "¡Gracias! Tu pago fue aprobado.", "Ya estamos preparando tu LOKEBU. Guardá este link para seguir tu pedido.");
else if (vuelta === "pendiente") mostrarBanner("pendiente", "Tu pago está pendiente.", "Si pagaste en efectivo (Rapipago / Pago Fácil), se acredita cuando lo abonás. Te avisamos cuando se confirme.");
else if (vuelta === "error")
  mostrarBanner("error", "El pago no se pudo completar.", "Tu pedido quedó reservado. Podés pagarlo por transferencia o escribirnos:", {
    href: `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Hola! Mi pago del pedido ${params.get("id") || ""} no se completó. ¿Me ayudan?`)}`,
    text: "WhatsApp",
  });

function render(p) {
  document.getElementById("tr-estado").textContent = p.estado;
  const sub = [`Pedido ${p.id}`, p.producto, fmt(p.total)];
  if (p.pagoEstado) sub.push(`Pago Mercado Pago: ${p.pagoEstado}`);
  if (p.tracking) sub.push(`Seguimiento Correo Argentino: ${p.tracking}`);
  document.getElementById("tr-sub").textContent = sub.join(" · ");

  const pasos = p.estado === "Cancelado" ? ["Pendiente de pago", "Cancelado"] : PASOS[p.entregaTipo] || PASOS.envio;
  const actual = pasos.indexOf(p.estado);
  const ul = document.getElementById("tr-steps");
  ul.innerHTML = "";
  pasos.forEach((estado, idx) => {
    const li = document.createElement("li");
    const registro = (p.historial || []).filter((h) => h.estado === estado).pop();
    if (idx < actual) li.classList.add("done");
    if (idx === actual) li.classList.add("current");
    li.textContent = estado;
    if (registro) {
      const small = document.createElement("small");
      small.textContent = fechaCorta(registro.fecha);
      li.appendChild(small);
    }
    ul.appendChild(li);
  });

  if (p.tracking) {
    const li = document.createElement("li");
    li.className = "track-link";
    const a = document.createElement("a");
    a.href = "https://www.correoargentino.com.ar/formularios/e-commerce";
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = `Seguir el envío ${p.tracking} en Correo Argentino →`;
    li.appendChild(a);
    ul.appendChild(li);
  }
  result.hidden = false;
}

async function buscar(query) {
  errBox.hidden = true;
  result.hidden = true;
  try {
    const res = await fetch(`${PEDIDOS_URL}?${new URLSearchParams(query)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "No encontramos el pedido");
    render(data);
  } catch (err) {
    errBox.textContent = err.message;
    errBox.hidden = false;
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const id = form.id.value.trim();
  const tel = form.tel.value.trim();
  if (!id || tel.replace(/\D/g, "").length < 8) {
    errBox.textContent = "Completá número de pedido y teléfono.";
    errBox.hidden = false;
    return;
  }
  buscar({ id, tel });
});

// Con el link de acceso (vuelta de Mercado Pago o panel de pago) se carga sin pedir teléfono.
if (params.get("id") && acceso) {
  buscar({ id: params.get("id"), t: acceso }).then(() => {
    if (!result.hidden) form.hidden = true; // ya está identificado: no hace falta pedir el teléfono
  });
}
