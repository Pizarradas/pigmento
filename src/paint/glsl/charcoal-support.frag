// Soporte de los medios secos: roca de cueva (0) o papel azul preparado (1).
// Lleva también lo que no es trazo: el ocre soplado, la luz de la antorcha,
// el embaldosado en perspectiva, el difumino de la esfera y los toques de tiza.

in vec2 v_uv;
out vec4 fragColor;

uniform vec2 u_size; // px CSS del área
uniform vec3 u_fit; // desplazamiento x, y y escala del dibujo (px CSS, y hacia abajo)
uniform int u_variant;
uniform float u_alpha;
uniform vec3 u_ptr; // puntero en px CSS (y hacia abajo) y encendido 0–1
uniform float u_live; // tiempo con la herramienta encendida (parpadeo de la llama)
uniform vec3 u_ground;
uniform vec3 u_charcoal;
uniform vec3 u_ochreColor;
uniform vec3 u_chalkColor;

// Cueva
uniform sampler2D u_mask; // R ocre · G negro · B sombreado (dibujo, y hacia abajo)
uniform float u_aspect; // ancho / alto del dibujo
uniform vec4 u_bulge0; // lomas de la pared: cx, cy, radio, altura (unidades de dibujo)
uniform vec4 u_bulge1;
uniform vec4 u_bulge2;
uniform vec4 u_bulge3;
uniform float u_torch; // intensidad de la antorcha
uniform float u_torchX; // posición de la antorcha a lo largo de la pared
uniform float u_flicker; // fase del parpadeo (la avanza el scroll)
uniform float u_ochre;
uniform float u_black;
uniform float u_shade;

// Perspectiva (Alberti)
uniform vec4 u_persp; // punto de fuga x, horizonte y, línea de tierra y, distancia
uniform vec2 u_tile; // x0 y ancho de baldosa
uniform vec3 u_sphere; // cx, cy, r
uniform float u_tiles;
uniform float u_tone;
uniform float u_chalk;

vec3 glazeDry(vec3 r, vec3 pigment, float c) {
  return r * mix(vec3(1.0), toLinear(pigment), clamp(c, 0.0, 1.0));
}

float bulge(vec2 d, vec4 b) {
  vec2 q = (d - b.xy) / b.z;
  return b.w * exp(-dot(q, q) * 1.6);
}

// Altura de la pared: lomas grandes que el pintor aprovecha y rugosidad de la caliza
float wallHeight(vec2 d) {
  float h = bulge(d, u_bulge0) + bulge(d, u_bulge1) + bulge(d, u_bulge2) + bulge(d, u_bulge3);
  return h * 0.12 + fbm(d * 5.0, 4) * 0.035 + fbm(d * 22.0, 2) * 0.006;
}

vec3 cave(vec2 pxd, vec2 d) {
  float t = tooth(pxd, 0);

  // Relieve: normal por diferencias de la altura
  float e = 0.004;
  float h = wallHeight(d);
  float hx = wallHeight(d + vec2(e, 0.0));
  float hy = wallHeight(d + vec2(0.0, e));
  vec3 n = normalize(vec3(-(hx - h) / e, -(hy - h) / e, 1.0)); // mismo espacio que la luz (y hacia abajo)

  // Caliza: tonos cálidos, coladas de calcita y alguna grieta
  vec3 rock = u_ground * (0.82 + 0.3 * fbm(pxd * 0.012, 4));
  float flow = fbm(vec2(pxd.x * 0.03, pxd.y * 0.004), 4);
  rock *= mix(vec3(1.0), vec3(0.82, 0.76, 0.7), smoothstep(0.55, 0.75, flow) * 0.5);
  float ridge = 1.0 - abs(fbm(pxd * 0.006, 4) * 2.0 - 1.0);
  rock *= 1.0 - smoothstep(0.99, 0.999, ridge) * 0.15 * smoothstep(0.55, 0.7, vnoise(pxd * 0.01 + 40.0));
  rock *= 0.86 + 0.24 * t; // la caliza tiene grano: se ve a la luz rasante
  vec3 col = toLinear(rock);

  // Pintura, con el borde roto por el grano de la roca
  vec2 uv = vec2(d.x / u_aspect, d.y);
  vec4 m = (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) ? texture(u_mask, uv) : vec4(0.0);
  float grain = vnoise(pxd * 0.35);
  float spray = vnoise(pxd * 0.9) * 0.6 + vnoise(pxd * 2.6) * 0.4;

  // Ocre rojo soplado: aparece por puntos que se van juntando
  float ochreMask = smoothstep(0.35, 0.65, m.r + (grain - 0.5) * 0.3);
  float sprayed = smoothstep(1.0 - u_ochre * 1.25, 1.1 - u_ochre * 1.25, spray);
  // Hematites: rojo de ladrillo, más claro donde la capa es fina
  float thin = fbm(d * 7.0 + 3.0, 4);
  vec3 ochre = mix(vec3(0.5, 0.16, 0.09), vec3(0.7, 0.32, 0.17), thin);
  float cover = ochreMask * sprayed * mix(0.7, 0.92, smoothstep(0.3, 0.7, spray));
  col = mix(col, toLinear(ochre) * (0.88 + 0.22 * t), cover);

  // Sombreado de volumen en ocre oscuro
  col *= mix(vec3(1.0), vec3(0.55, 0.38, 0.32), m.b * u_shade * 0.75);

  // Negro de carbón y manganeso: se queda en las crestas, como el trazo
  float blackMask = smoothstep(0.3, 0.6, m.g + (grain - 0.5) * 0.35);
  float crumbs = smoothstep(0.08, 0.42, t + vnoise(pxd * 1.7) * 0.2);
  col = mix(col, toLinear(u_charcoal), blackMask * crumbs * u_black * 0.95);

  // Antorcha: luz puntual cálida, rasante, que hace aparecer las lomas
  // Con el puntero dentro, la antorcha es la mano de quien mira: recorre la pared y la llama vive
  float flick = 0.9 + 0.1 * vnoise(vec2(u_flicker * 3.0 + u_live * 7.0, 0.5));
  flick *= 1.0 - 0.08 * u_ptr.z * vnoise(vec2(u_live * 19.0, 3.1));
  vec2 dP = (u_ptr.xy - u_fit.xy) / u_fit.z;
  vec3 torch = mix(vec3(u_torchX, 0.32, 0.42), vec3(dP, 0.3), u_ptr.z);
  vec3 toL = torch - vec3(d, h);
  float dist2 = dot(toL, toL);
  float diffuse = max(dot(n, normalize(toL)), 0.0);
  float reach = max(u_torch, u_ptr.z * 0.95) * flick / (1.0 + dist2 * mix(2.2, 3.4, u_ptr.z));
  vec3 light = vec3(0.07, 0.06, 0.06) + vec3(1.0, 0.78, 0.52) * diffuse * reach * 1.9;
  return col * light;
}

