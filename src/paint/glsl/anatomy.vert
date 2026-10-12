// Las caras ya llegan proyectadas en isométrica (px CSS); aquí solo se pasan a clip.
layout(location = 0) in vec2 a_px;
layout(location = 1) in vec2 a_uv;
layout(location = 2) in vec4 a_info; // cara · capa · atenuación · pintado 0–1

uniform vec2 u_size;

out vec2 v_uv;
out vec2 v_px;
out float v_face;
out float v_layer;
out float v_dim;
out float v_fill;

void main() {
  v_uv = a_uv;
  v_px = a_uv * 400.0; // escala del grano: fija al cuadro, no a la pantalla
  v_face = a_info.x;
  v_layer = a_info.y;
  v_dim = a_info.z;
  v_fill = a_info.w;
  gl_Position = vec4(a_px.x / u_size.x * 2.0 - 1.0, 1.0 - a_px.y / u_size.y * 2.0, 0.0, 1.0);
}
