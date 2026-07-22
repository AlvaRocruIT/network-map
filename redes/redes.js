document.addEventListener("DOMContentLoaded", cargarRed);

const SVG_NS = "http://www.w3.org/2000/svg";

async function cargarRed() {
  const contenedor = document.getElementById("redes");

  if (!contenedor) {
    throw new Error('No existe un elemento con id="redes".');
  }

  const respuesta = await fetch("data/organigrama.json");
  const personas = await respuesta.json();

  validarDatos(personas);

  const { ancho, alto } = obtenerDimensiones(contenedor);

  const nodos = prepararNodos(personas, ancho, alto);
  const conexiones = prepararConexiones(nodos);

  dibujarRed(contenedor, nodos, conexiones, ancho, alto);
}

function calcularLayout(personas, ancho, alto) {
  const modelo = construirModelo(personas);

  calcularTamanosDeRama(modelo.raiz);
  asignarSectores(modelo.raiz);
  asignarPosicionesIniciales(modelo, ancho, alto);
  ejecutarSimulacion(modelo, ancho, alto);

  return {
    nodos: modelo.nodos,
    conexiones: modelo.conexiones
  };
}

function dibujarRed(
  contenedor,
  nodos,
  conexiones,
  ancho,
  alto
) {
  contenedor.innerHTML = "";

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.classList.add("red-svg");

  svg.setAttribute(
    "viewBox",
    `0 0 ${ancho} ${alto}`
  );

  svg.setAttribute("role", "img");
  svg.setAttribute(
    "aria-label",
    "Mapa de relaciones organizacionales"
  );

  const capaConexiones =
    document.createElementNS(SVG_NS, "g");

  capaConexiones.classList.add("capa-conexiones");

  const capaNodos =
    document.createElementNS(SVG_NS, "g");

  capaNodos.classList.add("capa-nodos");

  svg.appendChild(capaConexiones);
  svg.appendChild(capaNodos);

  contenedor.appendChild(svg);

  dibujarConexiones(
    conexiones,
    capaConexiones
  );

  dibujarNodos(
    nodos,
    capaNodos
  );
}

function prepararNodos(personas, ancho, alto) {
  const centroX = ancho / 2;
  const centroY = alto / 2;

  const raiz = personas.find(
    persona => persona.reportaA === null
  );

  if (!raiz) {
    throw new Error("No se encontró una jerarquía principal.");
  }

  const dependientes = personas.filter(
    persona => persona.id !== raiz.id
  );

  const radio = 140;

  return personas.map(persona => {
    if (persona.id === raiz.id) {
      return {
        ...persona,
        x: centroX,
        y: centroY,
        fijo: true
      };
    }

    const indice = dependientes.findIndex(
      dependiente => dependiente.id === persona.id
    );

    const angulo =
      (indice / dependientes.length) *
      Math.PI *
      2;

    return {
      ...persona,
      x: centroX + Math.cos(angulo) * radio,
      y: centroY + Math.sin(angulo) * radio,
      fijo: false
    };
  });
}

function prepararConexiones(nodos) {
  const nodosPorId = new Map(
    nodos.map(nodo => [nodo.id, nodo])
  );

  return nodos
    .filter(nodo => nodo.reportaA)
    .map(nodo => ({
      source: nodosPorId.get(nodo.reportaA),
      target: nodo
    }))
    .filter(conexion => conexion.source);
}

function dibujarConexiones(conexiones, capa) {
  conexiones.forEach(conexion => {
    const linea = document.createElementNS(SVG_NS, "line");

    linea.classList.add("conexion-red");

    linea.setAttribute("x1", conexion.source.x);
    linea.setAttribute("y1", conexion.source.y);
    linea.setAttribute("x2", conexion.target.x);
    linea.setAttribute("y2", conexion.target.y);

    capa.appendChild(linea);
  });
}

function dibujarNodos(nodos, capa) {
  nodos.forEach(nodo => {
    const circulo = document.createElementNS(SVG_NS, "circle");

    circulo.classList.add("nodo-red");
    circulo.dataset.id = nodo.id;

    if (nodo.fijo) {
      circulo.dataset.raiz = "true";
    }

    circulo.setAttribute("cx", nodo.x);
    circulo.setAttribute("cy", nodo.y);
    circulo.setAttribute("r", nodo.fijo ? 7 : 5);

    capa.appendChild(circulo);
  });
}

function obtenerDimensiones(contenedor) {
  return {
    ancho: contenedor.clientWidth || 1000,
    alto: contenedor.clientHeight || 700
  };
}

function validarDatos(personas) {
  if (!Array.isArray(personas) || personas.length === 0) {
    throw new Error("El archivo no contiene personas.");
  }

  const ids = new Set();

  personas.forEach(persona => {
    if (!persona.id || !persona.nombre) {
      throw new Error("Cada persona necesita id y nombre.");
    }

    if (ids.has(persona.id)) {
      throw new Error(`ID duplicado: ${persona.id}`);
    }

    ids.add(persona.id);
  });

  personas.forEach(persona => {
    if (persona.reportaA && !ids.has(persona.reportaA)) {
      throw new Error(
        `${persona.nombre} reporta a un ID inexistente: ${persona.reportaA}`
      );
    }
  });

  const raices = personas.filter(
    persona => persona.reportaA === null
  );

  if (raices.length !== 1) {
    throw new Error(
      `Se esperaba una jerarquía principal, pero se encontraron ${raices.length}.`
    );
  }
}
