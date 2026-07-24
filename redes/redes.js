 /* ==========================================================================
 * Arquitectura
 *
 * 1. Configuración
 * 2. Inicialización
 * 3. Carga y validación
 * 4. Construcción del modelo
 * 5. Jerarquía
 * 6. Layout
 * 7. Render SVG
 * 8. Utilidades 
 
---------------------CONFIG--------------- */
const CONFIG_LAYOUT = {
    VINCULOS: {
        datos: "../data/organigrama.json"
    },
    SELECTORES: {
        contenedor: "#redes"
    },

    PESOS: {
        permanecerEnUbicacion: 0.23,
        permanecerEnCluster: 0.23,
        mantenerJerarquia: 0.16,
        evitarColisiones: 0.28,
        acercarseAlSuperior: 0.10
    },
    
    NODOS: {
        radioNormal: 5,
        radioRaiz: 8
    },

    DISTANCIAS: {
        jerarquiaLocal: 34,
        anilloLideres: 22,
        separacionRamas: 20,
        separacionUbicaciones: 70,
        separacionClusters: 150,
        margenColision: 5,
        margenMapa: 50
    },

    ESCALA: {
        crecimientoCluster: 24,
        crecimientoUbicacion: 18
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

    const json =
        await respuesta.json();
    const personas =
        Array.isArray(json)
            ? json
            : json.personas;
    validarPersonas(personas);
    return personas;
}

    /* ---------------VALIDACIONES--------------- */
function validarConfiguracion() {
    if (
        CONFIG_LAYOUT.VINCULOS.datos.includes("../data/organigrama.json")
    ) {
        throw new Error(
            "Debes configurar el vínculo del JSON."
        );
    }
    const suma = Object
        .values(CONFIG_LAYOUT.PESOS)
        .reduce(
            (a, b) => a + b,
            0
        );
    if (
        Math.abs(suma - 1) > 0.0001
    ) {
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
        if (
            ids.has(persona.id)
        ) {
            throw new Error(
                `ID duplicado: ${persona.id}`
            );
        }
        ids.add(persona.id);
    });
}

    /* ---------------CONSTRUCCION DEL MODELO--------------- */
function construirModelo(personas) {
    const nodos =
        prepararNodos(personas);
    const indice =
        crearIndiceNodos(nodos);
    vincularJerarquia(
        nodos,
        indice
    );
    const conexiones =
        prepararConexiones(nodos);
    const clusters =
        construirClusters(nodos);
    const ubicaciones =
        extraerUbicaciones(clusters);
    const raices =
        encontrarRaices(nodos);
    const raiz =
        seleccionarRaizGlobal(
            raices,
            nodos
        );
    calcularJerarquia(
        raices
    );
    detectarLideresLocales(
        ubicaciones
    );
    calcularJerarquiaLocal(
        ubicaciones
    );
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
        capas: null
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
    return new Map(
        nodos.map(
            nodo => [
                nodo.id,
                nodo
            ]
        )
    );
}

    /* ---------------JERARQUÍA--------------- */
function vincularJerarquia(
    nodos,
    indice
) {
    nodos.forEach(nodo => {
        if (!nodo.datos.reportaA)
            return;
        const superior =
            indice.get(
                nodo.datos.reportaA
            );
        if (!superior)
            return;
        nodo.superior =
            superior;
        superior
            .subordinados
            .push(nodo);
    });
}

function prepararConexiones(
    nodos
) {
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
    return nodos.filter(
        nodo =>
            nodo.superior === null
    );
}

function seleccionarRaizGlobal(
    raices,
    nodos
) {
    if (
        raices.length === 1
    ) {
        return raices[0];
    }
    if (
        raices.length > 1
    ) {
        return [...raices]
            .sort(
                (a, b) =>
                    calcularPesoRama(b)
                    -
                    calcularPesoRama(a)
            )[0];
    }
    return nodos[0];
}

