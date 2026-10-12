// Boceto de la anatomía: el mismo carbón, con la tinta de la página (oscura en claro,
// clara en oscuro) y cada capa aclarando su línea a medida que se pinta encima.
in float v_side;
in float v_t;
in float v_s;
in float v_press;
in float v_seed; // parte entera: capa · parte decimal: semilla
in vec2 v_px;
out vec4 fragColor;

uniform float u_draw;
uniform vec3 u_ink;
uniform float u_alpha;
uniform float u_fill[8];

void main() {
  if (v_t > u_draw) discard;
  int layer = int(floor(v_seed));
  float seed = fract(v_seed);
  float head = 1.0 + 0.25 * smoothstep(u_draw - 0.01, u_draw, v_t);
  float rough = (vnoise(v_px * 0.55 + seed * 31.0) - 0.5) * 0.7;
  float edge = 1.0 - smoothstep(0.45, 1.0, abs(v_side) + rough);
  float t = tooth(v_px, 1);
  float cover = smoothstep(1.0 - v_press - 0.15, 1.0 - v_press + 0.25, t + vnoise(v_px * 2.2) * 0.2);
  float streak = 0.75 + 0.25 * vnoise(vec2(v_s * 90.0, v_side * 3.0 + seed * 10.0));
  float painted = layer >= 0 && layer < 8 ? u_fill[layer] : 0.0;
  float a = clamp(edge * cover * streak * head * 0.8, 0.0, 1.0) * mix(1.0, 0.3, painted) * u_alpha;
  fragColor = vec4(u_ink * a, a);
}
