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

const dimensionesBase =
    obtenerDimensiones(contenedor);

const layout = calcularLayout(
    personas,
    dimensionesBase.ancho,
    dimensionesBase.alto
);

dibujarRed(
    contenedor,
    layout.nodos,
    layout.conexiones,
    layout.ancho,
    layout.alto
);

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

    const clusters = agruparPorClusterYUbicacion(
        Array.from(personasPorId.values())
    );

    calcularDimensionesInternas(clusters);

    const dimensiones = asignarCentrosClusters(
        clusters,
        anchoMinimo,
        altoMinimo
    );

    clusters.forEach(cluster => {
        asignarCentrosUbicaciones(cluster);

        cluster.ubicaciones.forEach(ubicacion => {
            posicionarUbicacion(
                ubicacion,
                personasPorId
            );
        });
    });

    const nodos =
        Array.from(personasPorId.values());

    const conexiones =
        crearConexiones(personasPorId);

    return {
        clusters,
        nodos,
        conexiones,
        ancho: dimensiones.ancho,
        alto: dimensiones.alto
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

function asignarCentrosClusters(
    clusters,
    anchoMinimo,
    altoMinimo
) {
    if (clusters.length === 0) {
        return {
            ancho: anchoMinimo,
            alto: altoMinimo
        };
    }

    const margen =
        CONFIG_LAYOUT.margenExterior;

    const separacion =
        CONFIG_LAYOUT.cluster.separacionGrid;

    const radioMaximo =
        Math.max(
            ...clusters.map(
                cluster => cluster.radio
            )
        );

    const tamanoCelda =
        radioMaximo * 2 + separacion;

    const columnas =
        Math.ceil(
            Math.sqrt(clusters.length)
        );

    const filas =
        Math.ceil(
            clusters.length / columnas
        );

    const anchoCalculado =
        margen * 2 +
        columnas * tamanoCelda;

    const altoCalculado =
        margen * 2 +
        filas * tamanoCelda;

    const ancho =
        Math.max(
            anchoMinimo,
            anchoCalculado
        );

    const alto =
        Math.max(
            altoMinimo,
            altoCalculado
        );

    const anchoGrid =
        columnas * tamanoCelda;

    const altoGrid =
        filas * tamanoCelda;

    const inicioX =
        (ancho - anchoGrid) / 2;

    const inicioY =
        (alto - altoGrid) / 2;

    clusters.forEach((cluster, indice) => {
        const columna =
            indice % columnas;

        const fila =
            Math.floor(indice / columnas);

        cluster.centroX =
            inicioX +
            columna * tamanoCelda +
            tamanoCelda / 2;

        cluster.centroY =
            inicioY +
            fila * tamanoCelda +
            tamanoCelda / 2;
    });

    return {
        ancho,
        alto
    };
}

function asignarCentrosUbicaciones(cluster) {
    const ubicaciones =
        cluster.ubicaciones;

    if (ubicaciones.length === 0) {
        return;
    }

    if (ubicaciones.length === 1) {
        ubicaciones[0].centroX =
            cluster.centroX;

        ubicaciones[0].centroY =
            cluster.centroY;

        return;
    }

    const radioUbicacionMaximo =
        Math.max(
            ...ubicaciones.map(
                ubicacion => ubicacion.radio
            )
        );

    const radioOrbita =
        Math.max(
            30,
            cluster.radio -
            radioUbicacionMaximo -
            CONFIG_LAYOUT.ubicacion.separacion
        );

    ubicaciones.forEach(
        (ubicacion, indice) => {
            const angulo =
                -Math.PI / 2 +
                (
                    indice /
                    ubicaciones.length
                ) *
                Math.PI *
                2;

            ubicacion.centroX =
                cluster.centroX +
                Math.cos(angulo) *
                radioOrbita;

            ubicacion.centroY =
                cluster.centroY +
                Math.sin(angulo) *
                radioOrbita;
        }
    );
}

function posicionarUbicacion(
    ubicacion,
    personasPorId
) {
    const personas =
        ubicacion.personas;

    if (personas.length === 0) {
        return;
    }

    const idsUbicacion =
        new Set(
            personas.map(persona => persona.id)
        );

    const hijosPorId = new Map();

    personas.forEach(persona => {
        hijosPorId.set(persona.id, []);
    });

    personas.forEach(persona => {
        if (
            persona.reportaA &&
            idsUbicacion.has(persona.reportaA)
        ) {
            hijosPorId
                .get(persona.reportaA)
                .push(persona.id);
        }
    });

    let raices =
        personas.filter(persona => {
            return (
                !persona.reportaA ||
                !idsUbicacion.has(persona.reportaA)
            );
        });

    if (raices.length === 0) {
        raices = [personas[0]];
    }

    const visitados = new Set();

    const arboles = raices.map(raiz => {
        const ids =
            obtenerDescendientesLocales(
                raiz.id,
                hijosPorId,
                visitados
            );

        return {
            raizId: raiz.id,
            ids
        };
    });

    personas.forEach(persona => {
        if (!visitados.has(persona.id)) {
            const ids =
                obtenerDescendientesLocales(
                    persona.id,
                    hijosPorId,
                    visitados
                );

            arboles.push({
                raizId: persona.id,
                ids
            });
        }
    });

    posicionarArbolesEnUbicacion(
        arboles,
        ubicacion,
        personasPorId,
        hijosPorId
    );
}
  
  function obtenerDescendientesLocales(
    raizId,
    hijosPorId,
    visitados
) {
    const resultado = [];
    const pendientes = [raizId];

    while (pendientes.length > 0) {
        const idActual =
            pendientes.shift();

        if (visitados.has(idActual)) {
            continue;
        }

        visitados.add(idActual);
        resultado.push(idActual);

        const hijos =
            hijosPorId.get(idActual) ?? [];

        pendientes.push(...hijos);
    }

    return resultado;
}

  function posicionarArbolesEnUbicacion(
    arboles,
    ubicacion,
    personasPorId,
    hijosPorId
) {
    if (arboles.length === 1) {
        posicionarArbolLocal(
            arboles[0],
            ubicacion.centroX,
            ubicacion.centroY,
            personasPorId,
            hijosPorId
        );

        return;
    }

    const radioOrbita =
        Math.max(
            35,
            ubicacion.radio * 0.48
        );

    arboles.forEach((arbol, indice) => {
        const angulo =
            -Math.PI / 2 +
            (
                indice /
                arboles.length
            ) *
            Math.PI *
            2;

        const centroX =
            ubicacion.centroX +
            Math.cos(angulo) *
            radioOrbita;

        const centroY =
            ubicacion.centroY +
            Math.sin(angulo) *
            radioOrbita;

        posicionarArbolLocal(
            arbol,
            centroX,
            centroY,
            personasPorId,
            hijosPorId
        );
    });
}

  function posicionarArbolLocal(
    arbol,
    centroX,
    centroY,
    personasPorId,
    hijosPorId
) {
    const idsPermitidos =
        new Set(arbol.ids);

    const niveles =
        obtenerNivelesArbol(
            arbol.raizId,
            idsPermitidos,
            hijosPorId
        );

    niveles.forEach((idsNivel, profundidad) => {
        if (profundidad === 0) {
            const raiz =
                personasPorId.get(idsNivel[0]);

            raiz.x = centroX;
            raiz.y = centroY;

            return;
        }

        const radio =
            profundidad *
            CONFIG_LAYOUT.arbol.distanciaNivel;

        idsNivel.forEach((id, indice) => {
            const angulo =
                -Math.PI / 2 +
                (
                    indice /
                    idsNivel.length
                ) *
                Math.PI *
                2;

            const persona =
                personasPorId.get(id);

            persona.x =
                centroX +
                Math.cos(angulo) *
                radio;

            persona.y =
                centroY +
                Math.sin(angulo) *
                radio;
        });
    });
}

  function obtenerNivelesArbol(
    raizId,
    idsPermitidos,
    hijosPorId
) {
    const niveles = [];
    const visitados = new Set();

    const pendientes = [
        {
            id: raizId,
            profundidad: 0
        }
    ];

    while (pendientes.length > 0) {
        const actual =
            pendientes.shift();

        if (
            visitados.has(actual.id) ||
            !idsPermitidos.has(actual.id)
        ) {
            continue;
        }

        visitados.add(actual.id);

        if (!niveles[actual.profundidad]) {
            niveles[actual.profundidad] = [];
        }

        niveles[actual.profundidad].push(
            actual.id
        );

        const hijos =
            hijosPorId.get(actual.id) ?? [];

        hijos.forEach(hijoId => {
            pendientes.push({
                id: hijoId,
                profundidad:
                    actual.profundidad + 1
            });
        });
    }

    return niveles;
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
    conexiones,
    capaConexiones
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