function calcularJerarquia(raices) {
    const visitados =
        new Set();
    raices.forEach(
        raiz =>
            recorrerJerarquia(
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
    if (
        visitados.has(
            nodo.id
        )
    ) {
        return;
    }
    visitados.add(
        nodo.id
    );
    nodo.profundidadGlobal =
        profundidad;
    nodo.pesoRama =
        calcularPesoRama(nodo);
    nodo.subordinados.forEach(
        hijo =>
            recorrerJerarquia(
                hijo,
                profundidad + 1,
                visitados
            )
    );
}

function calcularPesoRama(nodo) {
    if (
        nodo.subordinados.length === 0
    ) {
        return 1;
    }
    let peso = 1;
    nodo.subordinados.forEach(
        hijo => {
            peso +=
                calcularPesoRama(
                    hijo
                );
        }
    );
    nodo.pesoRama =
        peso;
    return peso;
}

    /* ---------------CLUSTERS--------------- */
function construirClusters(nodos) {
    const mapa =
        new Map();
    nodos.forEach(nodo => {
        const nombre =
            nodo
                .datos
                .cluster;
        if (
            !mapa.has(nombre)
        ) {
            mapa.set(
                nombre,
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
        const cluster =
            mapa.get(nombre);
        cluster
            .nodos
            .push(nodo);
        nodo.clusterRef =
            cluster;
    });
    mapa.forEach(cluster => {
        cluster.ubicaciones =
            construirUbicaciones(cluster);
    });
    return [...mapa.values()];
}

    /* ---------------UBICACIONES--------------- */
function construirUbicaciones(cluster) {
    const mapa =
        new Map();
    cluster.nodos.forEach(nodo => {
        const nombre =
            nodo
                .datos
                .ubicacion;
        if (
            !mapa.has(nombre)
        ) {
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
        const ubicacion =
            mapa.get(nombre);
        ubicacion
            .nodos
            .push(
                nodo
            );
        nodo.ubicacionRef =
            ubicacion;
    });
    return [...mapa.values()];
}

function extraerUbicaciones(clusters) {
    return clusters.flatMap(
        cluster =>
            cluster.ubicaciones
    );
}

function detectarLideresLocales(
    ubicaciones
) {
    ubicaciones.forEach(
        ubicacion => {
            const ids =
                new Set(
                    ubicacion
                        .nodos
                        .map(
                            n => n.id
                        )
                );
            ubicacion.lideresLocales =
                ubicacion.nodos.filter(
                    nodo =>
                        !nodo.superior ||
                        !ids.has(
                         nodo
                                .superior
                                .id
                        )
                );
            if (
                ubicacion
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

function calcularJerarquiaLocal(
    ubicaciones
) {
    ubicaciones.forEach(
        ubicacion => {
            const visitados =
                new Set();
            ubicacion
                .lideresLocales
                .forEach(
                    lider =>
                        recorrerJerarquiaLocal(
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
        visitados.has(
            nodo.id
        )
    ) {
        return;
    }
    if (
        nodo
            .ubicacionRef !==
        ubicacion
    ) {
        return;
    }
    visitados.add(
        nodo.id
    );
    nodo.profundidadLocal =
        profundidad;
    nodo.subordinados.forEach(
        hijo =>
            recorrerJerarquiaLocal(
                hijo,
                ubicacion,
                profundidad + 1,
                visitados
            )
    );
}

    /* ---------------PREPARACIÓN SVG--------------- */
function prepararSVG(modelo) {
    const contenedor =
        document.querySelector(
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
    const svg =
        crearSVG(
            "svg",
            {
                class:"mapa-redes"
            }
        );
    const viewport =
        crearSVG(
            "g",
            {
                class: "mapa-redes__viewport"
            }
        );
    const conexiones =
        crearSVG(
            "g",
            {
                class: "mapa-redes__conexiones"
            }
        );
    const nodos =
        crearSVG(
            "g",
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
}

    /* ---------------CÁLCULO DEL LAYOUT--------------- */
function calcularLayout(modelo) {
    resolverLayoutUbicaciones(modelo);
    resolverLayoutClusters(modelo);
    resolverLayoutPersonas(modelo);
    simularLayout(modelo);
    resolverColisiones(modelo);
    normalizarMapa(modelo);
}

    /* ---------------LAYOUT DE UBICACIONES--------------- */
function resolverLayoutUbicaciones(modelo) {
    modelo.ubicaciones.forEach(ubicacion => {
        resolverLayoutUbicacion(
            ubicacion
        );
    });
}

function resolverLayoutUbicacion(ubicacion) {
    const lideres =
        ubicacion.lideresLocales;
    if (
        lideres.length === 1
    ) {
        lideres[0].xLocal = 0;
        lideres[0].yLocal = 0;
    }
    else {
        distribuirLideres(
            lideres
        );
    }
    lideres.forEach(
        lider =>
            distribuirRamaLocal(
                lider,
                0
            )
    );
    calcularRadioUbicacion(ubicacion);
}

function distribuirLideres(lideres) {
    const radio =
        CONFIG_LAYOUT
            .DISTANCIAS
            .anilloLideres;
    const paso =
        (Math.PI * 2)
        /
        lideres.length;
    lideres.forEach(
        (lider, indice) => {
            const angulo =
                indice * paso;
            lider.xLocal =
                Math.cos(angulo)
                * radio;
            lider.yLocal =
                Math.sin(angulo)
                * radio;
        }
    );
}

function distribuirRamaLocal(
    nodo,
    anguloBase
) {
    const hijos =
        nodo.subordinados.filter(
            hijo =>
                hijo.ubicacionRef ===
                nodo.ubicacionRef
        );
    if (
        hijos.length === 0
    ) {
        return;
    }
    const apertura =
        Math.PI * 0.90;
    const inicio =
        anguloBase
        -
        apertura / 2;
    const paso =
        hijos.length === 1
            ? 0
            : apertura
            /
            (hijos.length - 1);
    hijos.forEach(
        (hijo, indice) => {
            const angulo =
                inicio
                +
                paso * indice;
            const distancia =
                CONFIG_LAYOUT
                    .DISTANCIAS
                    .jerarquiaLocal
                +
                hijo.profundidadLocal
                *
                CONFIG_LAYOUT
                    .DISTANCIAS
                    .separacionRamas;
            hijo.angulo =
                angulo;
            hijo.xLocal =
                nodo.xLocal +
                Math.cos(angulo)
                * distancia;
            hijo.yLocal =
                nodo.yLocal +
                Math.sin(angulo)
                * distancia;
            distribuirRamaLocal(
                hijo,
                angulo
            );
        }
    );
}

function calcularRadioUbicacion(
    ubicacion
) {
    let radio = 0;
    ubicacion.nodos.forEach(
        nodo => {
            const distancia =
                Math.hypot(
                    nodo.xLocal,
                    nodo.yLocal
                );
            radio =
                Math.max(
                    radio,
                    distancia
                );
        }
    );
    ubicacion.radio =
        radio
        +
        CONFIG_LAYOUT
            .ESCALA
            .crecimientoUbicacion;
}

    /* ---------------LAYOUT DE CLUSTERS--------------- */
function resolverLayoutClusters(modelo) {
    modelo.clusters.forEach(
        cluster => {
            resolverLayoutCluster(
                cluster
            );
        }
    );
    distribuirClusters(
        modelo.clusters
    );
}

function resolverLayoutCluster(
    cluster
) {
    const ubicaciones =
        cluster.ubicaciones;
    if (
        ubicaciones.length === 1
    ) {
        ubicaciones[0].xLocal = 0;
        ubicaciones[0].yLocal = 0;
    }
    else {
        const paso =
            (Math.PI * 2)
            /
            ubicaciones.length;
        let radio = 0;
        ubicaciones.forEach(
            u => {
                radio +=
                    u.radio;
            }
        );
        radio /=
            ubicaciones.length;
        radio +=
            CONFIG_LAYOUT
                .DISTANCIAS
                .separacionUbicaciones;
        ubicaciones.forEach(
            (ubicacion, indice) => {
                const angulo =
                    indice * paso;
                ubicacion.xLocal =
                    Math.cos(angulo)
                    * radio;
                ubicacion.yLocal =
                    Math.sin(angulo)
                    * radio;
            }
        );
    }
    calcularRadioCluster(
        cluster
    );
}

function calcularRadioCluster(
    cluster
) {
    let radio = 0;
    cluster.ubicaciones.forEach(
        ubicacion => {
            const distancia =
                Math.hypot(
                    ubicacion.xLocal,
                    ubicacion.yLocal
                )
                +
                ubicacion.radio;
            radio =
                Math.max(
                    radio,
                    distancia
                );
        }
    );
    cluster.radio =
        radio
        +
        CONFIG_LAYOUT
            .ESCALA
            .crecimientoCluster;
}

function distribuirClusters(
    clusters
) {
    const paso =
        (Math.PI * 2)
        /
        clusters.length;
    let radio = 0;
    clusters.forEach(
        cluster => {
            radio +=
                cluster.radio;
        }
    );
    radio /=
        clusters.length;
    radio +=
        CONFIG_LAYOUT
            .DISTANCIAS
            .separacionClusters;
    clusters.forEach(
        (cluster, indice) => {
            const angulo =
                indice * paso;
            cluster.x =
                Math.cos(angulo)
                * radio;
            cluster.y =
                Math.sin(angulo)
                * radio;
        }
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
                            nodo.xBase =
                                cluster.x +
                                ubicacion.xLocal +
                                nodo.xLocal;
                            nodo.yBase =
                                cluster.y +
                                ubicacion.yLocal +
                                nodo.yLocal;
                            nodo.x =
                                nodo.xBase;
                            nodo.y =
                                nodo.yBase;
                        }
                    );
                }
            );
        }
    );
}

    /* ---------------SIMULACIÓN POR FUERZAS--------------- */
function simularLayout(modelo) {
    let intensidad =
        CONFIG_LAYOUT
            .SIMULACION
            .intensidadInicial;
    for (
        let iteracion = 0;
        iteracion <
        CONFIG_LAYOUT
            .SIMULACION
            .iteraciones;
        iteracion++
    ) {
        const desplazamientos =
            crearMapaDesplazamientos(
                modelo.nodos
            );
        aplicarFuerzaUbicacion(
            modelo,
            desplazamientos
        );
        aplicarFuerzaCluster(
            modelo,
            desplazamientos
        );
        aplicarFuerzaJerarquia(
            modelo,
            desplazamientos
        );
        aplicarFuerzaSuperior(
            modelo,
            desplazamientos
        );
        aplicarFuerzaColision(
            modelo,
            desplazamientos
        );
        aplicarDesplazamientos(
            modelo.nodos,
            desplazamientos,
            intensidad
        );
        intensidad *=
            CONFIG_LAYOUT
                .SIMULACION
                .enfriamiento;
    }
}

function crearMapaDesplazamientos(nodos) {
    const mapa =
        new Map();
    nodos.forEach(
        nodo => {
            mapa.set(
                nodo.id,
                {
                    x: 0,
                    y: 0
                }
            );
        }
    );
    return mapa;
}

    /* ---------------FUERZA: PERMANECER EN UBICACIÓN--------------- */
function aplicarFuerzaUbicacion(
    modelo,
    desplazamientos
) {
    const peso =
        CONFIG_LAYOUT
            .PESOS
            .permanecerEnUbicacion
        *
        CONFIG_LAYOUT
            .FUERZAS
            .ubicacion;
    modelo.nodos.forEach(
        nodo => {
            const centro =
                obtenerCentroUbicacion(
                    nodo
                );
            const dx =
                centro.x - nodo.x;
            const dy =
                centro.y - nodo.y;
            const desplazamiento =
                desplazamientos.get(
                    nodo.id
                );
            desplazamiento.x +=
                dx * peso;
            desplazamiento.y +=
                dy * peso;
        }
    );
}

function obtenerCentroUbicacion(
    nodo
) {
    return {
        x:
            nodo
                .clusterRef
                .x
            +
            nodo
                .ubicacionRef
                .xLocal,
        y:
            nodo
                .clusterRef
                .y
            +
            nodo
                .ubicacionRef
                .yLocal
    };
}

    /* ---------------FUERZA: PERMANECER EN CLUSTER--------------- */
function aplicarFuerzaCluster(
    modelo,
    desplazamientos
) {
    const peso =
        CONFIG_LAYOUT
            .PESOS
            .permanecerEnCluster
        *
        CONFIG_LAYOUT
            .FUERZAS
            .cluster;
    modelo.nodos.forEach(
        nodo => {
            const cluster =
                nodo.clusterRef;
            const dx =
                cluster.x - nodo.x;
            const dy =
                cluster.y - nodo.y;
            const desplazamiento =
                desplazamientos.get(
                    nodo.id
                );
            desplazamiento.x +=
                dx * peso;
            desplazamiento.y +=
                dy * peso;
        }
    );
}

    /* ---------------FUERZA: MANTENER JERARQUÍA--------------- */
function aplicarFuerzaJerarquia(
    modelo,
    desplazamientos
) {
    const peso =
        CONFIG_LAYOUT
            .PESOS
            .mantenerJerarquia
        *
        CONFIG_LAYOUT
            .FUERZAS
            .jerarquia;
    modelo.conexiones.forEach(
        conexion => {
            const superior =
                conexion.superior;
            const subordinado =
                conexion.subordinado;
            const distanciaObjetivo =
                conexion.mismaUbicacion
                    ? CONFIG_LAYOUT
                        .DISTANCIAS
                        .jerarquiaLocal
                    : CONFIG_LAYOUT
                        .DISTANCIAS
                        .separacionUbicaciones;
            aplicarResorte(
                superior,
                subordinado,
                distanciaObjetivo,
                peso,
                desplazamientos
            );
        }
    );
}

    /* ---------------FUERZA: ACERCARSE AL SUPERIOR--------------- */
function aplicarFuerzaSuperior(
    modelo,
    desplazamientos
) {
    const peso =
        CONFIG_LAYOUT
            .PESOS
            .acercarseAlSuperior
        *
        CONFIG_LAYOUT
            .FUERZAS
            .superior;
    modelo.nodos.forEach(
        nodo => {
            if (!nodo.superior)
                return;
            const dx =
                nodo.superior.x - nodo.x;
            const dy =
                nodo.superior.y - nodo.y;
            const desplazamiento =
                desplazamientos.get(
                    nodo.id
                );
            desplazamiento.x +=
                dx * peso;
            desplazamiento.y +=
                dy * peso;
        }
    );
}

    /* ---------------FUERZA: COLISIONES--------------- */
function aplicarFuerzaColision(
    modelo,
    desplazamientos
) {
    const peso =
        CONFIG_LAYOUT
            .PESOS
            .evitarColisiones
        *
        CONFIG_LAYOUT
            .FUERZAS
            .colision;
    const nodos =
        modelo.nodos;
    for (
        let i = 0;
        i < nodos.length;
        i++
    ) {
        for (
            let j = i + 1;
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
    };
}

function separarParNodos(
    a,
    b,
    desplazamientos,
    peso
) {
    let dx =
        b.x - a.x;
    let dy =
        b.y - a.y;
    let distancia =
        Math.hypot(
            dx,
            dy
        );
    if (
        distancia === 0
    ) {
        dx =
            Math.random() - 0.5;
        dy =
            Math.random() - 0.5;
        distancia =
            Math.hypot(
                dx,
                dy
            );
    }
    const distanciaMinima =
        a.radio
        +
        b.radio
        +
        CONFIG_LAYOUT
            .DISTANCIAS
            .margenColision;
    if (
        distancia >=
        distanciaMinima
    ) {
        return;
    }
    const solapamiento =
        distanciaMinima
        -
        distancia;
    const ux =
        dx / distancia;
    const uy =
        dy / distancia;
    const fuerza =
        solapamiento
        *
        0.5
        *
        peso;
    const desplazamientoA =
        desplazamientos.get(
            a.id
        );
    const desplazamientoB =
        desplazamientos.get(
            b.id
        );
    desplazamientoA.x -=
        ux * fuerza;
    desplazamientoA.y -=
        uy * fuerza;
    desplazamientoB.x +=
        ux * fuerza;
    desplazamientoB.y +=
        uy * fuerza;
}

    /* ---------------RESORTE JERÁRQUICO--------------- */
function aplicarResorte(
    a,
    b,
    distanciaObjetivo,
    peso,
    desplazamientos
) {
    const dx =
        b.x - a.x;
    const dy =
        b.y - a.y;
    const distancia =
        Math.hypot(
            dx,
            dy
        )
        || 1;
    const diferencia =
        distancia
        -
        distanciaObjetivo;
    const ux =
        dx / distancia;
    const uy =
        dy / distancia;
    const fuerza =
        diferencia
        *
        peso
        *
        0.5;
    const desplazamientoA =
        desplazamientos.get(
            a.id
        );
    const desplazamientoB =
        desplazamientos.get(
            b.id
        );
    desplazamientoA.x +=
        ux * fuerza;
    desplazamientoA.y +=
        uy * fuerza;
    desplazamientoB.x -=
        ux * fuerza;
    desplazamientoB.y -=
        uy * fuerza;
}

    /* ---------------APLICACIÓN DE DESPLAZAMIENTOS--------------- */
function aplicarDesplazamientos(
    nodos,
    desplazamientos,
    intensidad
) {
    nodos.forEach(
        nodo => {
            if (
                nodo.esRaizGlobal
            ) {
                return;
            }
            const desplazamiento =
                desplazamientos.get(
                    nodo.id
                );
            nodo.x +=
                limitarValor(
                    desplazamiento.x,
                    -8,
                    8
                )
                *
                intensidad;
            nodo.y +=
                limitarValor(
                    desplazamiento.y,
                    -8,
                    8
                )
                *
                intensidad;
        }
    );
}

    /* ---------------PASADA FINAL DE COLISIONES--------------- */
function resolverColisiones(
    modelo
) {
    const iteraciones =
        CONFIG_LAYOUT
            .SIMULACION
            .iteracionesColisionFinal;
    for (
        let iteracion = 0;
        iteracion < iteraciones;
        iteracion++
    ) {
        const desplazamientos =
            crearMapaDesplazamientos(
                modelo.nodos
            );
        aplicarFuerzaColision(
            modelo,
            desplazamientos
        );
        aplicarDesplazamientos(
            modelo.nodos,
            desplazamientos,
            0.65
        );
    }
}

    /* ---------------NORMALIZACIÓN--------------- */
function normalizarMapa(modelo) {
    const limites =
        calcularLimites(modelo.nodos);
    const margen =
        CONFIG_LAYOUT
            .DISTANCIAS
            .margenMapa;
    const desplazamientoX =
        margen
        -
        limites.minX;
    const desplazamientoY =
        margen
        -
        limites.minY;
    modelo.nodos.forEach(
        nodo => {
            nodo.x +=
                desplazamientoX;
            nodo.y +=
                desplazamientoY;
        }
    );
    const ancho =
        limites.maxX
        -
        limites.minX
        +
        margen * 2;
    const alto =
        limites.maxY
        -
        limites.minY
        +
        margen * 2;
    modelo.svg.setAttribute(
        "viewBox",
        `0 0 ${ancho} ${alto}`
    );
}

function calcularLimites(nodos) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    nodos.forEach(
        nodo => {
            minX =
                Math.min(
                    minX,
                    nodo.x - nodo.radio
                );
            minY =
                Math.min(
                    minY,
                    nodo.y - nodo.radio
                );
            maxX =
                Math.max(
                    maxX,
                    nodo.x + nodo.radio
                );
            maxY =
                Math.max(
                    maxY,
                    nodo.y + nodo.radio
                );
        }
    );
    return {
        minX,
        minY,
        maxX,
        maxY
    };
}

    /* ---------------RENDERIZADO--------------- */
function dibujarMapa(modelo) {
    dibujarConexiones(modelo);
    dibujarNodos(modelo);
}

 /* ---------------CONEXIONES--------------- */
function dibujarConexiones(modelo) {
    const fragmento =
        document.createDocumentFragment();
    modelo.conexiones.forEach(
        conexion => {
            const clase =
                conexion.mismaUbicacion
                    ? "mapa-redes__conexion mapa-redes__conexion--interna"
                    : "mapa-redes__conexion mapa-redes__conexion--externa";
            const linea =
                crearSVG(
                    "line",
                    {
                        class: clase,
                        x1: conexion.superior.x,
                        y1: conexion.superior.y,
                        x2: conexion.subordinado.x,
                        y2: conexion.subordinado.y,
                        "data-superior": conexion.superior.id,
                        "data-subordinado": conexion.subordinado.id
                    }
                );
            fragmento.append(linea);
        }
    );
    modelo
        .capas
        .conexiones
        .append(fragmento);
}

 /* ---------------NODOS--------------- */
function dibujarNodos(modelo) {
    const fragmento =
        document.createDocumentFragment();
    modelo.nodos.forEach(
        nodo => {
            const grupo = crearGrupoNodo(nodo);
            fragmento.append(grupo);
        }
    );
    modelo
        .capas
        .nodos
        .append(fragmento);
}

function crearGrupoNodo(nodo) {
    const clases = [
        "mapa-redes__nodo"
    ];
    if (nodo.esRaizGlobal) {
        clases.push(
            "mapa-redes__nodo--raiz"
        );
    }
    const grupo =
        crearSVG(
            "g",
            {
                class:
                    clases.join(" "),
                transform:
                    `translate(${nodo.x} ${nodo.y})`,
                "data-id":
                    nodo.id,
                "data-cluster":
                    nodo.datos.cluster,
                "data-ubicacion":
                    nodo.datos.ubicacion,
                "data-superior":
                    nodo.datos.reportaA ?? ""
            }
        );
    const circulo =
        crearSVG(
            "circle",
            {
                class: "mapa-redes__circulo",
                cx: 0,
                cy: 0,   
                r: nodo.radio
            }
        );
    const titulo =
        crearSVG("title");
    titulo.textContent =
        construirTituloNodo(nodo);
    grupo.append(
        circulo,
        titulo
    );
    return grupo;
}

function construirTituloNodo(nodo) {
    const partes = [];
    if (nodo.datos.nombre) {
        partes.push(nodo.datos.nombre);
    }
    if (nodo.datos.cargo) {
        partes.push(
            nodo.datos.cargo
        );
    }
    partes.push(nodo.datos.cluster);
    partes.push(nodo.datos.ubicacion);
    return partes.join(" · ");
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
    const mensaje =
        document.createElement("div");
    mensaje.className = "mapa-redes__error";
    mensaje.textContent = error instanceof Error
            ? error.message
            : "No fue posible construir el mapa.";
    contenedor.replaceChildren(mensaje);
}

 /* ---------------UTILIDADES SVG--------------- */
     function crearSVG(
    etiqueta,
    atributos = {}
) {
    const elemento =
        document.createElementNS(
            "http://www.w3.org/2000/svg",
            etiqueta
        );
    Object.entries(atributos).forEach(([nombre, valor]) => {
            if (
                valor === undefined ||
                valor === null
            ) {
                return;
            }
            elemento.setAttribute(
                nombre,
                String(valor)
            );
        }
    );
    return elemento;
}

 /* ---------------UTILIDADES GENERALES--------------- */
function slug(valor) {
    return String(valor)
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .toLowerCase()
        .trim()
        .replace(
            /[^a-z0-9]+/g,
            "-"
        )
        .replace(
            /^-+|-+$/g,
            ""
        );
}

function limitarValor(
    valor,
    minimo,
    maximo
) {
    return Math.max(
        minimo,
        Math.min(
            valor,
            maximo
        )
    );
}
