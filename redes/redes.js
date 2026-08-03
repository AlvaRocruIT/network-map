 /* ==========================================================================
 * Arquitectura
 *
 * 1. Configuración
 * 2. Inicialización
 * 3. Carga y validación
 * 4. Construcción del modelo
 * 5. Jerarquía
 * 6. Layout
 * 7. Zoom
 * 8. Render SVG
 * 9. Utilidades 
 
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

    PESOS: {
        permanecerEnUbicacion: 0.23,
        permanecerEnCluster: 0.23,
        mantenerJerarquia: 0.16,
        evitarColisiones: 0.28,
        acercarseAlSuperior: 0.10
    },
    
    NODOS: {
        radioNormal: 10,
        radioRaiz: 15
    },
 
    DISTANCIAS: {
        jerarquiaLocal: 34,
        separacionNivelesUbicacion: 38,
        separacionNodosAnillo: 14,
        radioNucleoUbicacion: 18,
        separacionUbicaciones: 22,
        separacionClusters: 60,
        separacionRamas: 20,
        margenColision: 5,
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
    },
 
    FUERZAS: {
        ubicacion: 0.05,
        cluster: 0.025,
        jerarquia: 0.045,
        colision: 0.90,
        superior: 0.018
    },

    SIMULACION: {
        iteraciones: 260,
        intensidadInicial: 1,
        enfriamiento: 0.985,
        iteracionesColisionFinal: 18
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
            await cargarDatos(
                CONFIG_LAYOUT.VINCULOS.datos
            );

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
    const personas = Array.isArray(json)
            ? json : json.personas;
        validarPersonas(personas);
    return personas;
}

    /* ---------------VALIDACIONES--------------- */
