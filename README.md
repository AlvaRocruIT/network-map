# Red Organizacional - Especificación del Algoritmo

## Objetivo

Representar gráficamente una organización como una red navegable,
preservando la lectura jerárquica y minimizando cruces entre conexiones.

---

# Principios

## P1. Raíz

- Existe una única raíz.
- Permanece fija en el centro lógico del mapa.

## P2. Estructura

- El JSON es la única fuente de verdad.
- Todo cálculo se realiza sobre un modelo interno.

## P3. Peso

- Cada nodo posee un peso igual a:
    1 + todos sus descendientes.

## P4. Sectores

- Cada rama recibe un sector angular proporcional a su peso.
- Ningún nodo puede abandonar el sector de su rama.

## P5. Posición

- Las posiciones son dinámicas.
- No representan necesariamente profundidad jerárquica.

## P6. Fuerzas

Se consideran:

- repulsión
- atracción padre-hijo
- colisión
- permanencia en sector
- raíz fija

## P7. Cruces

Las conexiones jerárquicas no pueden cruzarse.

## P8. Zoom

El mapa utiliza un viewport independiente.
El zoom modifica únicamente la visualización.

## P9. Drag

No existe en V1.
La arquitectura debe permitir incorporarlo.

---

# Roadmap

☑ Construcción del árbol

☐ Cálculo de pesos

☐ Asignación de sectores

☐ Posición inicial

☐ Simulación

☐ Render SVG

☐ Zoom

☐ Drag (V2)
