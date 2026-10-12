// Puntillismo · cada toque viaja de la paleta a su sitio y luego la cámara se acerca y se aleja.
layout(location = 0) in vec2 a_final;
layout(location = 1) in vec2 a_start;
layout(location = 2) in vec3 a_color;
layout(location = 3) in vec2 a_seed; // x: retardo 0–1 · y: variación 0–1

uniform float u_gather; // 0 paleta → 1 cuadro
uniform float u_zoom; // 1 = cuadro entero
uniform vec2 u_focus; // centro del acercamiento, en uv
uniform float u_dot; // diámetro del toque a zoom 1, en px de dispositivo
uniform float u_maxPoint;
uniform vec3 u_lens; // puntero en uv (y hacia arriba) y encendido 0–1
uniform float u_aspect; // ancho / alto del área

out vec3 v_color;
out float v_angle;
out float v_seed;

void main() {
  float t = clamp((u_gather - a_seed.x * 0.5) / 0.5, 0.0, 1.0);
  float e = 1.0 - pow(1.0 - t, 3.0); // llega con energía y frena
  vec2 uv = mix(a_start, a_final, e);
  uv.y += sin(e * 3.14159) * 0.06 * (a_seed.y - 0.3); // arco del gesto

  // De lejos (zoom < 1) el cuadro se centra; de cerca, la cámara va al foco
  vec2 focus = mix(vec2(0.5), u_focus, clamp(u_zoom - 1.0, 0.0, 1.0));
  vec2 view = (uv - focus) * u_zoom + 0.5;

  // Lupa de ojo de pez bajo el puntero: de cerca, puntos; alrededor, el paisaje.
  // r' = R·(1 − (1 − r/R)³): aumento ×3 en el centro y continuo en el borde.
  float mag = 1.0;
  if (u_lens.z > 0.001) {
    vec2 dv = (view - u_lens.xy) * vec2(u_aspect, 1.0);
    float R = 0.2;
    float r = length(dv);
    if (r < R) {
      float k = r / R;
      float nr = R * (1.0 - pow(1.0 - k, 3.0));
      vec2 dir = r > 1e-5 ? dv / r : vec2(0.0);
      vec2 moved = u_lens.xy + dir * nr / vec2(u_aspect, 1.0);
      view = mix(view, moved, u_lens.z);
      mag = mix(1.0, max(3.0 * (1.0 - k) * (1.0 - k), 1.0), u_lens.z);
    }
  }
  gl_Position = vec4(view * 2.0 - 1.0, 0.0, 1.0);

  float size = u_dot * u_zoom * mag * (0.85 + 0.3 * a_seed.y);
  size *= mix(0.75, 1.0, e); // en la paleta, toques algo menores
  gl_PointSize = clamp(size, 1.0, u_maxPoint);

  v_color = a_color;
  v_angle = a_seed.y * 6.2831;
  v_seed = a_seed.x;
}
