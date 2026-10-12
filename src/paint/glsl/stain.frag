// Acrílico diluido en mancha sobre algodón sin imprimar (soak-stain).
// El lienzo crudo forma parte del cuadro: la pintura lo tiñe siguiendo el hilo.
// u_tilt inclina el bastidor: las manchas corren cuesta abajo mientras se extienden.

in vec2 v_uv;
out vec4 fragColor;

uniform vec2 u_size;
uniform vec4 u_pour; // avance de cada vertido, 0–1
uniform vec2 u_tilt; // dirección e intensidad de la inclinación
uniform float u_dry; // al secar aparece la línea de marea del borde
uniform float u_alpha;
uniform vec3 u_canvas;
uniform vec3 u_c0;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;

// Ligamento tafetán: hilos de ~3 px que pasan por encima y por debajo
float weave(vec2 px) {
  float P = 3.0;
  float wx = 0.5 + 0.5 * sin(px.x * 6.2831 / P);
  float wy = 0.5 + 0.5 * sin(px.y * 6.2831 / P);
  float checker = mod(floor(px.x / P) + floor(px.y / P), 2.0);
  float slub = vnoise(vec2(px.x * 0.05, px.y * 1.2)) * 0.35 + vnoise(vec2(px.x * 1.2, px.y * 0.05)) * 0.35;
  return mix(wx, wy, checker) * 0.7 + slub;
}

float pour(vec2 p, vec2 center, float radius, float amount, float seed, float w) {
  vec2 flow = u_tilt * amount * 0.22;
  vec2 q = p - center - flow;
  // Lenguas de pintura: el líquido avanza más por unos sitios que por otros
  q += (vec2(fbm(q * 2.4 + seed, 4), fbm(q * 2.4 + seed + 9.0, 4)) - 0.5) * 0.18 * amount;
  // La mancha se estira en la dirección de la pendiente
  float along = dot(q, normalize(u_tilt + 1e-4));
  q -= normalize(u_tilt + 1e-4) * along * 0.35 * length(u_tilt);
  // En un lienzo vertical (móvil) las manchas se reducen para no taparlo entero
  float fit = clamp(u_size.x / u_size.y * 1.5, 0.55, 1.0);
  float d = length(q) - radius * fit * amount;
  d += (fbm(q * 3.0 + seed, 4) - 0.5) * 0.14 * amount;
  d += (w - 0.5) * 0.008; // capilaridad: el borde sigue el hilo
  float body = 1.0 - smoothstep(-0.004, 0.004, d);
  // Charcos más cargados y zonas casi lavadas dentro de la misma mancha
  float mottle = 0.55 + 0.75 * smoothstep(0.25, 0.8, fbm(q * 2.2 + seed * 3.0, 4));
  float tide = exp(min(d, 0.0) / 0.005) * body * u_dry * 0.35;
  return body * (0.75 * mottle + tide);
}

vec3 glazeStain(vec3 r, vec3 pigment, float c) {
  return r * mix(vec3(1.0), toLinear(pigment), clamp(c, 0.0, 1.0));
}

void main() {
  vec2 px = v_uv * u_size;
  float aspect = u_size.x / u_size.y;
  vec2 p = vec2(v_uv.x * aspect, v_uv.y);
  float w = weave(px);

  vec3 r = toLinear(u_canvas) * (0.93 + 0.07 * w);
  // El pigmento se mete en los valles del tejido
  float soak = 0.92 + 0.16 * (1.0 - w);
  r = glazeStain(r, u_c0, pour(p, vec2(0.32 * aspect, 0.6), 0.34, u_pour.x, 1.0, w) * soak);
  r = glazeStain(r, u_c1, pour(p, vec2(0.62 * aspect, 0.42), 0.3, u_pour.y, 4.0, w) * soak);
  r = glazeStain(r, u_c2, pour(p, vec2(0.8 * aspect, 0.72), 0.22, u_pour.z, 7.0, w) * soak);
  r = glazeStain(r, u_c3, pour(p, vec2(0.48 * aspect, 0.22), 0.26, u_pour.w, 11.0, w) * soak);

  float a = deckle(v_uv, u_size) * u_alpha;
  fragColor = vec4(toSrgb(r) * a, a);
}
