// Acuarela · capítulo 3, Romanticismo
// Cinco aguadas con distancia con signo deformada por fbm (el agua empuja el pigmento).
// Mientras está húmeda: bordes blandos y mezcla espectral entre manchas.
// Al secar (u_wet → 0): el pigmento se acumula en el borde (de forma irregular),
// se posa en el valle del papel (granulado) y aparece la flor de agua (backrun).

in vec2 v_uv;
out vec4 fragColor;

uniform vec2 u_size; // px CSS del área
uniform float u_sky;
uniform float u_sun;
uniform float u_cloud;
uniform float u_bloom;
uniform float u_sea;
uniform float u_reflect;
uniform float u_ship;
uniform float u_wet;
uniform int u_mix; // 0 espectral · 1 Kubelka-Munk 3 canales
uniform int u_octaves;
uniform vec3 u_paper;
uniform vec3 u_aureolin;
uniform vec3 u_cadmio;
uniform vec3 u_tinta;
uniform vec3 u_ultramar;
uniform vec3 u_siena;
uniform vec3 u_reflectColor;
uniform float u_alpha; // fundido de movimiento reducido
uniform vec3 u_ptr; // puntero en px CSS (y hacia abajo) y encendido 0–1

int OCT;

vec3 mixPigment(vec3 a, vec3 b, float t) {
  if (t <= 0.002) return a;
  if (t >= 0.998) return b;
  if (u_mix == 0) return spectral_mix(a, b, t);
  return kmMix(a, b, t);
}

// Concentración de una aguada. d: distancia con signo (negativa dentro).
// pool: 0–1, irregularidad del borde seco (el pigmento no se acumula igual en todo el borde).
float wash(float d, float load, float wet, float pool) {
  float soft = mix(0.002, 0.045, wet);
  float body = 1.0 - smoothstep(-soft, soft, d);
  float edge = exp(min(d, 0.0) / mix(0.006, 0.02, pool)) * body;
  return load * body * (0.8 + 0.2 * wet) + load * edge * (0.35 + 0.9 * pool) * (1.0 - wet);
}

vec3 glaze(vec3 r, vec3 pigment, float c) {
  return r * mix(vec3(1.0), toLinear(pigment), clamp(c, 0.0, 1.15));
}

vec2 warp2(vec2 p, float k, float seed) {
  return vec2(fbm(p * k + seed, OCT), fbm(p * k + seed + 5.2, OCT)) - 0.5;
}

