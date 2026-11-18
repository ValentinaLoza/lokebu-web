/*
  CONFIGURACIÓN ÚNICA DE LA TIENDA LOKEBU
  La usan el navegador (checkout) y el servidor (funciones de Netlify), así los
  precios y el envío que ve el cliente son exactamente los que se cobran.
  Si cambiás un precio, cambialo SOLO acá.
*/
(function (root) {
  const CONFIG = {
    whatsapp: "5491135941335",

    productos: {
      "1": { nombre: "1 LOKEBU", precio: 29990, unidades: 1 },
      "2": { nombre: "Pack x2 LOKEBU", precio: 49990, unidades: 2 },
    },

    variantes: ["iOS", "Android"],

    retiros: {
      "retiro-ituzaingo": "Retiro en Ituzaingó (Mansilla 928)",
      "retiro-luzuriaga": "Retiro en Villa Luzuriaga (Thames 689)",
    },

    // Correo Argentino PAQ.AR Clásico a domicilio, despachado desde Villa Luzuriaga.
    // Precios verificados en el panel de MiCorreo por zona.
    envio: {
      nombre: "Correo Argentino Clásico",
      plazo: "2 a 5 días hábiles",
      tarifas: { 1: 7755, 2: 8955, 3: 9750, 4: 9808 },
      // Zona por código de provincia (códigos de Correo Argentino).
      zonaPorProvincia: {
        A: 3, C: 1, D: 2, E: 2, F: 3, G: 3, H: 3, J: 3, K: 3, L: 2, M: 3, N: 3,
        P: 3, Q: 3, R: 3, S: 2, T: 3, U: 4, V: 4, W: 3, X: 2, Y: 4, Z: 4,
      },
    },

    provincias: {
      A: "Salta", B: "Buenos Aires", C: "CABA", D: "San Luis", E: "Entre Ríos",
      F: "La Rioja", G: "Santiago del Estero", H: "Chaco", J: "San Juan", K: "Catamarca",
      L: "La Pampa", M: "Mendoza", N: "Misiones", P: "Formosa", Q: "Neuquén",
      R: "Río Negro", S: "Santa Fe", T: "Tucumán", U: "Chubut", V: "Tierra del Fuego",
      W: "Corrientes", X: "Córdoba", Y: "Jujuy", Z: "Santa Cruz",
    },

    transferencia: {
      titular: "Valentina Miranda Loza",
      alias: "lokebu",
      banco: "Mercado Pago",
    },

    // Formas de pago. "efectivo" solo se ofrece con retiro en persona.
    pagos: ["mercadopago", "transferencia", "efectivo"],
  };

  // Zona de envío según provincia y CP. Buenos Aires se separa por código postal.
  CONFIG.zonaEnvio = function (provincia, cp) {
    if (provincia === "B") {
      const n = Number(cp);
      if (n >= 1600 && n <= 1999) return 1; // Conurbano
      if (n >= 8500) return 3;              // Sur de la provincia
      return 2;                             // Resto de la provincia
    }
    return CONFIG.envio.zonaPorProvincia[provincia] || null;
  };

  CONFIG.costoEnvio = function (provincia, cp) {
    const zona = CONFIG.zonaEnvio(provincia, cp);
    return zona ? { zona, precio: CONFIG.envio.tarifas[zona] } : null;
  };

  if (typeof module !== "undefined" && module.exports) module.exports = CONFIG;
  else root.LOKEBU = CONFIG;
})(typeof window !== "undefined" ? window : this);
