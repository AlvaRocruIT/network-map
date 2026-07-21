document.addEventListener("DOMContentLoaded", cargarRed);

async function cargarRed() {
  const contenedor = document.getElementById("redes");

  try {
    const respuesta = await fetch("data/organigrama.json");

    if (!respuesta.ok) {
      throw new Error("No se pudo cargar organigrama.json");
    }

    const personas = await respuesta.json();

    validarDatos(personas);
    dibujarRed(personas, contenedor);

    window.addEventListener("resize", () => {
      dibujarConexiones(personas, contenedor);
    });

  } catch (error) {
    console.error(error);
    contenedor.textContent = "Error al cargar el mapa de redes.";
  }
}

function dibujarRed(personas, contenedor) {
  contenedor.innerHTML = "";

  const conexiones = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "svg"
  );

  conexiones.classList.add("conexiones-red");
  contenedor.appendChild(conexiones);

  const nodos = document.createElement("div");
  nodos.classList.add("nodos-red");

  personas.forEach(persona => {
    nodos.appendChild(crearNodo(persona));
  });

  contenedor.appendChild(nodos);

  requestAnimationFrame(() => {
    dibujarConexiones(personas, contenedor);
  });
}

function crearNodo(persona) {
  const nodo = document.createElement("article");

  nodo.id = `nodo-${persona.id}`;
  nodo.classList.add("nodo-red");

  nodo.innerHTML = `
    <strong>${persona.nombre}</strong>
    <span>${persona.cargo}</span>
    <small>${persona.equipo}</small>
  `;

  return nodo;
}

function dibujarConexiones(personas, contenedor) {
  const svg = contenedor.querySelector(".conexiones-red");
  const area = contenedor.getBoundingClientRect();

  svg.innerHTML = "";
  svg.setAttribute("width", area.width);
  svg.setAttribute("height", area.height);

  personas
    .filter(persona => persona.reportaA)
    .forEach(persona => {
      const subordinado = document.getElementById(`nodo-${persona.id}`);
      const lider = document.getElementById(`nodo-${persona.reportaA}`);

      if (!subordinado || !lider) return;

      const origen = subordinado.getBoundingClientRect();
      const destino = lider.getBoundingClientRect();

      const linea = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
      );

      linea.setAttribute("x1", origen.left + origen.width / 2 - area.left);
      linea.setAttribute("y1", origen.top + origen.height / 2 - area.top);
      linea.setAttribute("x2", destino.left + destino.width / 2 - area.left);
      linea.setAttribute("y2", destino.top + destino.height / 2 - area.top);
      linea.classList.add("conexion-red");

      svg.appendChild(linea);
    });
}

function validarDatos(personas) {
  const ids = new Set(personas.map(persona => persona.id));

  personas.forEach(persona => {
    if (!persona.id || !persona.nombre) {
      throw new Error("Cada persona necesita id y nombre.");
    }

    if (persona.reportaA && !ids.has(persona.reportaA)) {
      throw new Error(
        `${persona.nombre} reporta a un ID inexistente: ${persona.reportaA}`
      );
    }
  });
}
