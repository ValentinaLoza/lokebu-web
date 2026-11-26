const API = "/api/pedidos";
const $ = (id) => document.getElementById(id);
const money = (n) => "$" + Number(n).toLocaleString("es-AR");
let estados = [];
let token = "";

// Todo dato del cliente se inserta como texto, nunca como HTML.
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") node.className = v;
    else node.setAttribute(k, v);
  });
  children.flat().forEach((c) => {
    if (c === null || c === undefined || c === "") return;
    node.append(c instanceof Node ? c : String(c));
  });
  return node;
}
const small = (t, cls = "small") => el("div", { class: cls }, t);

const NOMBRE_PAGO = { mercadopago: "Mercado Pago", transferencia: "Transferencia", efectivo: "Efectivo" };

async function cargar() {
  token = $("token").value.trim();
  if (!token) { $("msg").textContent = "Ingresá la clave."; return; }
  $("msg").textContent = "Cargando…";
  try {
    const res = await fetch(`${API}?admin=1`, { headers: { "x-admin-token": token } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error");
    estados = data.estados;
    render(data.pedidos);
    $("msg").textContent = `${data.pedidos.length} pedidos`;
    $("tabla").hidden = false;
    $("refresh").hidden = false;
  } catch (e) {
    $("msg").textContent = e.message;
  }
}

function celdaPago(p) {
  const td = el("td", {}, NOMBRE_PAGO[p.pago] || p.pago);
  if (p.pagoMP) {
    const mp = p.pagoMP;
    td.append(small(`MP: ${mp.estado || "-"}${mp.id ? " · #" + mp.id : ""}`, mp.estado === "aprobado" ? "small ok-pago" : "small"));
    if (mp.medio) td.append(small(`${mp.medio}${mp.cuotas > 1 ? ` en ${mp.cuotas} cuotas` : ""}`));
    if (mp.alerta) td.append(small(mp.alerta, "small alerta"));
  }
  return td;
}

function render(pedidos) {
  const cuerpo = $("cuerpo");
  cuerpo.replaceChildren();
  pedidos.forEach((p) => {
    const select = el("select", { class: "estado" }, estados.map((e) => {
      const o = el("option", {}, e);
      if (e === p.estado) o.selected = true;
      return o;
    }));
    const trk = el("input", { class: "trk", placeholder: "Nº tracking" });
    trk.value = p.tracking || "";
    const btn = el("button", { class: "save", type: "button" }, "Guardar");
    const row = small("", "msg-row small");

    const tr = el("tr", {},
      el("td", {}, el("b", {}, p.id), small(new Date(p.creado).toLocaleString("es-AR"))),
      el("td", {}, p.nombre, small(p.telefono), small(p.email)),
      el("td", {}, `${p.producto} (${p.variante})`, small(`${money(p.total)} (envío ${money(p.envio)})`),
        p.cupon ? small(`Código ${p.cupon}: −${money(p.descuento)}`, "small ok-pago") : null),
      el("td", {}, p.entrega, p.comentarios ? small(`Nota: ${p.comentarios}`) : null),
      celdaPago(p),
      el("td", {}, select),
      el("td", {}, trk),
      el("td", {}, btn, row),
    );

    btn.addEventListener("click", async () => {
      if (select.value === "Despachado" && p.estado !== "Despachado" && !trk.value.trim() &&
          !confirm("¿Marcar como despachado sin número de seguimiento? El cliente recibe el mail de \"en camino\" sin el número.")) return;
      row.textContent = "Guardando…";
      try {
        const res = await fetch(API, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-admin-token": token },
          body: JSON.stringify({ id: p.id, estado: select.value, tracking: trk.value.trim() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error");
        p.estado = select.value;
        row.textContent = data.avisoCliente ? "Guardado ✓ · mail enviado al cliente" : "Guardado ✓";
      } catch (e) {
        row.textContent = e.message;
      }
    });
    cuerpo.appendChild(tr);
  });
}

$("load").addEventListener("click", cargar);
$("refresh").addEventListener("click", cargar);
$("token").addEventListener("keydown", (e) => { if (e.key === "Enter") cargar(); });
