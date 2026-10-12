// Toque de pincel: elipse de borde irregular, color puro, sin mezclar con los vecinos.
in vec3 v_color;
in float v_angle;
in float v_seed;
out vec4 fragColor;
uniform float u_alpha;

void main() {
  vec2 pc = gl_PointCoord * 2.0 - 1.0;
  float c = cos(v_angle);
  float s = sin(v_angle);
  pc = mat2(c, -s, s, c) * pc;
  pc.y /= 0.72;
  float r = length(pc);
  r *= 1.0 + 0.1 * sin(atan(pc.y, pc.x) * 5.0 + v_seed * 40.0);
  float alpha = (1.0 - smoothstep(0.78, 1.0, r)) * u_alpha;
  if (alpha <= 0.0) discard;
  // Cuerpo de la pintura: más carga en el centro del toque
  vec3 col = v_color * (0.94 + 0.08 * (1.0 - r));
  fragColor = vec4(col * alpha, alpha);
}
