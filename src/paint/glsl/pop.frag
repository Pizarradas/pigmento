// Acrílico opaco de bordes duros: rodillo, cinta de carrocero, retirada y serigrafía.
// Las capas no se mezclan: cada una tapa la anterior. Lo que protegió la cinta
// aparece limpio al retirarla.

in vec2 v_uv;
out vec4 fragColor;

uniform vec2 u_size;
uniform float u_paint1; // amarillo, a rodillo de izquierda a derecha
uniform float u_tape; // cinta: cinco tiras, una tras otra
uniform float u_paint2; // rojo, de derecha a izquierda, por encima de la cinta
uniform float u_peel; // retirada de la cinta
uniform float u_disc; // disco azul, pincelada circular
uniform float u_print; // trama Ben-Day serigrafiada
uniform vec2 u_reg; // desajuste del registro de la pantalla
uniform float u_alpha;
uniform vec3 u_gesso;
uniform vec3 u_yellow;
uniform vec3 u_red;
uniform vec3 u_blue;
uniform vec3 u_tapeColor;
uniform vec3 u_dots;

const float N = 5.0;

void main() {
  vec2 px = v_uv * u_size;
  float aspect = u_size.x / u_size.y;
  vec2 p = vec2(v_uv.x * aspect, 1.0 - v_uv.y); // y hacia abajo, como en el boceto

  // Imprimación de gesso: tejido apenas visible
  float weave = vnoise(px * vec2(0.9, 0.12)) * 0.5 + vnoise(px * vec2(0.12, 0.9)) * 0.5;
  vec3 col = u_gesso * (0.97 + 0.04 * weave);

  // Rodillo: estrías finas en el sentido de la pasada
  float roller = 0.95 + 0.06 * vnoise(vec2(p.x * 3.0, p.y * 140.0));
  float edgeNoise = (vnoise(p * vec2(4.0, 30.0)) - 0.5) * 0.03;

  // 1 · Fondo amarillo
  float x1 = mix(-0.1, aspect + 0.1, u_paint1);
  float cov1 = 1.0 - smoothstep(x1 - 0.008, x1 + 0.008, p.x + edgeNoise);
  col = mix(col, u_yellow * roller, cov1);

  // 2 · Cinta: cinco tiras paralelas a 45°
  vec2 dir = normalize(vec2(1.0, 1.0));
  vec2 nrm = vec2(-dir.y, dir.x);
  float across = dot(p - vec2(aspect * 0.5, 0.5), nrm);
  float along = dot(p, dir) / (aspect + 1.0) * 1.414; // 0–1 a lo largo de la tira
  float stripW = 0.022;
  float spacing = 0.13;
  float idx = floor(across / spacing + 0.5);
  float inStrip = 1.0 - step(stripW, abs(across - idx * spacing));
  float i = idx + floor(N / 2.0); // 0…N-1
  float valid = step(0.0, i) * step(i, N - 1.0);
  float laid = step(along, clamp(u_tape * N - i, 0.0, 1.0));
  float peeled = step(along, clamp(u_peel * N - i, 0.0, 1.0));
  float tape = inStrip * valid * laid * (1.0 - peeled);
  float protectedArea = inStrip * valid; // la cinta ya estaba al pasar el rojo

  // 3 · Rojo por encima de todo, salvo donde la cinta protegía
  float x2 = mix(aspect + 0.1, -0.1, u_paint2);
  float cov2 = smoothstep(x2 - 0.008, x2 + 0.008, p.x + edgeNoise);
  col = mix(col, u_red * roller, cov2 * (1.0 - protectedArea));
  // Borde duro con un leve cordón de pintura donde estuvo la cinta
  float distEdge = abs(abs(across - idx * spacing) - stripW);
  float ridge = (1.0 - smoothstep(0.0, 0.0025, distEdge)) * peeled * cov2 * valid;
  col *= 1.0 - ridge * 0.18;

  // Cinta encima: papel crepé, con rojo si ya se pintó sobre ella
  float crepe = 0.92 + 0.1 * vnoise(vec2(dot(p, nrm) * 400.0, along * 40.0));
  vec3 tapeCol = mix(u_tapeColor * crepe, u_red * roller * (0.9 + 0.1 * crepe), cov2 * 0.92);
  col = mix(col, tapeCol, tape);

  // 4 · Disco azul: una sola pincelada circular
  vec2 dc = vec2(aspect * 0.7, 0.36);
  float rd = 0.17 * min(1.0, aspect * 1.4);
  vec2 dv = p - dc;
  float ang = fract(atan(dv.y, dv.x) / 6.2831 + 0.25);
  float disc = (1.0 - smoothstep(rd - 0.003, rd + 0.003, length(dv))) * step(ang, u_disc);
  col = mix(col, u_blue * roller, disc);

  // 5 · Trama Ben-Day: puntos iguales en retícula a 45°, con el registro desajustado
  vec2 box0 = vec2(aspect * 0.08, 0.56);
  vec2 box1 = vec2(aspect * 0.46, 0.92);
  float inBox = step(box0.x, p.x) * step(p.x, box1.x) * step(box0.y, p.y) * step(p.y, box1.y);
  vec2 g = mat2(0.7071, -0.7071, 0.7071, 0.7071) * (p + u_reg) / 0.02;
  float benday = 1.0 - smoothstep(0.3, 0.36, length(fract(g) - 0.5));
  // La pantalla imprime primero el blanco del recuadro y luego los puntos
  col = mix(col, u_gesso, inBox * u_print);
  col = mix(col, u_dots, benday * inBox * u_print);

  float a = deckle(v_uv, u_size) * u_alpha;
  fragColor = vec4(col * a, a);
}
