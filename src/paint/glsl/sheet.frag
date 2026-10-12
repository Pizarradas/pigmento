// Pliego de papel liso para el puntillismo (lienzo imprimado, grano fino)
in vec2 v_uv;
out vec4 fragColor;
uniform vec2 u_size;
uniform vec3 u_paper;
uniform float u_alpha;

void main() {
  vec2 px = v_uv * u_size;
  float h = vnoise(px * 0.8) * 0.6 + vnoise(px * 2.1) * 0.4;
  vec3 r = toLinear(u_paper) * (0.97 + 0.05 * h);
  float a = deckle(v_uv, u_size) * u_alpha;
  fragColor = vec4(toSrgb(r) * a, a);
}