void main() {
  OCT = u_octaves;
  vec2 px = v_uv * u_size;
  float aspect = u_size.x / u_size.y;
  vec2 p = vec2(v_uv.x * aspect, v_uv.y);
  float wet = u_wet;
  float dry = 1.0 - wet;

  float h = paperHeight(px);
  vec2 q = p + warp2(p, 2.6, 0.0) * (0.05 + 0.08 * wet);
  float mottle = fbm(q * 7.0, OCT); // reparto desigual del pigmento dentro de la mancha
  float pool = smoothstep(0.35, 0.7, fbm(q * 5.0 + 11.0, OCT));

  vec2 sun = vec2(0.64 * aspect, 0.6);
  float horizon = 0.42 + (fbm(vec2(p.x * 2.0, 3.0), OCT) - 0.5) * 0.02;

  // 1 · Aguada de cielo: aureolina que se abre desde el sol
  float dSky = length((q - sun) * vec2(0.55, 1.0)) - mix(0.0, 1.5, u_sky);
  dSky = max(dSky, (horizon - 0.035) - q.y);
  float cSky = wash(dSky, 0.5, wet, pool) * (0.75 + 0.5 * mottle);

  // 2 · Sol: cadmio que sangra dentro de la aguada mientras está húmeda
  vec2 sq = q + warp2(q, 4.0, 3.0) * 0.1;
  float dSun = length(sq - sun) - mix(0.0, 0.11, u_sun);
  // Halo: el cadmio que se corrió por el papel mojado antes de secar
  float halo = exp(-max(dSun, 0.0) / 0.05) * u_sun * 0.35;
  float cSun = (wash(dSun, 0.6, min(1.0, wet * 1.4), pool * 0.6) + halo) * (0.8 + 0.4 * mottle);

  // 3 · Velos de tinta neutra en remolino, arriba, sin tapar el sol
  vec2 cq = q + warp2(q, 1.3, 7.0) * 0.25;
  float swirl = fbm(vec2(cq.x * 1.4 - cq.y * 0.9, cq.y * 3.0), OCT);
  float dCloud = (mix(1.0, 0.46, u_cloud) - swirl) * 0.3;
  dCloud = max(dCloud, 0.15 - length((q - sun) * vec2(0.85, 1.1)));
  float upper = smoothstep(horizon + 0.08, horizon + 0.42, q.y);
  float cCloud = wash(dCloud, 0.42, wet, pool) * upper * (0.7 + 0.6 * mottle);

  // Húmedo sobre húmedo: las tres manchas se mezclan como pigmento
  vec3 wetCol = u_aureolin;
  wetCol = mixPigment(wetCol, u_cadmio, cSun / max(cSky + cSun, 1e-4));
  wetCol = mixPigment(wetCol, u_tinta, cCloud / max(max(cSky, cSun) + cCloud, 1e-4));
  float cWet = 1.0 - (1.0 - min(cSky, 1.0)) * (1.0 - min(cSun, 1.0)) * (1.0 - min(cCloud, 1.0));

  // Flor de agua: una gota en la aguada aún húmeda empuja el pigmento hacia fuera
  vec2 bc = vec2(0.86 * aspect, 0.84);
  float dBloom = length(q - bc) - 0.085 * u_bloom * (0.75 + 0.5 * fbm(q * 16.0, OCT));
  float inside = 1.0 - smoothstep(-0.006, 0.006, dBloom);
  float rim = exp(-abs(dBloom) / 0.005) * u_bloom;
  cWet *= mix(1.0, 0.7, inside * u_bloom);
  cWet += rim * 0.3 * (0.3 + 0.7 * dry) * step(0.05, cWet);
  cWet *= mix(1.0, 0.55 + 0.9 * (1.0 - h), 0.4 * dry); // granulado suave

  // 4 · Mar: ultramar que sube desde abajo en trazos horizontales
  float column = exp(-pow((q.x - sun.x) / (0.045 + 0.12 * max(horizon - q.y, 0.0)), 2.0));
  float dSea = q.y - mix(-0.05, horizon, u_sea);
  float streak = fbm(vec2(q.x * 2.2, q.y * 26.0), OCT);
  float cSea = wash(dSea, 0.72, wet * 0.6, pool * 0.4) * (0.6 + 0.7 * streak) * (1.0 - 0.75 * column * u_reflect);
  float valley = 1.0 - smoothstep(0.25, 0.75, h);
  cSea *= mix(1.0, 0.55 + 0.9 * valley, 0.7 * dry); // el ultramar granula en los valles
  // Pincel seco: en el camino del reflejo, las crestas del papel quedan blancas
  float sparkle = smoothstep(0.58, 0.72, h) * column * u_reflect * step(q.y, horizon);
  cSea *= 1.0 - sparkle;

  // 5 · Reflejo del sol, roto en trazos horizontales
  float broken = smoothstep(0.42, 0.6, fbm(vec2(q.x * 4.0, q.y * 38.0), OCT));
  float cRef = u_reflect * column * broken * (1.0 - smoothstep(-0.02, 0.0, q.y - horizon)) * 0.65 * (1.0 - sparkle);

  // 6 · Barco en siena: casco, dos mástiles y velas en veladura, de bordes perdidos
  vec2 sp = q + warp2(q, 9.0, 21.0) * 0.012 - vec2(0.2 * aspect, horizon + 0.012);
  float dHull = max(abs(sp.x) - 0.1 + sp.y * 0.6, abs(sp.y) - 0.013);
  float mast1 = max(abs(sp.x + 0.035) - 0.0028, abs(sp.y - 0.12) - 0.12);
  float mast2 = max(abs(sp.x - 0.035) - 0.0024, abs(sp.y - 0.1) - 0.1);
  float s1 = max(abs(sp.x + 0.035) - 0.045 * (1.0 - (sp.y - 0.03) / 0.21), abs(sp.y - 0.13) - 0.1);
  float s2 = max(abs(sp.x - 0.035) - 0.038 * (1.0 - (sp.y - 0.03) / 0.18), abs(sp.y - 0.11) - 0.08);
  float grow = (1.0 - u_ship) * 0.1;
  float lost = smoothstep(0.3, 0.7, fbm(q * 12.0 + 4.0, OCT)); // borde perdido y encontrado
  float cShip = wash(min(dHull, min(mast1, mast2)) + grow, 0.8, wet * 0.5, pool) * (0.55 + 0.45 * lost);
  cShip = max(cShip, wash(min(s1, s2) + grow, 0.28, wet * 0.8, pool) * (0.6 + 0.4 * mottle));

  // Composición por veladuras sobre el papel (en luz lineal)
  vec3 r = toLinear(u_paper);
  r *= 1.0 + clamp((dFdx(h) - dFdy(h)) * 0.9, -0.06, 0.06); // luz rasante sobre el grano
  r = glaze(r, wetCol, cWet);
  r = glaze(r, u_ultramar, cSea);
  r = glaze(r, u_reflectColor, cRef);
  r = glaze(r, u_siena, cShip);
  r *= 1.0 - 0.07 * wet * clamp(cWet + cSea, 0.0, 1.0); // el papel mojado oscurece

  // Esponja húmeda bajo el puntero: «levantar» color. El pigmento sale del centro y
  // se acumula en un borde de coliflor alrededor, como cuando entra agua en una aguada.
  if (u_ptr.z > 0.002) {
    vec2 pp = vec2(u_ptr.x, u_size.y - u_ptr.y);
    float rad = min(u_size.x, u_size.y) * 0.085;
    float dd = length(px - pp) + (fbm(px * 0.045, OCT) - 0.5) * rad * 0.7;
    float inside = 1.0 - smoothstep(rad * 0.8, rad, dd);
    float ring = exp(-pow((dd - rad) / (rad * 0.09), 2.0));
    vec3 lifted = mix(r, toLinear(u_paper), 0.62 + 0.2 * fbm(px * 0.11, OCT));
    r = mix(r, lifted, inside * u_ptr.z);
    r *= 1.0 - ring * 0.2 * u_ptr.z;
  }

  float a = deckle(v_uv, u_size) * u_alpha;
  fragColor = vec4(toSrgb(r) * a, a);
}
