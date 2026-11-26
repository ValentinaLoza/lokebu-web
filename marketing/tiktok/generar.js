/*
  Genera los videos de TikTok de LOKEBU (1080x1920, 30 cuadros por segundo, MP4 H.264).

  Uso (desde la carpeta del proyecto):
    node marketing/tiktok/generar.js                 -> todos los videos
    node marketing/tiktok/generar.js fina precio     -> solo esos
    node marketing/tiktok/generar.js cine            -> solo los cinematográficos

  Requiere Playwright (con Chromium) y ffmpeg instalados.
  Los videos salen sin música: el sonido se elige en TikTok al publicar (así usás audios en tendencia sin problemas de derechos).
*/
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const { chromium } = require("playwright");

const FPS = 30;
// Tratamiento de cine: color cálido y apagado, viñeta y grano de película.
const CINE = "eq=contrast=1.07:saturation=0.86:gamma=0.97,colorbalance=rs=0.035:gs=0.01:bs=-0.035:rh=0.03:bh=-0.04,vignette=angle=PI/4.6,noise=alls=6:allf=t+u";
const CRF_CINE = "24";
// Historias ilustradas: grano y viñeta suaves, para que se sienta de cine sin ensuciar el dibujo.
// Stock real: color cálido y parejo entre clips de distintos rodajes, viñeta y grano muy suave.
const STOCK = "eq=contrast=1.05:saturation=0.9:gamma=0.98,colorbalance=rs=0.03:bs=-0.03:rh=0.02:bh=-0.03,vignette=angle=PI/5,noise=alls=3:allf=t+u";
const HISTORIA = "eq=contrast=1.04:saturation=0.95,vignette=angle=PI/5,noise=alls=4:allf=t+u"; // el grano pesa mucho: un poco más de compresión mantiene el look con archivos livianos
const VIDEOS = {
  // Publicidad (plantilla.html)
  "fina": { plantilla: "plantilla.html" },
  "billetera": { plantilla: "plantilla.html" },
  "tres-usos": { plantilla: "plantilla.html" },
  "iphone-android": { plantilla: "plantilla.html" },
  "viaje": { plantilla: "plantilla.html" },
  "precio": { plantilla: "plantilla.html" },
  // Cinematográficos (cine.html)
  "cine-objeto": { plantilla: "cine.html", filtro: CINE },
  "cine-dia": { plantilla: "cine.html", filtro: CINE },
  "cine-viaje": { plantilla: "cine.html", filtro: CINE },
  // Historias actuadas (historias.html)
  "historia-cafe": { plantilla: "historias.html", filtro: HISTORIA },
  "historia-valija": { plantilla: "historias.html", filtro: HISTORIA },
  // Historias con clips reales de stock (historias-stock.html). Antes: bash marketing/tiktok/stock.sh
  "stock-cafe": { plantilla: "historias-stock.html", filtro: STOCK, liviano: true },
  "stock-valija": { plantilla: "historias-stock.html", filtro: STOCK, liviano: true },
  // Alto ritmo, estética nativa de TikTok (ritmo.html). Usa clips de stock.sh
  "ritmo-grosor": { plantilla: "ritmo.html", liviano: true },
  "ritmo-pov": { plantilla: "ritmo.html", liviano: true },
  "ritmo-codigo": { plantilla: "ritmo.html", liviano: true },
  "ritmo-resena": { plantilla: "ritmo.html", liviano: true },
  "ritmo-razones": { plantilla: "ritmo.html", liviano: true },
  "ritmo-necesitabas": { plantilla: "ritmo.html", liviano: true },
};
const salida = path.join(__dirname, "salida");

async function generar(browser, nombre) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const conf = VIDEOS[nombre];
  if (!conf) throw new Error(`No existe el video "${nombre}". Opciones: ${Object.keys(VIDEOS).join(", ")}`);
  await page.goto("file://" + path.join(__dirname, conf.plantilla) + `?v=${nombre}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => (window.__listo ? window.__listo() : 0)); // clips de video cargados
  const duracion = await page.evaluate(() => window.__duracion);
  const cuadros = Math.round(duracion * FPS);

  const archivo = path.join(salida, `lokebu-${nombre}.mp4`);
  const ff = spawn("ffmpeg", [
    "-y", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
    ...(conf.filtro ? ["-vf", conf.filtro] : []),
    "-c:v", "libx264", "-preset", "medium", "-crf", conf.filtro ? CRF_CINE : "19", "-pix_fmt", "yuv420p",
    // "liviano": tope de bitrate para que el archivo quede por debajo de ~3 MB (límite de subida a Drive)
    ...(conf.liviano ? ["-maxrate", "950k", "-bufsize", "1900k"] : []),
    "-movflags", "+faststart", archivo,
  ]);
  const termino = new Promise((ok, mal) => ff.on("close", (c) => (c === 0 ? ok() : mal(new Error(`ffmpeg salió con ${c}`)))));

  for (let i = 0; i < cuadros; i++) {
    await page.evaluate((t) => window.__tiempo(t), i / FPS);
    const img = await page.screenshot({ type: "jpeg", quality: 92 });
    if (!ff.stdin.write(img)) await new Promise((r) => ff.stdin.once("drain", r));
  }
  ff.stdin.end();
  await termino;
  await page.close();
  console.log(`✓ ${path.relative(process.cwd(), archivo)}  (${duracion} s)`);
}

(async () => {
  const pedidos = process.argv.slice(2);
  // Sin argumentos: todos. "cine" o "publicidad": esa tanda.
  const todos = Object.keys(VIDEOS);
  const lista = !pedidos.length ? todos
    : pedidos[0] === "cine" ? todos.filter((v) => v.startsWith("cine-"))
    : pedidos[0] === "historias" ? todos.filter((v) => v.startsWith("historia-"))
    : pedidos[0] === "stock" ? todos.filter((v) => v.startsWith("stock-"))
    : pedidos[0] === "ritmo" ? todos.filter((v) => v.startsWith("ritmo-"))
    : pedidos[0] === "publicidad" ? todos.filter((v) => !/^(cine|historia|stock|ritmo)-/.test(v))
    : pedidos;
  fs.mkdirSync(salida, { recursive: true });
  const browser = await chromium.launch();
  for (const v of lista) await generar(browser, v);
  await browser.close();
})();
