document.addEventListener("DOMContentLoaded", cargarRed);

const SVG_NS = "http://www.w3.org/2000/svg";

const CONFIG_LAYOUT = {
    margenExterior: 100,

    cluster: {
        radioMinimo: 160,
        padding: 80,
        separacionGrid: 140
    },

    ubicacion: {
        radioBase: 45,
        factorCrecimiento: 24,
        separacion: 30
    },

    arbol: {
        radioBase: 28,
        factorCrecimiento: 18,
        distanciaNivel: 55
    }
};

async function cargarRed() {
  const contenedor =
    document.getElementById("redes");

  if (!contenedor) {
    console.error(
      'No existe un elemento con id="redes".'
    );
    return;
  }

  try {
  const respuesta = await fetch("../data/organigrama.json");
  if (!respuesta.ok) {
      throw new Error(
        `No se pudo cargar el JSON: ${respuesta.status}`
      );
    }

    const personas =
      await respuesta.json();

    validarDatos(personas);

    const dimensionesBase =
      obtenerDimensiones(contenedor);

    const layout = calcularLayout(
      personas,
      dimensionesBase.ancho,
      dimensionesBase.alto
    );

    console.table(
      layout.clusters.map(cluster => ({
        cluster: cluster.nombre,
        personas: cluster.personas.length,
        ubicaciones: cluster.ubicaciones.length,
        radio: Math.round(cluster.radio),
        x: Math.round(cluster.centroX),
        y: Math.round(cluster.centroY)
      }))
    );

    dibujarRed(
      contenedor,
      layout.nodos,
      layout.conexiones,
      layout.ancho,
      layout.alto
    );
  } catch (error) {
    console.error("Error al cargar la red:", error);

    contenedor.textContent =
      `No fue posible cargar la red: ${error.message}`;
  }
}

function calcularLayout(personas, anchoMinimo, altoMinimo) {
    const personasPorId = new Map(
        personas.map(persona => [
            persona.id,
            {
                ...persona,
                tipoVinculo:
                    persona.tipoVinculo ?? "dependencia",
                x: 0,
                y: 0
            }
        ])
    );

   const personasArray =
    Array.from(personasPorId.values());

const nodoRaiz =
    personasArray.find(
        persona => persona.reportaA === null
    );

if (!nodoRaiz) {
    throw new Error(
        "No se encontró el nodo raíz."
    );
}

nodoRaiz.fijo = true;

const clusters =
    agruparPorClusterYUbicacion(
        personasArray
    );

const clusterRaiz =
    clusters.find(
        cluster =>
            cluster.nombre === nodoRaiz.cluster
    );

    calcularDimensionesInternas(clusters);
    calcularCentroClusterRaiz(
    clusterRaiz,
    anchoMinimo,
    altoMinimo
    );
    
    const nodos =
        Array.from(personasPorId.values());

    const conexiones =
        crearConexiones(personasPorId);

    return {
        clusters,
        nodos,
        conexiones,
        ancho: anchoMinimo,
        alto: altoMinimo
    };
}

function agruparPorClusterYUbicacion(personas) {
    const clustersPorNombre = new Map();

    personas.forEach(persona => {
        const nombreCluster =
            normalizarAgrupacion(
                persona.cluster,
                "Sin cluster"
            );

        const nombreUbicacion =
            normalizarAgrupacion(
                persona.ubicacion,
                "Sin ubicación"
            );

        if (!clustersPorNombre.has(nombreCluster)) {
            clustersPorNombre.set(nombreCluster, {
                id: nombreCluster,
                nombre: nombreCluster,
                ubicacionesPorNombre: new Map(),
                ubicaciones: [],
                personas: [],
                centroX: 0,
                centroY: 0,
                radio: 0
            });
        }

        const cluster =
            clustersPorNombre.get(nombreCluster);

        if (
            !cluster.ubicacionesPorNombre.has(
                nombreUbicacion
            )
        ) {
            cluster.ubicacionesPorNombre.set(
                nombreUbicacion,
                {
                    id: `${nombreCluster}-${nombreUbicacion}`,
                    nombre: nombreUbicacion,
                    cluster: nombreCluster,
                    personas: [],
                    centroX: 0,
                    centroY: 0,
                    radio: 0
                }
            );
        }

        const ubicacion =
            cluster.ubicacionesPorNombre.get(
                nombreUbicacion
            );

        cluster.personas.push(persona);
        ubicacion.personas.push(persona);
    });

    const clusters =
        Array.from(clustersPorNombre.values());

    clusters.forEach(cluster => {
        cluster.ubicaciones =
            Array.from(
                cluster.ubicacionesPorNombre.values()
            );

        delete cluster.ubicacionesPorNombre;
    });

    return clusters;
}

function normalizarAgrupacion(valor, fallback) {
    if (
        typeof valor !== "string" ||
        valor.trim() === ""
    ) {
        return fallback;
    }

    return valor.trim();
}

function calcularDimensionesInternas(clusters) {
    clusters.forEach(cluster => {
        cluster.ubicaciones.forEach(ubicacion => {
            ubicacion.radio =
                calcularRadioUbicacion(
                    ubicacion.personas.length
                );
        });

        cluster.radio =
            calcularRadioCluster(
                cluster.ubicaciones
            );
    });
}

