// Trazo de carboncillo: una cinta de triángulos que se ensancha según la presión.
layout(location = 0) in vec2 a_pos; // centro del trazo, unidades de dibujo (y hacia abajo)
layout(location = 1) in vec2 a_dir; // tangente
layout(location = 2) in vec4 a_attr; // lado (−1/1) · tiempo de dibujo · avance 0–1 · ancho
layout(location = 3) in vec2 a_more; // presión · semilla

uniform vec2 u_size; // px CSS del área
uniform vec3 u_fit;

out float v_side;
out float v_t;
out float v_s;
out float v_press;
out float v_seed;
out vec2 v_px;

void main() {
  float side = a_attr.x;
  float s = a_attr.z;
  // La barra de carbón toca con menos peso al empezar y al levantar
  float taper = pow(sin(3.14159 * clamp(s, 0.02, 0.98)), 0.35);
  vec2 normal = vec2(-a_dir.y, a_dir.x);
  vec2 center = u_fit.xy + a_pos * u_fit.z;
  vec2 px = center + normal * side * a_attr.w * u_fit.z * 0.5 * (0.55 + 0.45 * taper);

  v_side = side;
  v_t = a_attr.y;
  v_s = s;
  v_press = a_more.x * (0.75 + 0.25 * taper);
  v_seed = a_more.y;
  v_px = px;
  gl_Position = vec4(px.x / u_size.x * 2.0 - 1.0, 1.0 - px.y / u_size.y * 2.0, 0.0, 1.0);
}
