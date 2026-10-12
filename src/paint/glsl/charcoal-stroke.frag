// El carbón se queda en las crestas del soporte y deja el borde roto.
in float v_side;
in float v_t;
in float v_s;
in float v_press;
in float v_seed;
in vec2 v_px;
out vec4 fragColor;

uniform float u_draw; // 0–1: hasta dónde se ha dibujado
uniform int u_variant;
uniform vec3 u_charcoal;
uniform float u_alpha;

void main() {
  if (v_t > u_draw) discard;
  // La punta del trazo que se está dibujando: algo más cargada
  float head = 1.0 + 0.25 * smoothstep(u_draw - 0.01, u_draw, v_t);

  float rough = (vnoise(v_px * 0.55 + v_seed * 31.0) - 0.5) * 0.7;
  float edge = 1.0 - smoothstep(0.45, 1.0, abs(v_side) + rough);

  float t = tooth(v_px, u_variant);
  // Con poca presión solo marcan las crestas; con mucha, también los valles
  float cover = smoothstep(1.0 - v_press - 0.15, 1.0 - v_press + 0.25, t + vnoise(v_px * 2.2) * 0.2);
  // Arrastre: la barra deja estrías a lo largo del trazo
  float streak = 0.75 + 0.25 * vnoise(vec2(v_s * 90.0, v_side * 3.0 + v_seed * 10.0));

  float a = clamp(edge * cover * streak * head * 0.85, 0.0, 1.0) * u_alpha;
  // Grabado: el sílex raspa la pátina y deja ver la piedra clara
  vec3 ink = v_seed > 1.5 ? vec3(0.88, 0.8, 0.66) : u_charcoal;
  if (v_seed > 1.5) a *= 0.7;
  fragColor = vec4(ink * a, a);
}
