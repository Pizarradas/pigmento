// Bisonte polícromo al modo de Altamira (dibujo original, no copia de ningún panel).
// Lienzo de 200 × 120 unidades, mira a la izquierda: cabeza baja, giba sobre las manos,
// cola levantada. Cada zona es una ruta SVG que se pinta en una máscara (Canvas 2D) y se
// usa en el shader; los contornos se dibujan además como trazos de carbón.

export const BISON_W = 200;
export const BISON_H = 120;

// Silueta completa: el ocre rojo cubre todo el cuerpo
export const SILHOUETTE = `
  M 26 88 C 20 82 18 72 22 62 C 25 52 32 44 40 40 C 46 26 58 12 76 10
  C 92 8 106 14 120 22 C 136 30 154 32 166 36 C 176 40 179 50 176 60
  C 174 68 170 74 168 80 C 168 92 168 100 170 110 C 168 112 164 112 163 110
  C 162 100 161 92 158 86 C 154 86 150 88 146 90 C 128 94 108 94 92 90
  C 90 98 88 104 88 110 C 86 112 82 112 81 110 C 81 102 80 96 78 90
  C 72 94 66 98 60 98 C 56 102 52 104 48 100 C 44 96 40 94 36 92
  C 32 92 29 90 26 88 Z`;

// Patas del lado lejano, algo más atrás y más oscuras
export const FAR_LEGS = [
  'M 68 92 C 68 100 68 104 67 109 C 69 111 72 111 73 109 C 73 102 74 96 74 90 Z',
  'M 150 88 C 152 96 153 102 155 108 C 157 110 160 110 160 108 C 159 100 158 94 157 86 Z',
];

// Zonas negras (carbón y manganeso): cabeza, crinera de la giba, barba, pezuñas, borla
export const BLACK = [
  // cabeza baja, con el morro como punto más bajo
  'M 26 88 C 20 82 18 72 22 62 C 25 52 32 44 40 40 C 46 46 48 58 46 70 C 44 80 40 88 36 92 C 32 92 29 90 26 88 Z',
  // crinera: cubre la giba y cae por delante de la cruz
  'M 40 40 C 46 26 58 12 76 10 C 84 9 90 10 96 12 C 88 22 82 36 78 52 C 70 56 58 56 50 52 C 48 48 44 44 40 40 Z',
  // barba y pelo del pecho
  'M 36 92 C 40 94 44 96 48 100 C 52 104 56 102 60 98 C 62 90 58 80 50 74 C 46 82 42 88 36 92 Z',
  // pezuñas
  'M 81 106 C 83 104 87 104 88 106 L 88 110 C 86 112 82 112 81 110 Z',
  'M 163 106 C 165 104 169 104 170 106 L 170 110 C 168 112 164 112 163 110 Z',
  'M 67 105 C 69 103 72 103 73 105 L 73 109 C 72 111 69 111 67 109 Z',
  'M 154 104 C 156 102 159 102 160 104 L 160 108 C 159 110 157 110 155 108 Z',
  // borla de la cola
  'M 185 72 C 190 72 193 80 189 88 C 185 85 183 79 185 72 Z',
];

// Sombreado de volumen: vientre, cara interna del muslo y paletilla
export const SHADE = [
  'M 92 82 C 108 88 130 88 146 82 C 150 86 148 90 146 90 C 128 94 108 94 92 90 Z',
  'M 148 50 C 158 56 164 66 166 78 C 160 76 154 70 150 62 Z',
  'M 78 56 C 84 66 84 80 80 90 C 76 86 74 76 76 64 Z',
];

// Contorno a carbón (sin Z: son trazos abiertos)
export const CONTOUR = [
  'M 40 40 C 46 26 58 12 76 10 C 92 8 106 14 120 22 C 136 30 154 32 166 36', // giba y lomo
  'M 166 36 C 176 40 179 50 176 60 C 174 68 170 74 168 80 C 168 92 168 100 170 110', // grupa y pata
  'M 158 86 C 154 86 150 88 146 90 C 128 94 108 94 92 90', // vientre
  'M 92 90 C 90 98 88 104 88 110', // mano, borde trasero
  'M 78 90 C 80 96 81 102 81 110', // mano, borde delantero
  'M 158 86 C 161 92 162 100 163 110', // pata, borde delantero
  'M 26 88 C 20 82 18 72 22 62 C 25 52 32 44 40 40', // testuz y cara
  'M 26 88 C 29 90 32 92 36 92 C 40 94 44 96 48 100 C 52 104 56 102 60 98 C 66 98 72 94 78 90', // barba y pecho
  'M 34 44 C 28 38 26 30 30 24', // cuerno
  'M 42 40 C 40 32 41 26 46 22', // cuerno lejano
  'M 170 40 C 181 36 188 44 186 56 C 185 64 184 70 187 78', // cola
  'M 31 60 L 35 61', // ojo
];

// Grabado: líneas finas raspadas en la piedra (pelo de la crinera)
export const ENGRAVING = [
  'M 60 22 L 64 38', 'M 66 16 L 70 34', 'M 72 12 L 75 30', 'M 78 11 L 80 28', 'M 84 11 L 84 26',
];

// Lomas de la pared que el pintor aprovecha: coinciden con el cuerpo, la giba y el muslo.
// [cx, cy, radio, altura] en unidades del dibujo / 120
export const BULGES = [
  [112 / 120, 52 / 120, 40 / 120, 1],
  [74 / 120, 26 / 120, 22 / 120, 0.8],
  [160 / 120, 62 / 120, 18 / 120, 0.6],
  [34 / 120, 66 / 120, 16 / 120, 0.5],
];
