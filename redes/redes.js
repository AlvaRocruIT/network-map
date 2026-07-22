document.addEventListener("DOMContentLoaded", cargarRed);

const SVG_NS = "http://www.w3.org/2000/svg";

async function cargarRed() {
  const contenedor = document.getElementById("redes");

  if (!contenedor) {
    throw new Error('No existe un elemento con id="redes".');
  }

  const respuesta = await fetch("../data/organigrama.json");
  const personas = await respuesta.json();

  validarDatos(personas);

  const { ancho, alto } = obtenerDimensiones(contenedor);

  const { nodos, conexiones } =
  calcularLayout(personas, ancho, alto);

  dibujarRed(contenedor, nodos, conexiones, ancho, alto);
}

function calcularLayout(personas, ancho, alto) {
  const nodos = personas.map(persona => ({
    ...persona,
    hijos: [],
    tamanoRama: 1,
    profundidad: 0,
    anguloInicio: 0,
    anguloFin: Math.PI * 2,
    x: 0,
    y: 0,
    fijo: false
  }));

  const nodosPorId = new Map(
    nodos.map(nodo => [nodo.id, nodo])
  );

  const raiz = nodos.find(
    nodo => nodo.reportaA === null
  );

  if (!raiz) {
    throw new Error(
      "No se encontró una jerarquía principal."
    );
  }

  nodos.forEach(nodo => {
    if (!nodo.reportaA) {
      return;
    }

    const superior =
      nodosPorId.get(nodo.reportaA);

    if (superior) {
      superior.hijos.push(nodo);
    }
  });

  asignarProfundidades(raiz, 0);
  calcularTamanoRama(raiz);

  asignarSectores(
    raiz,
    0,
    Math.PI * 2
  );

  asignarPosiciones(
    nodos,
    raiz,
    ancho,
    alto
  );

  const conexiones = nodos
    .filter(nodo => nodo.reportaA)
    .map(nodo => ({
      source: nodosPorId.get(nodo.reportaA),
      target: nodo
    }))
    .filter(conexion => conexion.source);

  return {
    nodos,
    conexiones
  };
}

function asignarProfundidades(
  nodo,
  profundidad
) {
  nodo.profundidad = profundidad;

  nodo.hijos.forEach(hijo => {
    asignarProfundidades(
      hijo,
      profundidad + 1
    );
  });
}

function calcularTamanoRama(nodo) {
  nodo.tamanoRama = 1;

  nodo.hijos.forEach(hijo => {
    nodo.tamanoRama +=
      calcularTamanoRama(hijo);
  });

  return nodo.tamanoRama;
}

function asignarSectores(
  nodo,
  anguloInicio,
  anguloFin
) {
  nodo.anguloInicio = anguloInicio;
  nodo.anguloFin = anguloFin;

  if (nodo.hijos.length === 0) {
    return;
  }

  const totalDescendientes =
    nodo.hijos.reduce(
      (total, hijo) =>
        total + hijo.tamanoRama,
      0
    );

  let anguloActual = anguloInicio;

  nodo.hijos.forEach(hijo => {
    const proporcion =
      hijo.tamanoRama /
      totalDescendientes;

    const amplitud =
      (anguloFin - anguloInicio) *
      proporcion;

    asignarSectores(
      hijo,
      anguloActual,
      anguloActual + amplitud
    );

    anguloActual += amplitud;
  });
}

function asignarPosiciones(
  nodos,
  raiz,
  ancho,
  alto
) {
  const centroX = ancho / 2;
  const centroY = alto / 2;

  const profundidadMaxima =
    Math.max(
      ...nodos.map(
        nodo => nodo.profundidad
      ),
      1
    );

  const radioMaximo =
    Math.min(ancho, alto) * 0.42;

  raiz.x = centroX;
  raiz.y = centroY;
  raiz.fijo = true;

  nodos.forEach(nodo => {
    if (nodo === raiz) {
      return;
    }

    const angulo =
      (
        nodo.anguloInicio +
        nodo.anguloFin
      ) / 2;

    const radio =
      (
        nodo.profundidad /
        profundidadMaxima
      ) * radioMaximo;

    nodo.x =
      centroX +
      Math.cos(angulo) * radio;

    nodo.y =
      centroY +
      Math.sin(angulo) * radio;
  });
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
