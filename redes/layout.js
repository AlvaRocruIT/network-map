---------------------CONFIG--------------- */
const CONFIG_LAYOUT = {
    VINCULOS: {
        datos: "../data/organigrama.json"
    },
 
    SELECTORES: {
        contenedor: "#redes"
    },

   VISTA: {
        zoomMinimo: 0.35,
        zoomMaximo: 5,
        factorRueda: 1.15,
        umbralArrastre: 4
    },
    
    NODOS: {
        radioNormal: 10,
        radioRaiz: 15
    },
 
    DISTANCIAS: {
        separacionNivelesUbicacion: 38,
        separacionNodosAnillo: 14,
        radioNucleoUbicacion: 18,
        separacionUbicaciones: 22,
        separacionClusters: 60,
        margenMapa: 60
    },

    ESCALA: {
        crecimientoCluster: 24,
        crecimientoUbicacion: 18
    },

    EMPAQUETADO: {
        pasoRadial: 8,
        separacionAngularMinima: 8
    },

   ORBITAS: {
        radioBase: 20,
        expansionPorPoblacion: 520,
        pasoRadial: 10,
        limiteBusqueda: 2400,
        pesoBaseSector: 1,
        pesoPoblacionSector: 1,
        pesoTamanoSector: 0.018,
        margenAngularSector: 0.035
    }
};

    /* ---------------AQUÍ VAMOS--------------- */
document.addEventListener(
    "DOMContentLoaded",
    iniciarMapa
);

async function iniciarMapa() {
    try {
        validarConfiguracion();
        const personas =
            await cargarDatos(CONFIG_LAYOUT.VINCULOS.datos);

        const modelo =
            construirModelo(personas);
            prepararSVG(modelo);
            calcularLayout(modelo);
            dibujarMapa(modelo);
    }
    catch (error) {
        console.error(error);
        mostrarError(error);
    }
}

    /* ---------------CARGA DE DATOS--------------- */
async function cargarDatos(url) {
    const respuesta = await fetch(url);
        if (!respuesta.ok) {
            throw new Error(
            `No fue posible cargar ${url}`
        );
    }

    const json = await respuesta.json();
    const personas = Array.isArray(json) ? json : json.personas;
        validarPersonas(personas);
    return personas;
}

    /* ---------------VALIDACIONES--------------- */
function validarConfiguracion() {
    const ruta = CONFIG_LAYOUT.VINCULOS.datos;
        if (!ruta) {
            throw new Error("Debes configurar la ruta del JSON."
        );
    }
}

function validarPersonas(personas) {
    if (!Array.isArray(personas)) {
        throw new Error(
            "El JSON debe contener un arreglo de personas."
        );
    }
    const ids = new Set();
    personas.forEach((persona, indice) => {
        const obligatorios = ["id", "cluster", "Ubicacion"];
        obligatorios.forEach(campo => {
            if (
                persona[campo] === undefined ||
                persona[campo] === null ||
                persona[campo] === ""
            ) {
                throw new Error(
                    `Registro ${indice}: falta ${campo}`
                );
            }
        });
        if (ids.has(persona.id)) {
            throw new Error(
                `ID duplicado: ${persona.id}`
            );
        }
        ids.add(persona.id);
    });
}

    /* ---------------CONSTRUCCION DEL MODELO--------------- */
function construirModelo(personas) {
    const nodos = prepararNodos(personas);
    const indice = crearIndiceNodos(nodos);
        vincularJerarquia(nodos, indice);
    const conexiones = prepararConexiones(nodos);
    const clusters = construirClusters(nodos);
    const ubicaciones = extraerUbicaciones(clusters);
    const raices = encontrarRaices(nodos);
    const raiz = seleccionarRaizGlobal(raices, nodos);
    calcularJerarquia(raices);
    detectarLideresLocales(ubicaciones);
    calcularJerarquiaLocal(ubicaciones);
    if (raiz) {
        raiz.esRaizGlobal = true;
        raiz.radio =
            CONFIG_LAYOUT
                .NODOS
                .radioRaiz;
    }
    return {
        nodos,
        indice,
        conexiones,
        clusters,
        ubicaciones,
        raices,
        raiz,
        svg: null,
        viewport: null,
        capas: null,
        vista: crearEstadoVista()
    };
}

    /* ---------------PREPARACIÓN DE NODOS--------------- */
function prepararNodos(personas) {
    return personas.map(persona => ({
        id: String(persona.id),
        datos: {
            nombre: persona.nombre ?? "",
            cargo: persona.cargo ?? "",
            equipo: persona.equipo ?? "",
            cluster: String(persona.cluster),
            ubicacion: String(persona.Ubicacion),
            reportaA: persona.reportaA
                    ? String(persona.reportaA)
                    : null
        },
        superior: null,
        subordinados: [],
        clusterRef: null,
        ubicacionRef: null,
        profundidadGlobal: 0,
        profundidadLocal: 0,
        pesoRama: 1,
        angulo: 0,
        radio:
            CONFIG_LAYOUT
                .NODOS
                .radioNormal,
        esRaizGlobal: false,
        x: 0,
        y: 0,
        xBase: 0,
        yBase: 0,
        xLocal: 0,
        yLocal: 0
    }));
}

function crearIndiceNodos(nodos) {
    return new Map(nodos.map(nodo => [nodo.id, nodo]));
}

    /* ---------------JERARQUÍA--------------- */
