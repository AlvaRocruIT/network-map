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
    const puntoActual = obtenerPuntoSVG
     (modelo.svg, evento.clientX, evento.clientY);
    vista.desplazamientoX = vista.desplazamientoInicialX 
     + puntoActual.x - vista.inicioSVGX;
    vista.desplazamientoY = vista.desplazamientoInicialY 
     + puntoActual.y - vista.inicioSVGY;
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

     /* ---------------UTILIDADES GENERALES--------------- */
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
