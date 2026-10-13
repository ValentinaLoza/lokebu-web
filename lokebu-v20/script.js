/*
  CONFIGURACIÓN DE WHATSAPP
  Número en formato internacional, solo dígitos.
*/
const WHATSAPP_NUMBER = "5491135941335";
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