function calcularRadioUbicacion(cantidadPersonas) {
    const { radioBase, factorCrecimiento } =
        CONFIG_LAYOUT.ubicacion;

    return (
        radioBase +
        Math.sqrt(
            Math.max(cantidadPersonas, 1)
        ) * factorCrecimiento
    );
}

function calcularRadioCluster(ubicaciones) {
    const { radioMinimo, padding } =
        CONFIG_LAYOUT.cluster;

    if (ubicaciones.length === 1) {
        return Math.max(
            radioMinimo,
            ubicaciones[0].radio + padding
        );
    }

    const superficieCombinada =
        ubicaciones.reduce(
            (total, ubicacion) =>
                total +
                Math.pow(ubicacion.radio, 2),
            0
        );

    const radioCalculado =
        Math.sqrt(superficieCombinada) *
        1.45 +
        padding;

    return Math.max(
        radioMinimo,
        radioCalculado
    );
}

function calcularCentroClusterRaiz(
    clusterRaiz,
    ancho,
    alto
) {
    if (!clusterRaiz) {
        throw new Error(
            "No se encontró el cluster raíz."
        );
    }

    clusterRaiz.centroX = ancho / 2;
    clusterRaiz.centroY = alto / 2;

    return clusterRaiz;
}

function crearConexiones(personasPorId) {
    const conexiones = [];

    personasPorId.forEach(persona => {
        if (!persona.reportaA) {
            return;
        }

        const superior =
            personasPorId.get(
                persona.reportaA
            );

        if (!superior) {
            console.warn(
                `No se encontró el superior "${persona.reportaA}" de "${persona.id}".`
            );

            return;
        }

        conexiones.push({
            origen: superior,
            destino: persona,
            tipoVinculo:
                persona.tipoVinculo ??
                "dependencia",

            esInterCluster:
                superior.cluster !==
                persona.cluster,

            esInterUbicacion:
                superior.cluster ===
                    persona.cluster &&
                superior.ubicacion !==
                    persona.ubicacion
        });
    });

    return conexiones;
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

  const etiqueta = crearEtiquetaNodo(contenedor);
      
  dibujarConexiones(
    capaConexiones,
    conexiones
  );

  dibujarNodos(
  nodos,
  capaNodos,
  contenedor,
  etiqueta
);

    svg.addEventListener("click", evento => {
  if (evento.target === svg) {
    etiqueta.hidden = true;
  }
});
}

  function dibujarConexiones(
    capaConexiones,
    conexiones
) {
    conexiones.forEach(conexion => {
        const linea =
            document.createElementNS(
                "http://www.w3.org/2000/svg",
                "line"
            );

        linea.setAttribute(
            "x1",
            conexion.origen.x
        );

        linea.setAttribute(
            "y1",
            conexion.origen.y
        );

        linea.setAttribute(
            "x2",
            conexion.destino.x
        );

        linea.setAttribute(
            "y2",
            conexion.destino.y
        );

        linea.classList.add(
            "conexion",
            `conexion-${conexion.tipoVinculo}`
        );

        if (conexion.esInterCluster) {
            linea.classList.add(
                "conexion-intercluster"
            );
        } else if (
            conexion.esInterUbicacion
        ) {
            linea.classList.add(
                "conexion-interubicacion"
            );
        } else {
            linea.classList.add(
                "conexion-interna"
            );
        }

        capaConexiones.appendChild(linea);
    });
}
  
 function dibujarNodos(
  nodos,
  capa,
  contenedor,
  etiqueta
  ) {
  nodos.forEach(nodo => {
    const circulo =
      document.createElementNS(SVG_NS, "circle");

    circulo.classList.add("nodo-red");
    circulo.dataset.id = nodo.id;

    if (nodo.fijo) {
      circulo.dataset.raiz = "true";
    }

    circulo.setAttribute("cx", nodo.x);
    circulo.setAttribute("cy", nodo.y);
    circulo.setAttribute("r", nodo.fijo ? 7 : 5);

    circulo.addEventListener("click", evento => {
      evento.stopPropagation();

      mostrarEtiquetaNodo(
        nodo,
        circulo,
        contenedor,
        etiqueta
      );
    });

    capa.appendChild(circulo);
  });
}

function crearEtiquetaNodo(contenedor) {
  const etiqueta = document.createElement("div");

  etiqueta.classList.add("etiqueta-nodo");
  etiqueta.hidden = true;

  contenedor.appendChild(etiqueta);

  return etiqueta;
}

function mostrarEtiquetaNodo(
  nodo,
  circulo,
  contenedor,
  etiqueta
) {
  etiqueta.innerHTML = `
    <strong>${nodo.nombre}</strong>
    <span>${nodo.cargo ?? ""}</span>
    <small>${nodo.equipo ?? ""}</small>
  `;

  etiqueta.hidden = false;

  const rectNodo =
    circulo.getBoundingClientRect();

  const rectContenedor =
    contenedor.getBoundingClientRect();

  etiqueta.style.left = `${
    rectNodo.left -
    rectContenedor.left +
    rectNodo.width / 2
  }px`;

  etiqueta.style.top = `${
    rectNodo.top -
    rectContenedor.top -
    8
  }px`;
 }

function obtenerDimensiones(contenedor) {
    return {
        ancho: contenedor.clientWidth,
        alto: contenedor.clientHeight
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

