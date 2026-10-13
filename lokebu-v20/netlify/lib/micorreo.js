/*
  Cliente mínimo de la API MiCorreo (Correo Argentino).
  Las credenciales NUNCA van al navegador: se leen de variables de entorno de Netlify.
*/
const BASE = process.env.MICORREO_BASE_URL || "https://apitest.correoargentino.com.ar/micorreo/v1";

let cachedToken = null;
let cachedExpMs = 0;

function parseExpires(str) {
  // La API devuelve "YYYY-MM-DD HH:mm:ss". Asumimos hora de Argentina (UTC-03).
  const ms = Date.parse(String(str).replace(" ", "T") + "-03:00");
  return isNaN(ms) ? Date.now() + 10 * 60 * 1000 : ms;
}

async function getToken(force = false) {
  if (!force && cachedToken && Date.now() < cachedExpMs - 60 * 1000) return cachedToken;

  const user = process.env.MICORREO_USER;
  const pass = process.env.MICORREO_PASSWORD;
  if (!user || !pass) throw new Error("Faltan MICORREO_USER / MICORREO_PASSWORD");

  const res = await fetch(`${BASE}/token`, {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(`${user}:${pass}`).toString("base64") },
  });
  if (!res.ok) throw new Error(`Token MiCorreo: HTTP ${res.status}`);

  const data = await res.json();
  cachedToken = data.token;
  cachedExpMs = parseExpires(data.expires);
  return cachedToken;
}

async function api(path, { method = "POST", body } = {}) {
  let token = await getToken();
  const doRequest = (tk) =>
    fetch(`${BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });

  let res = await doRequest(token);
  if (res.status === 401) {
    // Token vencido: se pide uno nuevo y se reintenta una vez.
    token = await getToken(true);
    res = await doRequest(token);
  }

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }

  if (!res.ok) {
    const err = new Error(json.message || `MiCorreo HTTP ${res.status}`);
    err.status = res.status;
    err.detail = json;
    throw err;
  }
  return json;
}

module.exports = { api };
