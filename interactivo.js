/* LOKEBU: tarjeta 3D, demo "Probala acá" y barra fija de compra en el celular. */
(function () {
  const reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ================= Tarjeta 3D ================= */
  (function tarjeta() {
    const stage = document.getElementById("hero-stage");
    const card = document.getElementById("card3d");
    const hint = document.getElementById("stage-hint");
    if (!stage || !card) return;
    const body = card.querySelector(".card3d-body");

    let rotY = -18;      // giro actual (grados)
    let rotX = 6;
    let base = 0;        // 0 = frente, 180 = dorso
    let perfil = false;  // vista de perfil para mostrar el grosor
    let arrastrando = false;
    let inicioX = 0, inicioY = 0, rotInicio = 0, movido = 0;

    function pintar(animado) {
      body.classList.toggle("is-animated", !!animado);
      body.style.setProperty("--ry", rotY + "deg");
      body.style.setProperty("--rx", rotX + "deg");
      // El brillo acompaña el giro.
      const brillo = ((((rotY % 360) + 360) % 360) / 360) * 200 - 50;
      body.style.setProperty("--shine", brillo + "%");
    }

    function ocultarAyuda() {
      if (hint) hint.classList.add("is-done");
    }

    function setPerfil(valor) {
      perfil = valor;
      stage.classList.toggle("is-perfil", perfil);
      card.setAttribute("aria-pressed", String(perfil));
      rotY = perfil ? base + 76 : base - 18;
      rotX = perfil ? 0 : 6;
      pintar(true);
    }

    card.addEventListener("pointerdown", (e) => {
      arrastrando = true;
      movido = 0;
      inicioX = e.clientX;
      inicioY = e.clientY;
      rotInicio = rotY;
      stage.classList.add("is-dragging");
      card.setPointerCapture(e.pointerId);
    });

    card.addEventListener("pointermove", (e) => {
      if (!arrastrando) return;
      const dx = e.clientX - inicioX;
      const dy = e.clientY - inicioY;
      movido = Math.max(movido, Math.abs(dx), Math.abs(dy));
      rotY = rotInicio + dx * 0.6;
      rotX = Math.max(-20, Math.min(20, 6 - dy * 0.2));
      if (perfil && Math.abs(dx) > 8) {
        perfil = false;
        stage.classList.remove("is-perfil");
        card.setAttribute("aria-pressed", "false");
      }
      pintar(false);
    });

    function soltar() {
      if (!arrastrando) return;
      arrastrando = false;
      stage.classList.remove("is-dragging");
      if (movido < 6) {
        // Toque: alterna la vista de perfil (muestra los 1,8 mm).
        setPerfil(!perfil);
      } else {
        // Arrastre: se acomoda de frente o de dorso, lo que quede más cerca.
        base = Math.round(rotY / 180) * 180;
        rotY = base - 18;
        rotX = 6;
        pintar(true);
      }
      ocultarAyuda();
    }
    card.addEventListener("pointerup", soltar);
    card.addEventListener("pointercancel", () => {
      // El navegador tomó el gesto para hacer scroll: volver a la posición.
      arrastrando = false;
      stage.classList.remove("is-dragging");
      base = Math.round(rotY / 180) * 180;
      rotY = base - 18;
      pintar(true);
    });

    // Teclado: el botón ya responde a Enter y Espacio con "click".
    card.addEventListener("click", (e) => {
      if (e.detail === 0) {
        setPerfil(!perfil);
        ocultarAyuda();
      }
    });

    // En compu: la tarjeta sigue suavemente al mouse.
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches && !reducir) {
      stage.addEventListener("mousemove", (e) => {
        if (arrastrando || perfil) return;
        const r = stage.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        rotY = base - 18 + px * 30;
        rotX = 6 - py * 16;
        pintar(false);
      });
      stage.addEventListener("mouseleave", () => {
        if (arrastrando || perfil) return;
        rotY = base - 18;
        rotX = 6;
        pintar(true);
      });
    }

    // Al aparecer por primera vez, un giro corto que invita a tocarla.
    pintar(false);
    if (!reducir && "IntersectionObserver" in window) {
      const obs = new IntersectionObserver((entradas) => {
        if (!entradas[0].isIntersecting) return;
        obs.disconnect();
        setTimeout(() => {
          if (arrastrando || perfil) return;
          rotY = base + 200;
          pintar(true);
          setTimeout(() => {
            if (arrastrando || perfil) return;
            base = 360;
            rotY = base - 18;
            pintar(true);
          }, 900);
        }, 700);
      }, { threshold: 0.6 });
      obs.observe(stage);
    }
  })();

  /* ================= Demo "Probala acá" ================= */
  (function buscador() {
    const pantalla = document.getElementById("finder-screen");
    const go = document.getElementById("finder-go");
    if (!pantalla || !go) return;
    const pin = document.getElementById("finder-pin");
    const titulo = document.getElementById("finder-title");
    const sub = document.getElementById("finder-sub");
    const tabs = Array.from(document.querySelectorAll(".finder-tab"));

    const ITEMS = {
      billetera: { nombre: "Billetera", lugar: "Café de la esquina", dist: "a 350 m", hace: "hace 2 min", x: 72, y: 30 },
      mochila: { nombre: "Mochila", lugar: "Gimnasio", dist: "a 1,2 km", hace: "hace 8 min", x: 24, y: 70 },
      valija: { nombre: "Valija", lugar: "Aeropuerto", dist: "a 18 km", hace: "hace 25 min", x: 80, y: 78 },
    };
    let actual = "billetera";
    let timer = null;

    function estado(e) {
      pantalla.dataset.state = e;
    }

    function buscar() {
      const it = ITEMS[actual];
      clearTimeout(timer);
      pin.style.setProperty("--x", it.x + "%");
      pin.style.setProperty("--y", it.y + "%");
      estado("searching");
      titulo.textContent = "Buscando tu LOKEBU…";
      sub.textContent = it.nombre;
      go.disabled = true;
      timer = setTimeout(() => {
        estado("found");
        titulo.textContent = `${it.nombre} · ${it.lugar}`;
        sub.textContent = `Última ubicación ${it.hace} · ${it.dist}`;
        go.disabled = false;
        go.textContent = "Buscar de nuevo";
      }, reducir ? 50 : 1500);
    }

    tabs.forEach((t) =>
      t.addEventListener("click", () => {
        actual = t.dataset.item;
        tabs.forEach((o) => o.setAttribute("aria-pressed", String(o === t)));
        buscar();
      })
    );
    go.addEventListener("click", buscar);

    // Se busca sola la primera vez que la demo aparece en pantalla.
    if ("IntersectionObserver" in window) {
      const obs = new IntersectionObserver((entradas) => {
        if (!entradas[0].isIntersecting) return;
        obs.disconnect();
        setTimeout(buscar, 400);
      }, { threshold: 0.4 });
      obs.observe(pantalla);
    }
  })();

  /* ================= Barra fija de compra (celular) ================= */
  (function barra() {
    const bar = document.getElementById("buybar");
    const cta = document.getElementById("hero-cta");
    if (!bar || !cta || !("IntersectionObserver" in window)) return;
    // No tapar el botón principal, los precios, la demo ni el pie.
    const ocultan = [cta, document.getElementById("precios"), document.getElementById("finder-screen"), document.querySelector("footer")].filter(Boolean);
    const visibles = new Set();

    const obs = new IntersectionObserver((entradas) => {
      entradas.forEach((en) => (en.isIntersecting ? visibles.add(en.target) : visibles.delete(en.target)));
      // Se muestra cuando el botón principal ya pasó y no estás viendo los precios ni el pie.
      const pasoElCta = cta.getBoundingClientRect().bottom < 0;
      const mostrar = pasoElCta && visibles.size === 0;
      bar.classList.toggle("is-visible", mostrar);
      bar.setAttribute("aria-hidden", String(!mostrar));
      bar.querySelector("a").tabIndex = mostrar ? 0 : -1;
      document.body.classList.toggle("has-buybar", mostrar);
    });
    ocultan.forEach((el) => obs.observe(el));
  })();
})();
