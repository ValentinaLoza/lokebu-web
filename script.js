/*
  CONFIGURACIÓN DE WHATSAPP
  Número en formato internacional, solo dígitos.
*/
const WHATSAPP_NUMBER = (window.LOKEBU && window.LOKEBU.whatsapp) || "5491135941335";
const DEFAULT_WHATSAPP_MESSAGE = "Hola! Vengo desde la web de LOKEBU y quiero información sobre la tarjeta rastreadora.";

function openWhatsApp(message = DEFAULT_WHATSAPP_MESSAGE){
  if (!/^\d{10,15}$/.test(WHATSAPP_NUMBER)) {
    alert("Falta configurar el número de WhatsApp.");
    return;
  }
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

document.querySelectorAll(".js-whatsapp").forEach(btn => {
  btn.addEventListener("click", () => openWhatsApp(btn.dataset.waMessage || DEFAULT_WHATSAPP_MESSAGE));
});

document.getElementById("year").textContent = new Date().getFullYear();

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if(entry.isIntersecting){
      entry.target.classList.add("in-view");
      revealObserver.unobserve(entry.target);
    }
  });
},{threshold:.12});

document.querySelectorAll(".reveal").forEach(el => revealObserver.observe(el));


/* Calculadora de envío (mismos precios que el checkout, desde tienda-config.js) */
(function () {
  const C = window.LOKEBU;
  const sel = document.getElementById("calc-provincia");
  const cp = document.getElementById("calc-cp");
  const out = document.getElementById("ship-result");
  if (!C || !sel || !cp || !out) return;

  Object.entries(C.provincias)
    .sort((a, b) => a[1].localeCompare(b[1], "es"))
    .forEach(([code, name]) => sel.add(new Option(name, code)));

  const fmt = (n) => "$" + Number(n).toLocaleString("es-AR");
  const minimo = Math.min(...Object.values(C.envio.tarifas));

  function mostrar(titulo, detalle) {
    out.replaceChildren();
    const strong = document.createElement("strong");
    strong.textContent = titulo;
    const span = document.createElement("span");
    span.textContent = detalle;
    out.append(strong, span);
  }

  function calcular() {
    const prov = sel.value;
    const codigo = cp.value.replace(/\D/g, "");
    if (!prov) return mostrar(`Desde ${fmt(minimo)}`, `Envío a domicilio · ${C.envio.plazo} · con seguimiento`);
    // En Buenos Aires el precio depende del código postal.
    if (prov === "B" && codigo.length !== 4) return mostrar("Ingresá tu código postal", "En Provincia de Buenos Aires el costo depende de tu zona.");
    const costo = C.costoEnvio(prov, codigo || "0000");
    if (!costo) return mostrar("Consultanos", "Escribinos por WhatsApp y te confirmamos el envío.");
    mostrar(fmt(costo.precio), `${C.envio.nombre} a ${C.provincias[prov]} · ${C.envio.plazo}`);
  }

  sel.addEventListener("change", calcular);
  cp.addEventListener("input", calcular);
})();