function validarConfiguracion() {
    const ruta = CONFIG_LAYOUT.VINCULOS.datos;
        if (!ruta) {
            throw new Error("Debes configurar la ruta del JSON.");
    }
    const suma = Object
        .values(CONFIG_LAYOUT.PESOS)
        .reduce((a, b) => a + b, 0);
    if (Math.abs(suma - 1) > 0.0001) 
    {
        throw new Error(
            "Los pesos deben sumar 1."
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
        const obligatorios = [
            "id",
            "cluster",
            "Ubicacion"
        ];
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
        vincularJerarquia(nodos, indice
    );
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

    /* ---------------ZOOM--------------- */
function crearEstadoVista() {
    return {
        escala: 1,
        desplazamientoX: 0,
        desplazamientoY: 0,
        modo: "mapa",
        clusterActivo: null,
        vistaAnterior: null,
        arrastrando: false,
        huboArrastre: false,
        suprimirProximoClick: false,
        punteroId: null,
        inicioClienteX: 0,
        inicioClienteY: 0,
        inicioSVGX: 0,
        inicioSVGY: 0,
        desplazamientoInicialX: 0,
        desplazamientoInicialY: 0
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
            .sort(
                (a, b) => calcularPesoRama(b)
                    -
                    calcularPesoRama(a)
            )[0];
    }
    return nodos[0];
}

function calcularJerarquia(raices) {
    const visitados = new Set();
    raices.forEach(
        raiz => recorrerJerarquia(
                raiz,
                0,
                visitados
            )
    );
}

function recorrerJerarquia(
    nodo,
    profundidad,
    visitados
) {
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
        hijo => {
            peso += calcularPesoRama(hijo);
        }
    );
    nodo.pesoRama =
        peso;
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
                    id:
                        cluster.id +
                        "_" +
                        slug(nombre),
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
        nodo
            .ubicacionRef !== ubicacion
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

    /* ---------------PREPARACIÓN SVG--------------- */
function prepararSVG(modelo) {
    const contenedor = document.querySelector(
            CONFIG_LAYOUT
                .SELECTORES
                .contenedor
        );
    if (!contenedor) {
        throw new Error(
            "No existe el contenedor del mapa."
        );
    }
    contenedor.replaceChildren();
    const svg = crearSVG("svg",
            {
                class:"mapa-redes"
            }
        );
    const viewport = crearSVG("g",
            {
                class: "mapa-redes__viewport"
            }
        );
    const conexiones = crearSVG("g",
            {
                class: "mapa-redes__conexiones"
            }
        );
    const nodos = crearSVG("g",
            {
                class: "mapa-redes__nodos"
            }
        );
    viewport.append(
        conexiones,
        nodos
    );
    svg.append(viewport);
    contenedor.append(svg);
    modelo.svg = svg;
    modelo.viewport = viewport;
    modelo.capas = {
        conexiones,
        nodos
    };
    configurarInteraccionVista(modelo);
    aplicarTransformacionVista(modelo);
}

    /* ---------------CÁLCULO DEL LAYOUT--------------- */
function calcularLayout(modelo) {
    resolverLayoutUbicaciones(modelo);
    resolverLayoutClusters(modelo);
    resolverLayoutPersonas(modelo);
    normalizarMapa(modelo);
}

    /* ---------------LAYOUT DE UBICACIONES--------------- */

function resolverLayoutUbicaciones(modelo) {
    modelo.ubicaciones.forEach(
        ubicacion => {
            resolverLayoutUbicacion(ubicacion);
        }
    );
}
function resolverLayoutUbicacion(ubicacion) {
    const niveles = agruparNodosPorNivelLocal(ubicacion);

    if (niveles.length === 0) {
        ubicacion.radio =
            CONFIG_LAYOUT
                .ESCALA
                .crecimientoUbicacion;
        return;
    }

    const raizGlobal = ubicacion.nodos.find(
            nodo => nodo.esRaizGlobal);
    let radioAnterior = 0;
    niveles.forEach(
        nivel => {
            let nodosNivel = [...nivel.nodos]
                    .sort(compararNodosDeterministicamente);

            if (nivel.profundidad === 0
                &&
                raizGlobal
            ) {
                raizGlobal.xLocal = 0;
                raizGlobal.yLocal = 0;
                raizGlobal.angulo =
                    -Math.PI / 2;
                nodosNivel =
                    nodosNivel.filter(nodo => nodo !== raizGlobal);
                if (nodosNivel.length > 0) {
                    radioAnterior =
                        distribuirNivelEnAnillo(
                            nodosNivel,
                            CONFIG_LAYOUT
                                .DISTANCIAS
                                .radioNucleoUbicacion,
                            -Math.PI / 2
                        );
                }
                return;
            }

            if (
                nivel.profundidad === 0
                &&
                nodosNivel.length === 1
            ) {
                const nodo =
                    nodosNivel[0];
                nodo.xLocal = 0;
                nodo.yLocal = 0;
                nodo.angulo =
                    -Math.PI / 2;
                return;
            }
            const radioJerarquico = nivel.profundidad === 0
                    ? CONFIG_LAYOUT
                        .DISTANCIAS
                        .radioNucleoUbicacion
                    : nivel.profundidad
                        *
                        CONFIG_LAYOUT
                            .DISTANCIAS
                            .separacionNivelesUbicacion;
            const radioMinimo = Math.max(
                    radioJerarquico,
                    radioAnterior
                    +
                    CONFIG_LAYOUT
                        .DISTANCIAS
                        .separacionNivelesUbicacion
                        *
                        0.72
                );
            radioAnterior = distribuirNivelEnAnillo(
                    nodosNivel,
                    radioMinimo,
                    -Math.PI / 2
                    +
                    nivel.profundidad
                    *
                    0.31
                );
        }
    );

    calcularRadioUbicacion(ubicacion);
}

function agruparNodosPorNivelLocal(ubicacion) {
    const mapa =new Map();
    ubicacion.nodos.forEach(nodo => {
            const profundidad =Math.max(
                    0,
                    Number(nodo.profundidadLocal)
                    ||
                    0
                );
            if (!mapa.has(profundidad)) {
                mapa.set(profundidad, []);
            }
            mapa
                .get(profundidad)
                .push(nodo);
        }
    );
    return [...mapa.entries()]
        .sort(
            (
                [profundidadA],
                [profundidadB]
            ) =>
                profundidadA
                -
                profundidadB
        )
        .map(
            (
                [
                    profundidad,
                    nodos
                ]
            ) => ({
                profundidad,
                nodos
            })
        );
}

function distribuirNivelEnAnillo(
    nodos,
    radioMinimo,
    anguloInicial
) {
    if (nodos.length === 0) {return radioMinimo; }
    const radioNodoMaximo = nodos.reduce(
            (
                maximo,
                nodo
            ) =>
                Math.max(
                    maximo,
                    nodo.radio
                ),
            0
        );
    const separacionLineal = radioNodoMaximo * 2 +
        CONFIG_LAYOUT
            .DISTANCIAS
            .separacionNodosAnillo;
    const radioPorCantidad =(nodos.length*
            separacionLineal)
        /
        (Math.PI * 2);
    const radio = Math.max(
            radioMinimo,
            radioPorCantidad
        );
    const pasoAngular = (Math.PI*2)
        /
        nodos.length;
        nodos.forEach(
        (
            nodo,
            indice
        ) => {
            const angulo =
                anguloInicial +
                indice *
                pasoAngular;
            nodo.angulo = angulo;
            nodo.xLocal = Math.cos(angulo)
                * radio;
            nodo.yLocal = Math.sin(angulo)
                * radio;
        }
    );
    return radio;
}

function compararNodosDeterministicamente(a,b) {
    const diferenciaPeso =b.pesoRama - a.pesoRama;
    if (diferenciaPeso !== 0) {
        return diferenciaPeso;
    }
    return a.id.localeCompare(b.id);
}

function calcularRadioUbicacion(ubicacion) {
    let radio = 0;
    ubicacion.nodos.forEach(
        nodo => {const distancia =
                Math.hypot(nodo.xLocal, nodo.yLocal);
            radio = Math.max(radio, distancia);
        }
    );
    ubicacion.radio = radio
        +
        CONFIG_LAYOUT
            .ESCALA
            .crecimientoUbicacion;
}

    /* ---------------LAYOUT DE CLUSTERS--------------- */
function resolverLayoutClusters(modelo) {
    modelo.clusters.forEach(
        cluster => {
            resolverLayoutCluster(cluster);
        }
    );
    distribuirClusters(modelo.clusters);
}

function resolverLayoutCluster(cluster) 
{
    const ubicaciones = cluster.ubicaciones;
    if (ubicaciones.length === 0) {
        cluster.radio = 0;
        return;
    }
    const ubicacionCentral =
        seleccionarUbicacionCentral(cluster);
    ubicacionCentral.xLocal = 0;
    ubicacionCentral.yLocal = 0;
    const ubicacionesColocadas = [ubicacionCentral];
    const ubicacionesPendientes = ubicaciones
            .filter(ubicacion => ubicacion !== ubicacionCentral)
            .sort(compararUbicacionesPorTamano);
    ubicacionesPendientes.forEach(
        ubicacion => {
            colocarUbicacionEnRacimo(ubicacion, ubicacionesColocadas);
            ubicacionesColocadas.push(ubicacion);
        }
    );
    calcularRadioCluster(cluster);
}

function seleccionarUbicacionCentral(cluster)
{
    const ubicacionRaiz = cluster.ubicaciones.find(
            ubicacion => ubicacion.nodos.some(
                    nodo => nodo.esRaizGlobal
                )
        );
    if (ubicacionRaiz) {
        return ubicacionRaiz;
    }
    return [...cluster.ubicaciones]
        .sort((a, b) => b.radio - a.radio)[0];
}

function compararUbicacionesPorTamano(a,b) {
    const diferenciaRadio = b.radio - a.radio;
    if (diferenciaRadio !== 0) {
        return diferenciaRadio;
    }
    return a.id.localeCompare(b.id);
}

function colocarUbicacionEnRacimo(
    ubicacion,
    ubicacionesColocadas
) {
    const configuracion =
        CONFIG_LAYOUT
            .EMPAQUETADO;
    const separacion =
        CONFIG_LAYOUT
            .DISTANCIAS
            .separacionUbicaciones;
    const alcanceActual =
        ubicacionesColocadas.reduce(
            (
                maximo,
                ubicacionColocada
            ) => {
                const alcance =
                    Math.hypot(
                        ubicacionColocada.xLocal,
                        ubicacionColocada.yLocal
                    )
                    + ubicacionColocada.radio;
                return Math.max(maximo, alcance);
            },
            0
        );
    const limiteBusqueda = alcanceActual
        + ubicacion.radio
        + separacion
        + configuracion.pasoRadial;
    for (
        let radioBusqueda = configuracion.pasoRadial;
        radioBusqueda <= limiteBusqueda;
        radioBusqueda += configuracion.pasoRadial
    ) {
        const circunferencia = Math.PI
            * 2
            * radioBusqueda;
        const cantidadAngulos = Math.max(
                12,
                Math.ceil(circunferencia/configuracion
                        .separacionAngularMinima
                )
            );
        for (
            let indice = 0;
            indice < cantidadAngulos;
            indice++
        ) {
            const angulo = indice
                * (Math.PI * 2 / cantidadAngulos);
            const candidato = { x:
                    Math.cos(angulo)
                    *
                    radioBusqueda,
                y: Math.sin(angulo)
                    * radioBusqueda
            };
            if ( posicionUbicacionDisponible(
                    ubicacion,
                    candidato,
                    ubicacionesColocadas
                )
            ) {
                ubicacion.xLocal = candidato.x;

                ubicacion.yLocal = candidato.y;
                return;
            }
        }
    }
    throw new Error(
        `No fue posible ubicar la ubicación ${ubicacion.id}`
    );
}

function posicionUbicacionDisponible(
    ubicacion,
    candidato,
    ubicacionesColocadas
) {
    const separacion =
        CONFIG_LAYOUT
            .DISTANCIAS
            .separacionUbicaciones;
    return ubicacionesColocadas.every(
        ubicacionColocada => {
            const dx =
                candidato.x
                - ubicacionColocada.xLocal;
            const dy = candidato.y
                - ubicacionColocada.yLocal;
            const distancia = Math.hypot(dx, dy);
            const distanciaMinima =
                ubicacion.radio
                + ubicacionColocada.radio
                + separacion;
            return distancia >= distanciaMinima;
        }
    );
}

function calcularRadioCluster(cluster)
{
    let radio = 0;
    cluster.ubicaciones.forEach(
        ubicacion => {
            const distancia = Math.hypot(ubicacion.xLocal, ubicacion.yLocal)
                + ubicacion.radio;
            radio = Math.max(
                    radio,
                    distancia
                );
        }
    );
    cluster.radio = radio
        +
        CONFIG_LAYOUT
            .ESCALA
            .crecimientoCluster;
}

function distribuirClusters(clusters) {
    if (clusters.length === 0) {
        return;
    }
    const clusterCentral = clusters.find(
            cluster => cluster.nodos.some(
                    nodo => nodo.esRaizGlobal
                )
        )
        ??
        [...clusters]
            .sort(compararClustersPorPoblacion)[0];
    clusterCentral.x = 0;
    clusterCentral.y = 0;
    const pendientes = clusters
            .filter(cluster =>cluster !== clusterCentral)
            .sort(compararClustersPorPoblacion);
    if (pendientes.length === 0) {
        return;
    }
    const poblacionMaxima = Math.max(
            ...pendientes.map(cluster => cluster.nodos.length)
        );
    const poblacionMinima =Math.min(
            ...pendientes.map(cluster => cluster.nodos.length)
        );
    prepararSectoresClusters(pendientes);
    const colocados = [clusterCentral];
    pendientes.forEach( cluster => {
            const radioGravitacional = calcularRadioGravitacional(
                    cluster,
                    clusterCentral,
                    poblacionMinima,
                    poblacionMaxima
                );
            const radioMinimoSector = calcularRadioMinimoSector(cluster);
            const radioFisicoMinimo =
                clusterCentral.radio
                + cluster.radio
                +
                CONFIG_LAYOUT
                    .DISTANCIAS
                    .separacionClusters;
            const radioInicial =
                Math.max(
                    radioGravitacional,
                    radioMinimoSector,
                    radioFisicoMinimo
                );
            colocarClusterEnSector(
                cluster,
                colocados,
                radioInicial
            );
            colocados.push(cluster);
        }
    );
}

function prepararSectoresClusters(clusters) {
    const configuracion = CONFIG_LAYOUT.ORBITAS;
    clusters.forEach(cluster => {
            cluster.pesoSector =
                configuracion.pesoBaseSector
                + cluster.nodos.length
                * configuracion
                    .pesoPoblacionSector
                + cluster.radio
                * configuracion
                    .pesoTamanoSector;
        }
    );
    const pesoTotal = clusters.reduce(
            (total,cluster) => total
                + cluster.pesoSector, 0);

    let anguloCursor = -Math.PI / 2;
    clusters.forEach(
        cluster => {
            const apertura =
                (cluster.pesoSector/pesoTotal)
                * Math.PI
                * 2;
            cluster.anguloInicio = anguloCursor;
            cluster.anguloFin = anguloCursor
                + apertura;
            cluster.anguloCentro = anguloCursor
                + apertura / 2;
            cluster.aperturaAngular = apertura;
            anguloCursor += apertura;
        }
    );
}

function calcularRadioGravitacional(
    cluster,
    clusterCentral,
    poblacionMinima,
    poblacionMaxima
) {
    let densidadNormalizada = 1;
    if (poblacionMaxima !== poblacionMinima) {
        densidadNormalizada =
            (cluster.nodos.length - poblacionMinima)
            /
            (poblacionMaxima - poblacionMinima);
    }

    const factorPeriferia =
        1 - densidadNormalizada;
    return (clusterCentral.radio
        + CONFIG_LAYOUT
            .DISTANCIAS
            .separacionClusters
        + CONFIG_LAYOUT
            .ORBITAS
            .radioBase
        + factorPeriferia
        * CONFIG_LAYOUT
            .ORBITAS
            .expansionPorPoblacion
    );
}

function calcularRadioMinimoSector(cluster) {
    const margen = CONFIG_LAYOUT
            .ORBITAS
            .margenAngularSector;
    const medioAnguloDisponible = cluster.aperturaAngular
        / 2 - margen;
    const anguloSeguro =
        Math.max(0.04,
            Math.min(
                medioAnguloDisponible,
                Math.PI / 2
            )
        );

    const radioConMargen = cluster.radio
        + CONFIG_LAYOUT
            .DISTANCIAS
            .separacionClusters *  0.35;
    return (
        radioConMargen/
        Math.sin(anguloSeguro)
    );
}

function colocarClusterEnSector(
    cluster,
    clustersColocados,
    radioInicial
) {
    const configuracion =
        CONFIG_LAYOUT
            .ORBITAS;
    const angulo =
        cluster.anguloCentro;
    const limite = radioInicial
        + configuracion
            .limiteBusqueda;
    for (let radioBusqueda = radioInicial;
        radioBusqueda <= limite;
        radioBusqueda += configuracion
                .pasoRadial
    ) {
        const candidato = {
            x:Math.cos(angulo)
                * radioBusqueda,
            y: Math.sin(angulo)
                * radioBusqueda
        };
        if (
            posicionClusterDisponible(
                cluster,
                candidato,
                clustersColocados
            )
        ) {
            cluster.x = candidato.x;
            cluster.y = candidato.y;
            cluster.radioOrbital = radioBusqueda;
            return;
        }
    }
    throw new Error(
        `No fue posible ubicar el cluster ${cluster.id} dentro de su sector`
    );
}

function compararClustersPorPoblacion(a,b) {
    const diferenciaPoblacion =
        b.nodos.length - a.nodos.length;
    if (diferenciaPoblacion !== 0) {
        return diferenciaPoblacion;
    }
    const diferenciaRadio = b.radio - a.radio;
    if (diferenciaRadio !== 0) {
        return diferenciaRadio;
    }
    return a.id.localeCompare(b.id);
}

function posicionClusterDisponible(
    cluster,
    candidato,
    clustersColocados
) {
    return clustersColocados.every(
        clusterColocado =>
            ubicacionesDeClustersSeparadas(
                cluster,
                candidato,
                clusterColocado
            )
    );
}

function ubicacionesDeClustersSeparadas(
    cluster,
    candidato,
    clusterColocado
) {
    const separacion =
        CONFIG_LAYOUT
            .DISTANCIAS
            .separacionClusters;
    return cluster.ubicaciones.every(
        ubicacion => clusterColocado
                .ubicaciones
                .every(ubicacionColocada => {
                        const x = candidato.x + ubicacion.xLocal;
                        const y = candidato.y + ubicacion.yLocal;
                        const xColocado = clusterColocado.x + ubicacionColocada.xLocal;
                        const yColocado = clusterColocado.y + ubicacionColocada.yLocal;
                        const distancia = Math.hypot( x - xColocado, y - yColocado);
                        const distanciaMinima = ubicacion.radio + ubicacionColocada.radio + separacion;
                        return distancia >= distanciaMinima;
                    }
                )
    );
}

    /* ---------------POSICIÓN GLOBAL DE NODOS--------------- */
function resolverLayoutPersonas(modelo) {
    modelo.clusters.forEach(
        cluster => {
            cluster.ubicaciones.forEach(
                ubicacion => {
                    ubicacion.nodos.forEach(
                        nodo => {
                            nodo.xBase = cluster.x + ubicacion.xLocal + nodo.xLocal;
                            nodo.yBase = cluster.y + ubicacion.yLocal + nodo.yLocal;
                            nodo.x = nodo.xBase;
                            nodo.y = nodo.yBase;
                        }
                    );
                }
            );
        }
    );
if (modelo.raiz) {
        modelo.raiz.xBase = 0;
        modelo.raiz.yBase = 0;
        modelo.raiz.x = 0;
        modelo.raiz.y = 0;
    }
}

    /* ---------------SIMULACIÓN POR FUERZAS--------------- */
function simularLayout(modelo) {
    let intensidad =
        CONFIG_LAYOUT
            .SIMULACION
            .intensidadInicial;
    for (
        let iteracion = 0;
        iteracion < CONFIG_LAYOUT
            .SIMULACION
            .iteraciones;
        iteracion++) {
        const desplazamientos = crearMapaDesplazamientos(modelo.nodos);
        aplicarFuerzaUbicacion(modelo, desplazamientos);
        aplicarFuerzaCluster(modelo, desplazamientos);
        aplicarFuerzaJerarquia(modelo, desplazamientos);
        aplicarFuerzaSuperior(modelo, desplazamientos);
        aplicarFuerzaColision(modelo, desplazamientos);
        aplicarDesplazamientos(modelo.nodos, desplazamientos, intensidad);
        intensidad *=
            CONFIG_LAYOUT
                .SIMULACION
                .enfriamiento;
    }
}

function crearMapaDesplazamientos(nodos) {
    const mapa = new Map();
    nodos.forEach( nodo => {mapa.set(nodo.id,
                {
                    x: 0, y: 0
                }
            );
        }
    );
    return mapa;
}

    /* ---------------FUERZA: PERMANECER EN UBICACIÓN--------------- */
function aplicarFuerzaUbicacion(modelo, desplazamientos) {
    const peso =
        CONFIG_LAYOUT
            .PESOS
            .permanecerEnUbicacion
        * CONFIG_LAYOUT
            .FUERZAS
            .ubicacion;
    modelo.nodos.forEach(
        nodo => {
            const objetivo = obtenerObjetivoUbicacion(nodo);
            const dx = objetivo.x - nodo.x;
            const dy = objetivo.y - nodo.y;
            const desplazamiento = desplazamientos.get(nodo.id);
            desplazamiento.x += dx * peso;
            desplazamiento.y += dy * peso;
        }
    );
}

function obtenerObjetivoUbicacion(nodo) {
    return {x: nodo.clusterRef.x
                + nodo.ubicacionRef.xLocal
                + nodo.xLocal,
            y:
                nodo.clusterRef.y
                + nodo.ubicacionRef.yLocal
                + nodo.yLocal
            };
}

    /* ---------------FUERZA: PERMANECER EN CLUSTER--------------- */
function aplicarFuerzaCluster(modelo, desplazamientos) {
    const peso =
        CONFIG_LAYOUT
            .PESOS
            .permanecerEnCluster
        * CONFIG_LAYOUT
            .FUERZAS
            .cluster;
    modelo.nodos.forEach(nodo => {
            const cluster = nodo.clusterRef;
            const dx = cluster.x - nodo.x;
            const dy = cluster.y - nodo.y;
            const desplazamiento = desplazamientos.get(nodo.id);
            desplazamiento.x += dx * peso;
            desplazamiento.y += dy * peso;
        }
    );
}

    /* ---------------FUERZA: MANTENER JERARQUÍA--------------- */
function aplicarFuerzaJerarquia(modelo,desplazamientos) {
    const peso =
        CONFIG_LAYOUT
            .PESOS
            .mantenerJerarquia
        * CONFIG_LAYOUT
            .FUERZAS
            .jerarquia;
    modelo.conexiones.forEach(
        conexion => {
            if (!conexion.mismaUbicacion) {
                return;
            }
            aplicarResorte( conexion.superior,
                conexion.subordinado,
                CONFIG_LAYOUT
                    .DISTANCIAS
                    .jerarquiaLocal,
                peso, desplazamientos
            );
        }
    );
}

    /* ---------------FUERZA: ACERCARSE AL SUPERIOR--------------- */
function aplicarFuerzaSuperior(modelo, desplazamientos) {
    const peso =
        CONFIG_LAYOUT
            .PESOS
            .acercarseAlSuperior
        *CONFIG_LAYOUT
            .FUERZAS
            .superior;
    modelo.nodos.forEach(nodo => {
            if (!nodo.superior || nodo.ubicacionRef !== nodo.superior.ubicacionRef) {
                return;
            }
            const dx = nodo.superior.x - nodo.x;
            const dy = nodo.superior.y -nodo.y;
            const desplazamiento = desplazamientos.get(nodo.id);
                desplazamiento.x += dx * peso;
                desplazamiento.y += dy * peso;
        }
    );
}

    /* ---------------FUERZA: COLISIONES--------------- */
function aplicarFuerzaColision(modelo, desplazamientos) {
    const peso =
        CONFIG_LAYOUT
            .PESOS
            .evitarColisiones
        * CONFIG_LAYOUT
            .FUERZAS
            .colision;
    modelo.ubicaciones.forEach(ubicacion => {
            aplicarColisionesDentroUbicacion(
                ubicacion,
                desplazamientos,
                peso
            );
        }
    );
}

function aplicarColisionesDentroUbicacion(
    ubicacion,
    desplazamientos,
    peso
) {
    const nodos = ubicacion.nodos;
    for (let i = 0;
        i < nodos.length;
        i++
    ) {
        for (let j = i + 1;
            j < nodos.length;
            j++
        ) {
            separarParNodos(
                nodos[i],
                nodos[j],
                desplazamientos,
                peso
            );
        }
    }
}

function separarParNodos(a, b, desplazamientos, peso) {
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    let distancia = Math.hypot(dx, dy);
    if (distancia === 0) {
    const direccion = obtenerDireccionDeterminista(a.id, b.id);
    dx = direccion.x;
    dy = direccion.y;
    distancia = 1;
}
 
    const distanciaMinima = a.radio
        + b.radio
        + CONFIG_LAYOUT
            .DISTANCIAS
            .margenColision;
    if (distancia >= distanciaMinima) {
        return;
    }
    const solapamiento = distanciaMinima - distancia;
    const ux = dx / distancia;
    const uy = dy / distancia;
    const fuerza = solapamiento * 0.5 * peso;
    const desplazamientoA = desplazamientos.get(a.id);
    const desplazamientoB = desplazamientos.get(b.id);
    desplazamientoA.x -= ux * fuerza;
    desplazamientoA.y -= uy * fuerza;
    desplazamientoB.x += ux * fuerza;
    desplazamientoB.y += uy * fuerza;
}

    /* ---------------RESORTE JERÁRQUICO--------------- */
function aplicarResorte(a, b, distanciaObjetivo, peso, desplazamientos) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distancia = Math.hypot(dx,dy) || 1;
    const diferencia = distancia - distanciaObjetivo;
    const ux = dx / distancia;
    const uy = dy / distancia;
    const fuerza = diferencia * peso * 0.5;
    const desplazamientoA = desplazamientos.get(a.id);
    const desplazamientoB = desplazamientos.get(b.id);
          desplazamientoA.x += ux * fuerza;
          desplazamientoA.y += uy * fuerza;
          desplazamientoB.x -= ux * fuerza;
          desplazamientoB.y -= uy * fuerza;
}

    /* ---------------APLICACIÓN DE DESPLAZAMIENTOS--------------- */
function aplicarDesplazamientos(
    nodos,
    desplazamientos,
    intensidad
) {
    nodos.forEach(nodo => {
            if (nodo.esRaizGlobal) {
                return;
            }
            const desplazamiento =
                desplazamientos.get(nodo.id);
            nodo.x += limitarValor(desplazamiento.x, -8, 8)
                * intensidad;
            nodo.y += limitarValor(desplazamiento.y, -8, 8)
                * intensidad;
        }
    );
}

    /* ---------------PASADA FINAL DE COLISIONES--------------- */
function resolverColisiones(modelo) {
    const iteraciones =
        CONFIG_LAYOUT
            .SIMULACION
            .iteracionesColisionFinal;
    for (let iteracion = 0;
        iteracion < iteraciones; iteracion++) {
        const desplazamientos =
            crearMapaDesplazamientos(modelo.nodos);
        aplicarFuerzaColision(modelo, desplazamientos);
        aplicarDesplazamientos(modelo.nodos, desplazamientos, 0.65);
    }
}

function recalcularRadiosPostSimulacion(modelo) {
    modelo.ubicaciones.forEach( ubicacion => {
            recalcularRadioUbicacionFinal(ubicacion);
        }
    );

    modelo.clusters.forEach(cluster => {
            calcularRadioCluster(cluster);
        }
    );
}

function recalcularRadioUbicacionFinal(ubicacion) {
    const centroX = ubicacion.cluster.x
        + ubicacion.xLocal;
    const centroY = ubicacion.cluster.y
        + ubicacion.yLocal;
    let radio = 0;
    ubicacion.nodos.forEach( nodo => {
            const distancia =Math.hypot(
                    nodo.x - centroX,
                    nodo.y - centroY
                )
                + nodo.radio;
            radio = Math.max(radio, distancia);
        }
    );
    ubicacion.radio = radio
        +CONFIG_LAYOUT
            .ESCALA
            .crecimientoUbicacion;
}

    /* ---------------NORMALIZACIÓN--------------- */
function normalizarMapa(modelo) {
    const margen =
        CONFIG_LAYOUT
            .DISTANCIAS
            .margenMapa;

    let alcanceMaximo = 0;
    modelo.nodos.forEach(
        nodo => {
            const alcanceX = Math.abs(nodo.x)
                + nodo.radio;
            const alcanceY = Math.abs(nodo.y)
                + nodo.radio;
            alcanceMaximo = Math.max(
                    alcanceMaximo,
                    alcanceX,
                    alcanceY
                );
        }
    );
    const semilado = alcanceMaximo + margen;
    const lado = semilado * 2;
    modelo.nodos.forEach(
        nodo => {
            nodo.x += semilado;
            nodo.y += semilado;
        }
    );
    modelo.clusters.forEach(
        cluster => { cluster.x += semilado;
            cluster.y += semilado;
        }
    );

    modelo.svg.setAttribute( "viewBox", `0 0 ${lado} ${lado}`);
}

function calcularLimites(nodos) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    nodos.forEach(nodo => {
            minX = Math.min(minX, nodo.x - nodo.radio);
            minY = Math.min( minY, nodo.y - nodo.radio);
            maxX = Math.max( maxX, nodo.x + nodo.radio);
            maxY = Math.max( maxY, nodo.y + nodo.radio);
        }
    );
    return {minX, minY, maxX, maxY};
}

/* ---------------PAN Y ZOOM--------------- */
function configurarInteraccionVista(modelo) {
    const svg = modelo.svg;
    svg.addEventListener("wheel", evento => manejarRuedaVista(modelo, evento),
        {passive: false});
    svg.addEventListener("pointerdown", evento => iniciarArrastreVista(modelo,evento));
    svg.addEventListener("pointermove", evento => moverVista(modelo, evento));
    svg.addEventListener("pointerup", evento => finalizarArrastreVista(modelo, evento));
    svg.addEventListener("pointercancel", evento => cancelarArrastreVista(modelo, evento));
    svg.addEventListener("click",evento => manejarClickFondoVista( modelo, evento));
    svg.addEventListener( "dblclick", evento => { evento.preventDefault();
                                                 if ( modelo.vista.modo === "cluster") {
              salirVistaCluster(modelo);
              return;
          }
          restablecerVista(modelo);
      }
  );
}

function manejarRuedaVista(modelo, evento) {
    evento.preventDefault();
    const vista = modelo.vista;
    const configuracion =
        CONFIG_LAYOUT
            .VISTA;
    const factor = evento.deltaY < 0
            ? configuracion.factorRueda : 1 / configuracion.factorRueda;
    const escalaAnterior = vista.escala;
    const escalaNueva = limitarValor(escalaAnterior* factor, configuracion.zoomMinimo,
            configuracion.zoomMaximo);
    if (escalaNueva === escalaAnterior) {
        return;
    }
    const puntoCursor = obtenerPuntoSVG(modelo.svg, evento.clientX, evento.clientY);
    const puntoLocalX = (puntoCursor.x - vista.desplazamientoX) / escalaAnterior;
    const puntoLocalY = (puntoCursor.y - vista.desplazamientoY) / escalaAnterior;
    vista.escala = escalaNueva;
    vista.desplazamientoX = puntoCursor.x - puntoLocalX * escalaNueva;
    vista.desplazamientoY = puntoCursor.y - puntoLocalY * escalaNueva;
    ocultarEtiquetaNodo();
    aplicarTransformacionVista(modelo);
}

function iniciarArrastreVista(modelo,evento) {
    if (evento.button !== 0) {
        return;
    }
    const vista = modelo.vista;
    const punto = obtenerPuntoSVG(modelo.svg, evento.clientX, evento.clientY);
    vista.arrastrando = true;
    vista.huboArrastre = false;
    vista.punteroId = evento.pointerId;
    vista.inicioClienteX = evento.clientX;
    vista.inicioClienteY = evento.clientY;
    vista.inicioSVGX = punto.x;
    vista.inicioSVGY = punto.y;
    vista.desplazamientoInicialX = vista.desplazamientoX;
    vista.desplazamientoInicialY = vista.desplazamientoY;
}

function moverVista(modelo,evento) {
    const vista = modelo.vista;
    if (!vista.arrastrando || evento.pointerId !== vista.punteroId) {
        return;
    }
    const movimientoCliente = Math.hypot( evento.clientX - vista.inicioClienteX,
                                         evento.clientY - vista.inicioClienteY);
    if (!vista.huboArrastre && movimientoCliente <
        CONFIG_LAYOUT
            .VISTA
            .umbralArrastre
    ) {
        return;
    }
    if (!vista.huboArrastre) {vista.huboArrastre = true;
    ocultarEtiquetaNodo();
    modelo.svg.setPointerCapture(evento.pointerId);
}
    evento.preventDefault();
    const puntoActual = obtenerPuntoSVG(modelo.svg, evento.clientX, evento.clientY);
    vista.desplazamientoX = vista.desplazamientoInicialX + puntoActual.x - vista.inicioSVGX;
    vista.desplazamientoY = vista.desplazamientoInicialY + puntoActual.y - vista.inicioSVGY;
    aplicarTransformacionVista(modelo);
}

function finalizarArrastreVista(modelo, evento) {
    const vista = modelo.vista;
    if ( evento.pointerId !== vista.punteroId) {
        return;
    }
    if (vista.huboArrastre) {
        vista.suprimirProximoClick = true;
    }
    liberarCapturaPuntero(modelo.svg, evento.pointerId);
    vista.arrastrando = false;
    vista.punteroId = null;
}

function cancelarArrastreVista(modelo, evento) {
    const vista = modelo.vista;
    if (evento.pointerId !== vista.punteroId) {
        return;
    }
    liberarCapturaPuntero(modelo.svg, evento.pointerId);
    vista.arrastrando = false;
    vista.huboArrastre = false;
    vista.punteroId = null;
}

function liberarCapturaPuntero(svg, pointerId) {
    if (svg.hasPointerCapture(pointerId)) {
        svg.releasePointerCapture(pointerId);
    }
}

function manejarClickFondoVista(modelo) {
    if (consumirClickSuprimido(modelo)) {
        return;
    }
    limpiarResaltadoJerarquia(modelo);
    ocultarEtiquetaNodo();
}

function consumirClickSuprimido(modelo) {
    if (
        !modelo
            .vista
            .suprimirProximoClick
    ) {
        return false;
    }
    modelo
        .vista
        .suprimirProximoClick =
        false;
    return true;
}

function restablecerVista(modelo) 
{
    const vista = modelo.vista;
    mostrarMapaCompleto(modelo);
    vista.escala = 1;
    vista.desplazamientoX = 0;
    vista.desplazamientoY = 0;
    vista.modo = "mapa";
    vista.clusterActivo = null;
    vista.vistaAnterior = null;
    vista.arrastrando = false;
    vista.huboArrastre = false;
    vista.suprimirProximoClick = false;
    vista.punteroId = null;
    limpiarResaltadoJerarquia(modelo);
    ocultarEtiquetaNodo();
    aplicarTransformacionVista(modelo);
}

function aplicarTransformacionVista(modelo) {
    const vista = modelo.vista;
    modelo.viewport.setAttribute(
        "transform",
        [
            `translate(`,
            `${vista.desplazamientoX} `,
            `${vista.desplazamientoY}`,
            `) `,
            `scale(`,
            `${vista.escala}`,
            `)`
        ].join("")
    );
}

function obtenerPuntoSVG(svg, clienteX, clienteY) {
    const punto = svg.createSVGPoint();
    punto.x = clienteX;
    punto.y = clienteY;
    const matriz = svg.getScreenCTM();
    if (!matriz) {
        return {x: 0,y: 0};
    }
    const transformado = punto.matrixTransform(matriz.inverse());
    return {x: transformado.x, y: transformado.y};
}

/* ---------------VISTA AISLADA DE CLUSTER--------------- */

function alternarVistaCluster(modelo, cluster) {
    if (!cluster || cluster.nodos.length < 10) {
        return;
    }
    if (modelo.vista.modo ==="cluster") {
        salirVistaCluster(modelo);
        return;
    }
    entrarVistaCluster(modelo, cluster);
}

function entrarVistaCluster(modelo, cluster) {
    const vista = modelo.vista;
    vista.vistaAnterior = {
        escala: vista.escala,
        desplazamientoX: vista.desplazamientoX,
        desplazamientoY: vista.desplazamientoY
    };
    vista.modo = "cluster";
    vista.clusterActivo = cluster.id;
    ocultarEtiquetaNodo();
    aplicarVisibilidadCluster(modelo, cluster.id);
    enfocarCluster(modelo, cluster);
}

function salirVistaCluster(modelo) {
    const vista = modelo.vista;
    mostrarMapaCompleto(modelo);

    if (vista.vistaAnterior) {
        vista.escala = vista
                .vistaAnterior
                .escala;
        vista.desplazamientoX = vista
                .vistaAnterior
                .desplazamientoX;
        vista.desplazamientoY = vista
                .vistaAnterior
                .desplazamientoY;
    }
    else {
        vista.escala = 1;
        vista.desplazamientoX = 0;
        vista.desplazamientoY = 0;
    }
    vista.modo = "mapa";
    vista.clusterActivo = null;
    vista.vistaAnterior = null;
    ocultarEtiquetaNodo();
    aplicarTransformacionVista(modelo);
}

function aplicarVisibilidadCluster(modelo, clusterId) {
    const nodos = modelo
            .capas
            .nodos
            .querySelectorAll(".mapa-redes__nodo");

    nodos.forEach(elemento => {
            const pertenece = elemento.dataset
                    .clusterId === clusterId;
            elemento.style.display = pertenece
                    ? ""
                    : "none";
        }
    );

    const conexiones = modelo
            .capas
            .conexiones
            .querySelectorAll(".mapa-redes__conexion");

    conexiones.forEach( elemento => {
            const superior = elemento.dataset
                    .clusterSuperior;
            const subordinado = elemento.dataset
                    .clusterSubordinado;
            const esInterna = superior === clusterId
                && subordinado === clusterId;
            elemento.style.display = esInterna
                    ? ""
                    : "none";
        }
    );
}

function mostrarMapaCompleto(modelo) {
    modelo
        .capas
        .nodos
        .querySelectorAll(".mapa-redes__nodo")
        .forEach(
            elemento => {
                elemento.style.display = "";
            }
        );

    modelo
        .capas
        .conexiones
        .querySelectorAll(".mapa-redes__conexion")
        .forEach(
            elemento => {
                elemento.style.display = "";
            }
        );
}

function enfocarCluster(modelo, cluster) {
    requestAnimationFrame(() => {
            const cajaVisible = modelo
                    .capas
                    .nodos
                    .getBBox();
            if (cajaVisible.width <= 0 || cajaVisible.height <= 0) {
                return;
            }
            const viewBox = modelo
                    .svg
                    .viewBox
                    .baseVal;
            const margen = 0.82;
            const escalaHorizontal = (viewBox.width * margen)
                / cajaVisible.width;
            const escalaVertical = (viewBox.height * margen)
                / cajaVisible.height;
            const escalaObjetivo =
                limitarValor(
                    Math.min(escalaHorizontal, escalaVertical),
                    CONFIG_LAYOUT
                        .VISTA
                        .zoomMinimo,
                    CONFIG_LAYOUT
                        .VISTA
                        .zoomMaximo
                );
            const centroClusterX = cajaVisible.x + cajaVisible.width / 2;
            const centroClusterY = cajaVisible.y + cajaVisible.height / 2;
            const centroVistaX = viewBox.x + viewBox.width / 2;
            const centroVistaY = viewBox.y + viewBox.height / 2;
            modelo.vista.escala = escalaObjetivo;
            modelo.vista.desplazamientoX = centroVistaX - centroClusterX * escalaObjetivo;
            modelo.vista.desplazamientoY = centroVistaY - centroClusterY * escalaObjetivo;
            aplicarTransformacionVista(modelo);
        }
    );
}

/* ---------------RESALTADO JERÁRQUICO--------------- */
function resaltarJerarquiaNodo(modelo, nodoSeleccionado) {
    limpiarResaltadoJerarquia(modelo);

    const nodosRelacionados = obtenerNodosJerarquiaDestacados(nodoSeleccionado);

    const idsRelacionados = new Set(
            nodosRelacionados.map(nodo => nodo.id)
        );

    modelo
        .capas
        .nodos
        .querySelectorAll(".mapa-redes__nodo")
        .forEach(elemento => {
                if (elemento.style.display === "none") {
                    return;
                }
                const id = elemento.dataset.id;
                if (id === nodoSeleccionado.id) {
                    elemento.classList.add("mapa-redes__nodo--seleccionado");
                    return;
                }
                if (idsRelacionados.has(id)) {
                    elemento.classList.add("mapa-redes__nodo--relacionado");
                }
            }
        );

    modelo
        .capas
        .conexiones
        .querySelectorAll(".mapa-redes__conexion")
        .forEach(elemento => {
                if (elemento.style.display === "none") {
                    return;
                }

                elemento.classList.add("mapa-redes__conexion--atenuada");
                const superiorId = elemento.dataset
                        .superiorId;
                const subordinadoId = elemento.dataset
                        .subordinadoId;

                if (
                    esConexionJerarquicaDestacada(
                        nodoSeleccionado,
                        superiorId,
                        subordinadoId
                    )
                ) {
                    elemento.classList.remove("mapa-redes__conexion--atenuada");
                    elemento.classList.add("mapa-redes__conexion--destacada");
                }
            }
        );
}

function obtenerNodosJerarquiaDestacados(nodoSeleccionado) {
    const resultado = new Map();
    resultado.set(nodoSeleccionado.id, nodoSeleccionado);
    let superior = nodoSeleccionado.superior;
    while (superior) {
        resultado.set(superior.id, superior);
        superior = superior.superior;
    }
    nodoSeleccionado
        .subordinados
        .forEach(subordinado => {
                resultado.set(subordinado.id, subordinado);
            }
        );
    return [...resultado.values()];
}

function esConexionJerarquicaDestacada(
    nodoSeleccionado,
    superiorId,
    subordinadoId
) {
    if (superiorId === nodoSeleccionado.id
        && nodoSeleccionado
            .subordinados
            .some(nodo => nodo.id === subordinadoId )
    ) {
        return true;
    }
    let nodoActual = nodoSeleccionado;
    while (nodoActual.superior) {
        if (superiorId === nodoActual.superior.id
            && subordinadoId === nodoActual.id
        ) {
            return true;
        }
        nodoActual = nodoActual.superior;
    }
    return false;
}
function limpiarResaltadoJerarquia(modelo) {
    modelo
        .capas
        .nodos
        .querySelectorAll(".mapa-redes__nodo")
        .forEach(
            elemento => {
                elemento.classList.remove(
                    "mapa-redes__nodo--seleccionado",
                    "mapa-redes__nodo--relacionado"
                );
            }
        );
    modelo
        .capas
        .conexiones
        .querySelectorAll(".mapa-redes__conexion")
        .forEach(
            elemento => {
                elemento.classList.remove(
                    "mapa-redes__conexion--destacada",
                    "mapa-redes__conexion--atenuada"
                );
            }
        );
}

    /* ---------------RENDERIZADO--------------- */
function dibujarMapa(modelo) {
    dibujarConexiones(modelo);
    dibujarNodos(modelo);
}

 /* ---------------CONEXIONES--------------- */
function dibujarConexiones(modelo) {
    const fragmento = document.createDocumentFragment();
    modelo.conexiones.forEach(
        conexion => {
            fragmento.append(
                crearSVG("line",
                    {
                        class: "mapa-redes__conexion",
                        x1: conexion.superior.x,
                        y1: conexion.superior.y,
                        x2: conexion.subordinado.x,
                        y2: conexion.subordinado.y,
                        "data-cluster-superior": conexion.superior.clusterRef.id,
                        "data-cluster-subordinado": conexion.subordinado.clusterRef.id,
                        "data-superior-id": conexion.superior.id,
                        "data-subordinado-id": conexion.subordinado.id
                        }
                     )
            );
        }
    );
    modelo.capas.conexiones.append(fragmento);
}

 /* ---------------NODOS--------------- */
function dibujarNodos(modelo) {
    const fragmento = document.createDocumentFragment();
    modelo.nodos.forEach(nodo => {
            const grupo = crearGrupoNodo(nodo, modelo);
            fragmento.append(grupo);
        }
    );
    modelo
        .capas
        .nodos
        .append(fragmento);
}

function crearGrupoNodo(nodo, modelo) {
    const clases = ["mapa-redes__nodo"];
    if (nodo.esRaizGlobal) {
        clases.push("mapa-redes__nodo--raiz");
    }
    const grupo = crearSVG( "g",
            {
                class: clases.join(" "),
                transform: `translate(${nodo.x} ${nodo.y})`,
                "data-id": nodo.id,
                "data-cluster-id": nodo.clusterRef.id,
                "data-ubicacion": nodo.datos.ubicacion,
                "data-superior": nodo.datos.reportaA ?? ""
            }
        );
    const circulo = crearSVG("circle",
            {
                class:"mapa-redes__circulo",
                cx: 0,
                cy: 0,
                r: nodo.radio
            }
        );
    grupo.append(circulo);
grupo.addEventListener("click",
    evento => {
        evento.stopPropagation();
        if (consumirClickSuprimido(modelo)) {
            return;
        }
        resaltarJerarquiaNodo(modelo, nodo);
        mostrarEtiquetaNodo(nodo, evento);
    }
);
grupo.addEventListener("dblclick",
    evento => {evento.preventDefault();
        evento.stopPropagation();
        limpiarResaltadoJerarquia(modelo);
        ocultarEtiquetaNodo();
        alternarVistaCluster(modelo, nodo.clusterRef);
    }
);
return grupo;
}

function construirTituloNodo(nodo) {
    const partes = [];
    if (nodo.datos.nombre) {partes.push(nodo.datos.nombre);
    }
    if (nodo.datos.cargo) {
        partes.push(nodo.datos.cargo);
    }
    partes.push(nodo.datos.cluster);
    partes.push(nodo.datos.ubicacion);
    return partes.join(" · ");
}
 /* ---------------ETIQUETAS--------------- */
function mostrarEtiquetaNodo(nodo,evento) {
    const contenedor = document.querySelector(
            CONFIG_LAYOUT
                .SELECTORES
                .contenedor
        );
    if (!contenedor) {
        return;
    }
    ocultarEtiquetaNodo();
    const etiqueta = document.createElement("div");
    etiqueta.className = "etiqueta-nodo";
    etiqueta.dataset.nodoId = nodo.id;
    const nombre = document.createElement("strong");
    nombre.textContent = nodo.datos.nombre || "Sin nombre";
    const cargo = document.createElement("span");
    cargo.textContent = nodo.datos.cargo || "Sin cargo";
    const equipo = document.createElement("small");
    equipo.textContent = nodo.datos.equipo || "Sin equipo";
    etiqueta.append(nombre, cargo, equipo);
    contenedor.append(etiqueta);
    posicionarEtiquetaNodo(etiqueta, evento, contenedor);
}

function posicionarEtiquetaNodo(
    etiqueta,
    evento,
    contenedor
) {
    const rectContenedor = contenedor
            .getBoundingClientRect();
    const margen = 10;
    const separacionNodo = 14;
    const xClick = evento.clientX - rectContenedor.left;
    const yClick = evento.clientY - rectContenedor.top;
    const anchoEtiqueta = etiqueta.offsetWidth;
    const altoEtiqueta = etiqueta.offsetHeight;
    let izquierda = xClick - anchoEtiqueta / 2;
    izquierda = limitarValor(
            izquierda,
            margen,
            rectContenedor.width - anchoEtiqueta - margen);
    let arriba = yClick - altoEtiqueta - separacionNodo;
    if (arriba < margen) {
        arriba = yClick + separacionNodo;
    }
    arriba = limitarValor(
            arriba,
            margen,
            rectContenedor.height - altoEtiqueta - margen);
    etiqueta.style.left = `${izquierda}px`;
    etiqueta.style.top = `${arriba}px`;
}

function ocultarEtiquetaNodo() {
    const etiqueta =
        document.querySelector(".etiqueta-nodo");
    if (etiqueta) {
        etiqueta.remove();
    }
}

 /* ---------------ERRORES--------------- */
function mostrarError(error) {
    const contenedor = document.querySelector(
            CONFIG_LAYOUT
                .SELECTORES
                .contenedor
        );
    if (!contenedor)
        return;
    const mensaje = document.createElement("div");
    mensaje.className = "mapa-redes__error";
    mensaje.textContent = error instanceof Error
            ? error.message
            : "No fue posible construir el mapa.";
    contenedor.replaceChildren(mensaje);
}

 /* ---------------UTILIDADES SVG--------------- */
     function crearSVG(etiqueta, atributos = {}) {
    const elemento =
        document.createElementNS(
            "http://www.w3.org/2000/svg",
            etiqueta
        );
    Object.entries(atributos).forEach(([nombre, valor]) => {
            if (valor === undefined || valor === null) {
                return;
            }
            elemento.setAttribute(nombre, String(valor));
        }
    );
    return elemento;
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

function obtenerAnguloDeterminista(valor) {
    const texto = String(valor);
    let hash = 2166136261;
    for (let indice = 0;
        indice < texto.length;
        indice++) {
        hash ^= texto.charCodeAt(indice);
        hash = Math.imul(hash, 16777619);
    }
    return (
        (hash >>> 0) / 4294967296) * Math.PI * 2;
}

function obtenerDireccionDeterminista(idA, idB) {
    const clave = String(idA) < String(idB)
            ? `${idA}|${idB}` : `${idB}|${idA}`;
    let hash = 2166136261;
    for (let indice = 0;
        indice < clave.length;
        indice++) {
        hash ^= clave.charCodeAt(indice);
        hash = Math.imul(hash, 16777619);
    }
    const proporcion = (hash >>> 0) / 4294967296;
    const angulo = proporcion * Math.PI * 2;
    return {
        x: Math.cos(angulo),
        y: Math.sin(angulo)
    };
}

function limitarValor(
    valor,
    minimo,
    maximo
) {
    return Math.max(
        minimo,
        Math.min(valor, maximo)
    );
}