function vincularJerarquia(nodos, indice) {
    nodos.forEach(nodo => {
        if (!nodo.datos.reportaA)
            return;
        const superior = indice.get(nodo.datos.reportaA);
        if (!superior)
            return;
        nodo.superior = superior;
        superior
            .subordinados
            .push(nodo);
    });
}

function prepararConexiones(nodos) {
    return nodos
        .filter(nodo => nodo.superior)
        .map(nodo => ({
            id: `${nodo.superior.id}_${nodo.id}`,
            superior: nodo.superior,
            subordinado: nodo,
            mismaUbicacion: nodo.superior
                    .datos
                    .cluster ===
                nodo
                    .datos
                    .cluster
                &&
                nodo.superior
                    .datos
                    .ubicacion ===
                nodo
                    .datos
                    .ubicacion
        }));
}

function encontrarRaices(nodos) {
    return nodos.filter(nodo => nodo.superior === null);
}

function seleccionarRaizGlobal(raices, nodos) {
    if (raices.length === 1) {
        return raices[0];
    }
    if (raices.length > 1) {
        return [...raices]
            .sort((a, b) => calcularPesoRama(b) - calcularPesoRama(a))[0];
    }
    return nodos[0];
}

function calcularJerarquia(raices) {
    const visitados = new Set();
    raices.forEach(
        raiz => recorrerJerarquia(raiz, 0, visitados)
    );
}

function recorrerJerarquia(nodo, profundidad, visitados) {
    if (visitados.has(nodo.id)) {
        return;
    }
    visitados.add(nodo.id);
    nodo.profundidadGlobal = profundidad;
    nodo.pesoRama = calcularPesoRama(nodo);
    nodo.subordinados.forEach( hijo => recorrerJerarquia(
                hijo,
                profundidad + 1,
                visitados
            )
    );
}

function calcularPesoRama(nodo) {
    if ( nodo.subordinados.length === 0) {
        return 1;
    }
    let peso = 1;
    nodo.subordinados.forEach(
        hijo => {peso += calcularPesoRama(hijo);}
    );
    nodo.pesoRama = peso;
    return peso;
}

    /* ---------------CLUSTERS--------------- */
function construirClusters(nodos) {
    const mapa = new Map();
    nodos.forEach(nodo => {const nombre = nodo
                .datos
                .cluster;
        if (!mapa.has(nombre)) {
            mapa.set(nombre,
                {
                    nombre,
                    id: slug(nombre),
                    nodos: [],
                    ubicaciones: [],
                    x: 0,
                    y: 0,
                    radio: 0
                }
            );
        }
        const cluster = mapa.get(nombre);
        cluster
            .nodos
            .push(nodo);
        nodo.clusterRef = cluster;
    });
    mapa.forEach(cluster => {
        cluster.ubicaciones = construirUbicaciones(cluster);
    });
    return [...mapa.values()];
}

    /* ---------------UBICACIONES--------------- */
function construirUbicaciones(cluster) {
    const mapa = new Map();
    cluster.nodos.forEach(nodo => {
        const nombre = nodo
                .datos
                .ubicacion;
        if (!mapa.has(nombre)) {
            mapa.set(
                nombre,
                {
                    id: cluster.id + "_" + slug(nombre),
                    nombre,
                    cluster,
                    nodos: [],
                    lideresLocales: [],
                    radio: 0,
                    xLocal: 0,
                    yLocal: 0
                }
            );
        }
        const ubicacion = mapa.get(nombre);
        ubicacion
            .nodos
            .push(nodo);
        nodo.ubicacionRef =ubicacion;
    });
    return [...mapa.values()];
}

function extraerUbicaciones(clusters) {
    return clusters.flatMap(cluster =>  cluster.ubicaciones);
}

function detectarLideresLocales(ubicaciones) {
    ubicaciones.forEach(
        ubicacion => {
            const ids = new Set(
                ubicacion
                    .nodos
                    .map(n => n.id)
                );
            ubicacion.lideresLocales =
                ubicacion.nodos.filter(
                    nodo => !nodo.superior ||
                        !ids.has(
                         nodo
                                .superior
                                .id
                        )
                );
            if (ubicacion
                .lideresLocales
                .length === 0
            ) {
                ubicacion
                    .lideresLocales
                    .push(
                        ubicacion
                            .nodos[0]
                    );
            }
        }
    );
}

function calcularJerarquiaLocal(ubicaciones) {
    ubicaciones.forEach(
        ubicacion => {
            const visitados = new Set();
            ubicacion
                .lideresLocales
                .forEach(
                    lider => recorrerJerarquiaLocal(
                            lider,
                            ubicacion,
                            0,
                            visitados
                        )
                );
        }
    );
}

function recorrerJerarquiaLocal(
    nodo,
    ubicacion,
    profundidad,
    visitados
) {
    if (
        visitados.has(nodo.id)
    ) {
        return;
    }
    if (
        nodo.ubicacionRef !== ubicacion
    ) {
        return;
    }
    visitados.add(nodo.id);
    nodo.profundidadLocal = profundidad;
    nodo.subordinados.forEach(
        hijo => recorrerJerarquiaLocal(
                hijo,
                ubicacion,
                profundidad + 1,
                visitados
            )
    );
}

 /* ---------------UTILIDADES GENERALES--------------- */
function slug(valor) {
    return String(valor)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
