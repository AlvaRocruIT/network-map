document.addEventListener("DOMContentLoaded", cargarOrganigrama);

async function cargarOrganigrama() {
  const contenedor = document.getElementById("organigrama");

  try {
    const respuesta = await fetch("data/organigrama.json");

    if (!respuesta.ok) {
      throw new Error("No se pudo cargar organigrama.json");
    }

    const personas = await respuesta.json();
    const raices = personas.filter(persona => persona.reportaA === null);

    contenedor.innerHTML = "";

    raices.forEach(raiz => {
      contenedor.appendChild(crearRama(raiz, personas));
    });
  } catch (error) {
    console.error(error);
    contenedor.textContent = "Error al cargar el organigrama.";
  }
}

function crearRama(persona, personas) {
  const rama = document.createElement("section");
  rama.classList.add("rama");

  // Nodo principal
  rama.appendChild(crearNodo(persona));

  const vinculados = personas.filter(
    candidato => candidato.reportaA === persona.id
  );

  const dependencias = vinculados.filter(
    candidato => candidato.tipoVinculo !== "pseudo"
  );

  const pseudodependencias = vinculados.filter(
    candidato => candidato.tipoVinculo === "pseudo"
  );

  // Pseudo-dependencias: lateral inferior derecha
  if (pseudodependencias.length > 0) {
    const pseudogrupo = document.createElement("div");
    pseudogrupo.classList.add("pseudo-dependencias");

    pseudodependencias.forEach(pseudo => {
      pseudogrupo.appendChild(crearNodo(pseudo));
    });

    rama.appendChild(pseudogrupo);
  }

  // Dependencias directas: debajo del líder
  if (dependencias.length > 0) {
    const hijos = document.createElement("div");
    hijos.classList.add("subordinados");

    dependencias.forEach(dependencia => {
      hijos.appendChild(crearRama(dependencia, personas));
    });

    rama.appendChild(hijos);
  }

  return rama;
}

function crearNodo(persona) {
  const nodo = document.createElement("article");
  nodo.classList.add("nodo");

  const tipo = persona.tipoVinculo === "pseudo"
    ? "pseudo"
    : "dependencia";

  nodo.classList.add(`vinculo-${tipo}`);

  nodo.innerHTML = `
    <strong>${persona.nombre}</strong>
    <span>${persona.cargo}</span>
    <small>${persona.equipo}</small>
  `;

  return nodo;
}
