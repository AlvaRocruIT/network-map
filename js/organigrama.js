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

  const nodo = document.createElement("article");
  nodo.classList.add("nodo");

  const tipoVinculo = persona.tipoVinculo ?? "dependencia";
  nodo.classList.add(`vinculo-${tipoVinculo}`);

  nodo.innerHTML = `
    <strong>${persona.nombre}</strong>
    <span>${persona.cargo}</span>
    <small>${persona.equipo}</small>
  `;

  rama.appendChild(nodo);

  const subordinados = personas.filter(
    subordinado => subordinado.reportaA === persona.id
  );

  if (subordinados.length > 0) {
    const hijos = document.createElement("div");
    hijos.classList.add("subordinados");

    subordinados.forEach(subordinado => {
      hijos.appendChild(crearRama(subordinado, personas));
    });

    rama.appendChild(hijos);
  }

  return rama;
}
