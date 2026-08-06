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
    const svg = crearSVG("svg", {class:"mapa-redes"});
    const viewport = crearSVG("g",
            {class: "mapa-redes__viewport"}
        );
    const conexiones = crearSVG("g",
            {class: "mapa-redes__conexiones"}
        );
    const nodos = crearSVG("g",
            {class: "mapa-redes__nodos"}
        );
    viewport.append(conexiones, nodos);
    svg.append(viewport);
    contenedor.append(svg);
    modelo.svg = svg;
    modelo.viewport = viewport;
    modelo.capas = {conexiones, nodos};
    configurarInteraccionVista(modelo);
    aplicarTransformacionVista(modelo);

      /* ---------------RENDERIZADO--------------- */
function dibujarMapa(modelo) {
    dibujarConexiones(modelo);
    dibujarNodos(modelo);
}

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
