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
const CRF_CINE = "24"; // el grano pesa mucho: un poco más de compresión mantiene el look con archivos livianos
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
};
const salida = path.join(__dirname, "salida");

async function generar(browser, nombre) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const conf = VIDEOS[nombre];
  if (!conf) throw new Error(`No existe el video "${nombre}". Opciones: ${Object.keys(VIDEOS).join(", ")}`);
  await page.goto("file://" + path.join(__dirname, conf.plantilla) + `?v=${nombre}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("networkidle");
  const duracion = await page.evaluate(() => window.__duracion);
  const cuadros = Math.round(duracion * FPS);

  const archivo = path.join(salida, `lokebu-${nombre}.mp4`);
  const ff = spawn("ffmpeg", [
    "-y", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
    ...(conf.filtro ? ["-vf", conf.filtro] : []),
    "-c:v", "libx264", "-preset", "medium", "-crf", conf.filtro ? CRF_CINE : "19", "-pix_fmt", "yuv420p",
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
    : pedidos[0] === "publicidad" ? todos.filter((v) => !v.startsWith("cine-"))
    : pedidos;
  fs.mkdirSync(salida, { recursive: true });
  const browser = await chromium.launch();
  for (const v of lista) await generar(browser, v);
  await browser.close();
})();