vec3 perspective(vec2 pxd, vec2 d) {
  float t = tooth(pxd, 1);
  vec3 r = toLinear(u_ground) * (0.95 + 0.08 * t);
  float c = 0.0;

  // Embaldosado: inversa de la proyección para saber qué baldosa toca a cada píxel
  float vx = u_persp.x;
  float yh = u_persp.y;
  float yb = u_persp.z;
  float dist = u_persp.w;
  vec2 sp = (d - u_sphere.xy) / u_sphere.z;
  float rr = dot(sp, sp);
  if (rr >= 1.0 && d.y > yh + 0.003 && d.y <= yb) { // la esfera tapa el suelo
    float z = dist * (yb - yh) / (d.y - yh) - dist;
    float X = vx + (d.x - vx) * (dist + z) / dist;
    float i = floor((X - u_tile.x) / u_tile.y);
    float k = floor(z / u_tile.y);
    if (i >= 0.0 && i < 8.0 && k >= 0.0 && k < 8.0 && mod(i + k, 2.0) > 0.5) {
      float row = smoothstep(k, k + 1.0, u_tiles * 8.0);
      c += 0.3 * row;
    }
  }

  // Esfera modelada con difumino, sin línea: el sfumato
  // La lámpara del taller: con el puntero dentro, la luz viene de donde está el cursor
  vec2 toP = (u_ptr.xy - u_fit.xy) / u_fit.z - u_sphere.xy;
  vec2 ldir = normalize(mix(vec2(-0.55, -0.6), length(toP) > 1e-4 ? normalize(toP) : vec2(-0.55, -0.6), u_ptr.z) + vec2(1e-5));
  float shade = 0.0;
  if (rr < 1.0) {
    vec3 n = vec3(sp.x, -sp.y, sqrt(1.0 - rr));
    vec3 L = normalize(vec3(ldir.x, -ldir.y, 0.6));
    float lam = max(dot(n, L), 0.0);
    float bounce = smoothstep(0.55, 1.0, -n.y) * 0.22; // luz reflejada del suelo
    shade = clamp(pow(1.0 - lam, 1.3) - bounce, 0.0, 1.0) * (1.0 - smoothstep(0.92, 1.0, rr) * 0.3);
  }
  // Sombra arrojada sobre el suelo
  vec2 sc = u_sphere.xy + vec2(-ldir.x * u_sphere.z * 1.1, u_sphere.z * 0.92);
  float castShadow = 1.0 - smoothstep(0.2, 1.0, length((d - sc) / vec2(u_sphere.z * 1.3, u_sphere.z * 0.28)));
  c += u_tone * (shade * 0.85 + castShadow * 0.55);

  // El difumino aplasta el grano: polvo de carbón casi liso
  r = glazeDry(r, u_charcoal, c * mix(0.75, 1.1, t));

  // Luces de tiza blanca, solo en las crestas del papel
  float hl = 1.0 - smoothstep(0.0, 0.42, length(sp - ldir * 0.57));
  float chalk = u_chalk * hl * smoothstep(0.35, 0.65, t) * step(rr, 1.0);
  r = mix(r, toLinear(u_chalkColor), chalk * 0.85);
  return r;
}

void main() {
  vec2 pxd = vec2(v_uv.x, 1.0 - v_uv.y) * u_size;
  vec2 d = (pxd - u_fit.xy) / u_fit.z;
  vec3 r = u_variant == 0 ? cave(pxd, d) : perspective(pxd, d);
  float a = deckle(v_uv, u_size) * u_alpha;
  fragColor = vec4(toSrgb(r) * a, a);
}
