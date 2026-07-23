document.addEventListener("DOMContentLoaded", cargarRed);

const SVG_NS = "http://www.w3.org/2000/svg";

const CONFIG_LAYOUT = {
    margenExterior: 100,

    cluster: {
        radioMinimo: 160,
        padding: 80,
        separacionGrid: 140
    },

    fuerzasCluster: {
        iteracionesMaximas: 500,
        atraccionEnlaces: 0.025,
        atraccionCentro: 0.008,
        repulsion: 90000,
        separacion: 70,
        movimientoMaximo: 18,
        umbralConvergencia: 0.08
    },

    fuerzasPersona: {
        iteracionesMaximas: 450,
        atraccionUbicacion: 0.045,
        atraccionJerarquia: 0.02,
        atraccionCentroJerarquico: 0.012,
        repulsion: 550,
        distanciaMinima: 18,
        movimientoMaximo: 8,
        umbralConvergencia: 0.05,
        margenCluster: 14,
        separacionUbicaciones: 24
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

const grafoClusters =
    construirGrafoClusters(
        clusters,
        conexiones
    );
    
    resolverLayoutClusters(
        clusters,
        grafoClusters,
        clusterRaiz,
        anchoMinimo,
        altoMinimo
    );
    
    return {
        clusters,
        grafoClusters,
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

function construirGrafoClusters(
    clusters,
    conexiones
) {
    const clustersPorNombre = new Map(
        clusters.map(cluster => [
            cluster.nombre,
            cluster
        ])
    );

    const relacionesPorClave = new Map();

    conexiones.forEach(conexion => {
        if (!conexion.esInterCluster) {
            return;
        }

        const nombreOrigen =
            conexion.origen.cluster;

        const nombreDestino =
            conexion.destino.cluster;

        const origen =
            clustersPorNombre.get(nombreOrigen);

        const destino =
            clustersPorNombre.get(nombreDestino);

        if (!origen || !destino) {
            return;
        }

        const clave = [
            nombreOrigen,
            nombreDestino
        ]
            .sort()
            .join("::");

        if (!relacionesPorClave.has(clave)) {
            relacionesPorClave.set(clave, {
                origen,
                destino,
                peso: 0
            });
        }

        relacionesPorClave.get(clave).peso += 1;
    });

    return Array.from(
        relacionesPorClave.values()
    );
}

function resolverLayoutClusters(
    clusters,
    grafoClusters,
    clusterRaiz,
    ancho,
    alto
) {
    const config =
        CONFIG_LAYOUT.fuerzasCluster;

    const margen =
        CONFIG_LAYOUT.margenExterior;

    const clustersMoviles =
        clusters.filter(
            cluster => cluster !== clusterRaiz
        );

    if (clustersMoviles.length === 0) {
        return clusters;
    }

    /*
     * Posiciones iniciales deterministas.
     * Solo sirven como punto de partida para las fuerzas.
     */
    const radioInicial =
        Math.max(
            clusterRaiz.radio * 2,
            Math.min(ancho, alto) * 0.3
        );

    clustersMoviles
        .sort((a, b) =>
            a.nombre.localeCompare(b.nombre)
        )
        .forEach((cluster, indice) => {
            const angulo =
                (Math.PI * 2 * indice) /
                clustersMoviles.length;

            cluster.centroX =
                clusterRaiz.centroX +
                Math.cos(angulo) *
                radioInicial;

            cluster.centroY =
                clusterRaiz.centroY +
                Math.sin(angulo) *
                radioInicial;
        });

    let iteracionesEstables = 0;

    for (
        let iteracion = 0;
        iteracion < config.iteracionesMaximas;
        iteracion += 1
    ) {
        const fuerzas = new Map(
            clusters.map(cluster => [
                cluster,
                { x: 0, y: 0 }
            ])
        );

        /*
         * Atracción jerárquica entre clusters.
         */
        grafoClusters.forEach(relacion => {
            const origen = relacion.origen;
            const destino = relacion.destino;

            const dx =
                destino.centroX -
                origen.centroX;

            const dy =
                destino.centroY -
                origen.centroY;

            const distancia =
                Math.max(
                    Math.hypot(dx, dy),
                    0.001
                );

            const distanciaDeseada =
                origen.radio +
                destino.radio +
                config.separacion;

            const intensidad =
                (distancia - distanciaDeseada) *
                config.atraccionEnlaces *
                (1 + Math.log1p(relacion.peso));

            const fuerzaX =
                (dx / distancia) *
                intensidad;

            const fuerzaY =
                (dy / distancia) *
                intensidad;

            if (origen !== clusterRaiz) {
                fuerzas.get(origen).x += fuerzaX;
                fuerzas.get(origen).y += fuerzaY;
            }

            if (destino !== clusterRaiz) {
                fuerzas.get(destino).x -= fuerzaX;
                fuerzas.get(destino).y -= fuerzaY;
            }
        });

        /*
         * Repulsión entre todos los clusters.
         */
        for (
            let i = 0;
            i < clusters.length;
            i += 1
        ) {
            for (
                let j = i + 1;
                j < clusters.length;
                j += 1
            ) {
                const clusterA = clusters[i];
                const clusterB = clusters[j];

                let dx =
                    clusterB.centroX -
                    clusterA.centroX;

                let dy =
                    clusterB.centroY -
                    clusterA.centroY;

                if (dx === 0 && dy === 0) {
                    dx = 0.01;
                    dy = 0.01;
                }

                const distancia =
                    Math.max(
                        Math.hypot(dx, dy),
                        0.001
                    );

                const distanciaMinima =
                    clusterA.radio +
                    clusterB.radio +
                    config.separacion;

                let intensidad =
                    config.repulsion /
                    Math.pow(distancia, 2);

                if (distancia < distanciaMinima) {
                    intensidad +=
                        (distanciaMinima - distancia) *
                        0.35;
                }

                const fuerzaX =
                    (dx / distancia) *
                    intensidad;

                const fuerzaY =
                    (dy / distancia) *
                    intensidad;

                if (clusterA !== clusterRaiz) {
                    fuerzas.get(clusterA).x -= fuerzaX;
                    fuerzas.get(clusterA).y -= fuerzaY;
                }

                if (clusterB !== clusterRaiz) {
                    fuerzas.get(clusterB).x += fuerzaX;
                    fuerzas.get(clusterB).y += fuerzaY;
                }
            }
        }

        /*
         * Atracción suave hacia el cluster raíz.
         * Mantiene los clusters orbitando el centro.
         */
        clustersMoviles.forEach(cluster => {
            const dx =
                clusterRaiz.centroX -
                cluster.centroX;

            const dy =
                clusterRaiz.centroY -
                cluster.centroY;

            fuerzas.get(cluster).x +=
                dx * config.atraccionCentro;

            fuerzas.get(cluster).y +=
                dy * config.atraccionCentro;
        });

        const enfriamiento =
            1 - iteracion /
            config.iteracionesMaximas;

        let movimientoMayor = 0;

        clustersMoviles.forEach(cluster => {
            const fuerza =
                fuerzas.get(cluster);

            const movimientoX =
                Math.max(
                    -config.movimientoMaximo,
                    Math.min(
                        config.movimientoMaximo,
                        fuerza.x * enfriamiento
                    )
                );

            const movimientoY =
                Math.max(
                    -config.movimientoMaximo,
                    Math.min(
                        config.movimientoMaximo,
                        fuerza.y * enfriamiento
                    )
                );

            cluster.centroX += movimientoX;
            cluster.centroY += movimientoY;

            /*
             * Evita que el cluster salga del canvas.
             */
            cluster.centroX =
                Math.max(
                    margen + cluster.radio,
                    Math.min(
                        ancho -
                            margen -
                            cluster.radio,
                        cluster.centroX
                    )
                );

            cluster.centroY =
                Math.max(
                    margen + cluster.radio,
                    Math.min(
                        alto -
                            margen -
                            cluster.radio,
                        cluster.centroY
                    )
                );

            movimientoMayor =
                Math.max(
                    movimientoMayor,
                    Math.hypot(
                        movimientoX,
                        movimientoY
                    )
                );
        });

        /*
         * El cluster raíz permanece fijo.
         */
        clusterRaiz.centroX = ancho / 2;
        clusterRaiz.centroY = alto / 2;

        if (
            movimientoMayor <
            config.umbralConvergencia
        ) {
            iteracionesEstables += 1;

            if (iteracionesEstables >= 10) {
                break;
            }
        } else {
            iteracionesEstables = 0;
        }
    }

    return clusters;
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

