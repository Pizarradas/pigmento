// Pigmentos de cada capítulo, en sRGB 0–1.
//
// Son datos de la obra, no colores de interfaz: igual que los píxeles de una
// imagen, no pasan por los tokens de SYX. La regla 6 de AGENTS.md prohíbe
// colores literales en reglas y tokens CSS; por eso la paleta vive aquí, en una
// sola fuente que leen el shader y las muestras de color de la página.

export const ROMANTICISMO = {
  paper: [0.965, 0.945, 0.9],
  aureolin: [0.97, 0.8, 0.26], // aguada de cielo
  cadmio: [0.92, 0.42, 0.13], // sol
  tinta: [0.4, 0.35, 0.4], // tinta neutra: velos de nube, se agrisa con la aureolina sin verdear
  ultramar: [0.13, 0.2, 0.56], // mar, granula con fuerza
  siena: [0.52, 0.25, 0.11], // casco y mástiles
};

// Paleta cromática de ocho pigmentos puros, en el orden de las muestras.
export const PUNTILLISMO = [
  { name: 'Ultramar', rgb: [0.17, 0.22, 0.6] },
  { name: 'Cobalto', rgb: [0.24, 0.45, 0.8] },
  { name: 'Esmeralda', rgb: [0.08, 0.55, 0.42] },
  { name: 'Verde', rgb: [0.45, 0.68, 0.2] },
  { name: 'Amarillo', rgb: [0.98, 0.83, 0.17] },
  { name: 'Bermellón', rgb: [0.87, 0.23, 0.15] },
  { name: 'Violeta', rgb: [0.48, 0.3, 0.62] },
  { name: 'Blanco', rgb: [0.97, 0.96, 0.92] },
];

export const PUNTILLISMO_PAPER = [0.95, 0.93, 0.88];

export function rgbCss([r, g, b]) {
  return `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`;
}

// Carboncillo y ocre sobre roca (Paleolítico superior)
export const PREHISTORIA = {
  ground: [0.8, 0.7, 0.56], // caliza
  charcoal: [0.09, 0.075, 0.07], // carbón de pino
  ochre: [0.62, 0.24, 0.13], // ocre rojo
  chalk: [0.95, 0.93, 0.88],
};

// Carboncillo, difumino y tiza sobre papel azul preparado (carta azzurra)
export const RENACIMIENTO = {
  ground: [0.63, 0.67, 0.7],
  charcoal: [0.1, 0.1, 0.12],
  ochre: [0.62, 0.24, 0.13],
  chalk: [0.96, 0.95, 0.91], // tiza blanca para las luces
};

// Acrílico diluido en mancha sobre algodón crudo
export const CAMPO_DE_COLOR = {
  canvas: [0.87, 0.83, 0.75],
  stains: [
    [0.22, 0.52, 0.78], // cerúleo
    [0.86, 0.36, 0.55], // magenta claro
    [0.9, 0.68, 0.22], // ocre amarillo
    [0.28, 0.6, 0.46], // verde ftalo rebajado
  ],
};

// Acrílico opaco, cinta de carrocero y serigrafía
export const POP = {
  gesso: [0.95, 0.94, 0.91],
  yellow: [0.98, 0.8, 0.1],
  red: [0.86, 0.15, 0.13],
  blue: [0.1, 0.23, 0.62],
  tape: [0.86, 0.79, 0.62],
  dots: [0.86, 0.15, 0.2],
};
