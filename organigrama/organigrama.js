document.addEventListener("DOMContentLoaded", cargarOrganigrama);

async function cargarOrganigrama() {
  const contenedor = document.getElementById("organigrama");

  try {
    const respuesta = await fetch("../data/organigrama.json");

    if (!respuesta.ok) {
      throw new Error("No se pudo cargar organigrama.json");
    }

    const personas = await respuesta.json();

    const raices = personas.filter(
      persona => persona.reportaA === null
    );

    contenedor.innerHTML = "";

    const arbol = document.createElement("ul");
    arbol.classList.add("tree");

    raices.forEach(raiz => {
      arbol.appendChild(crearRama(raiz, personas));
    });

    contenedor.appendChild(arbol);

  } catch (error) {
    console.error(error);
    contenedor.textContent = "Error al cargar el organigrama.";
  }
}

function crearRama(persona, personas) {
  const item = document.createElement("li");

  const nodoWrap = document.createElement("div");
  nodoWrap.classList.add("nodo-wrap");
  nodoWrap.appendChild(crearNodo(persona));

  const vinculados = personas.filter(
    candidato => candidato.reportaA === persona.id
  );

  const dependencias = vinculados.filter(
    candidato => candidato.tipoVinculo !== "pseudo"
  );

  const pseudos = vinculados.filter(
    candidato => candidato.tipoVinculo === "pseudo"
  );

  if (pseudos.length > 0) {
    const pseudoRama = document.createElement("div");
    pseudoRama.classList.add("pseudo-rama");

    const pseudoLista = document.createElement("div");
    pseudoLista.classList.add("pseudo-lista");

    pseudos.forEach(pseudo => {
      pseudoLista.appendChild(crearNodo(pseudo));
    });

    pseudoRama.appendChild(pseudoLista);
    nodoWrap.appendChild(pseudoRama);
  }

  item.appendChild(nodoWrap);

  if (dependencias.length > 0) {
    const listaHijos = document.createElement("ul");

    dependencias.forEach(dependencia => {
      listaHijos.appendChild(crearRama(dependencia, personas));
    });

    item.appendChild(listaHijos);
  }

  return item;
}

function crearNodo(persona) {
  const nodo = document.createElement("article");
  nodo.classList.add("nodo");

  nodo.innerHTML = `
    <strong>${persona.nombre}</strong>
    <span>${persona.cargo}</span>
    <small>${persona.equipo}</small>
  `;

  return nodo;
}
