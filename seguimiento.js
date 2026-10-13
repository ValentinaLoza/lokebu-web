const PEDIDOS_URL = "/.netlify/functions/pedidos";
const ESTADOS_ORDEN = ["Pendiente de pago", "Pago confirmado", "Preparando", "Despachado", "Listo para retirar", "Entregado"];

const form = document.getElementById("track-form");
const errBox = document.getElementById("track-err");
const result = document.getElementById("track-result");

const params = new URLSearchParams(location.search);
if (params.get("id")) form.id.value = params.get("id");

const fechaCorta = (iso) => new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });

function render(p) {
  document.getElementById("tr-estado").textContent = p.estado;
  const sub = [`Pedido ${p.id}`, p.producto];
  if (p.tracking) sub.push(`Seguimiento Correo: ${p.tracking}`);
  document.getElementById("tr-sub").textContent = sub.join(" · ");

  const actual = ESTADOS_ORDEN.indexOf(p.estado);
  const ul = document.getElementById("tr-steps");
  ul.innerHTML = "";
  ESTADOS_ORDEN.forEach((estado, idx) => {
    const li = document.createElement("li");
    const registro = (p.historial || []).find((h) => h.estado === estado);
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
  result.hidden = false;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errBox.hidden = true;
  result.hidden = true;
  const id = form.id.value.trim();
  const tel = form.tel.value.trim();
  if (!id || tel.replace(/\D/g, "").length < 8) {
    errBox.textContent = "Completá número de pedido y teléfono.";
    errBox.hidden = false;
    return;
  }
  try {
    const res = await fetch(`${PEDIDOS_URL}?id=${encodeURIComponent(id)}&tel=${encodeURIComponent(tel)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "No encontramos el pedido");
    render(data);
  } catch (err) {
    errBox.textContent = err.message;
    errBox.hidden = false;
  }
});

if (params.get("id")) form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit"));
