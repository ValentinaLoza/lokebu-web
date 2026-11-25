/*
  Genera los videos de TikTok de LOKEBU (1080x1920, 30 cuadros por segundo, MP4 H.264).

  Uso (desde la carpeta del proyecto):
    node marketing/tiktok/generar.js                 -> todos los videos
    node marketing/tiktok/generar.js fina precio     -> solo esos

  Requiere Playwright (con Chromium) y ffmpeg instalados.
  Los videos salen sin música: el sonido se elige en TikTok al publicar (así usás audios en tendencia sin problemas de derechos).
*/
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const { chromium } = require("playwright");

const FPS = 30;
const VIDEOS = ["fina", "billetera", "tres-usos", "iphone-android", "viaje", "precio"];
const plantilla = "file://" + path.join(__dirname, "plantilla.html");
const salida = path.join(__dirname, "salida");

async function generar(browser, nombre) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto(`${plantilla}?v=${nombre}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("networkidle");
  const duracion = await page.evaluate(() => window.__duracion);
  const cuadros = Math.round(duracion * FPS);

  const archivo = path.join(salida, `lokebu-${nombre}.mp4`);
  const ff = spawn("ffmpeg", [
    "-y", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
    "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
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
  const lista = pedidos.length ? pedidos : VIDEOS;
  fs.mkdirSync(salida, { recursive: true });
  const browser = await chromium.launch();
  for (const v of lista) await generar(browser, v);
  await browser.close();
})();
