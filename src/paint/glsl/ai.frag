// Arte con IA: imitación visual de un modelo de difusión latente.
// No hay red neuronal: la imagen «objetivo» se pinta con código y cierra el círculo.
// Es el bisonte del capítulo 1 «reinterpretado» como lo haría un generador de imágenes:
// contraluz de atardecer, rayos de luz que atraviesan el polvo, pelo encendido en el borde,
// vaho, hierba alta y un cielo cuyos puntos puros (capítulo 4) se han vuelto bokeh.
// Sobre esa imagen el shader recorre el camino inverso de la difusión: ruido gaussiano en
// una retícula latente de 8 px que se limpia paso a paso con el calendario coseno, de lo
// grueso a lo fino, y al final se decodifica a píxeles.

in vec2 v_uv;
out vec4 fragColor;

uniform vec2 u_size;
uniform sampler2D u_bison; // R volumen · G lana · B silueta difuminada · A cuernos
uniform vec2 u_texel; // 1 / tamaño de la textura
uniform float u_appear; // 0 lienzo vacío → 1 ruido de partida
uniform float u_t; // tiempo de difusión: 1 ruido puro → 0 imagen limpia
uniform float u_decode; // 0 latente (bloques de 8 px) → 1 píxeles
uniform float u_alpha;
uniform vec3 u_ptr; // puntero en px CSS (y hacia abajo) y encendido 0–1
uniform int u_octaves;
uniform vec3 u_screen; // fondo vacío
uniform vec3 u_p0; // ultramar
uniform vec3 u_p1; // violeta
uniform vec3 u_p2; // bermellón
uniform vec3 u_p3; // amarillo
uniform vec3 u_p4; // blanco
uniform vec3 u_p5; // cobalto
// Imagen a imagen: de la pintura de la cueva a un estudio realista a carboncillo
uniform int u_mode; // 0 texto → imagen (cine) · 1 imagen → imagen (cueva → carboncillo)
uniform float u_src; // 1 la estimación es la imagen de partida (cueva) · 0 la nueva (carboncillo)
uniform sampler2D u_mask; // máscara del bisonte del capítulo 1: R ocre · G negro · B sombreado
uniform vec2 u_maskTexel;
uniform vec3 u_rock;
uniform vec3 u_ochre;
uniform vec3 u_charcoal;
uniform vec3 u_paper;

const float LATENT = 8.0; // px por celda latente (como el factor 8 de un VAE)
const vec2 BISON = vec2(200.0, 120.0); // unidades del dibujo del capítulo 1

// --- Encuadre: cámara baja, el bisonte casi llena el plano ---------------------
float g_aspect;
float g_bw;
vec2 g_box;
vec2 g_org;
vec2 g_sun;
float g_sunR;
float g_horizon;

void frame(float aspect) {
  g_aspect = aspect;
  g_bw = aspect < 1.0 ? aspect * 1.02 : min(aspect * 0.84, 1.2);
  g_box = vec2(g_bw, g_bw * BISON.y / BISON.x);
  float feet = aspect < 1.0 ? 0.74 : 0.86; // donde pisan las pezuñas
  g_org = vec2(-g_bw * (aspect < 1.0 ? 0.5 : 0.53), feet - g_box.y * 110.0 / 120.0);
  g_horizon = feet - g_box.y * 0.2;
  // El sol, detrás de la giba: asoma por encima del lomo
  g_sun = g_org + vec2(116.0, 22.0) / BISON * g_box;
  g_sunR = 0.125 * g_bw;
}

vec2 toBison(vec2 q) { return (q - g_org) / g_box; } // uv de la textura (y hacia abajo)
vec2 fromBison(vec2 u) { return g_org + u / BISON * g_box; } // unidades del dibujo → q

vec4 bisonAt(vec2 m) {
  return (m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0) ? texture(u_bison, m) : vec4(0.0);
}

// Gaussiana por celda (Box-Muller), un valor por canal; semilla 1886
vec3 gauss3(vec2 cell) {
  vec3 g;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float u1 = max(hash12(cell + vec2(18.86 + fi * 7.1, 3.7)), 1e-4);
    float u2 = hash12(cell + vec2(5.3, 18.86 + fi * 11.3));
    g[i] = sqrt(-2.0 * log(u1)) * cos(6.2831853 * u2);
  }
  return g;
}

vec3 pigmentAt(float v) {
  if (v < 0.2) return u_p0;
  if (v < 0.38) return u_p5;
  if (v < 0.56) return u_p1;
  if (v < 0.76) return u_p2;
  if (v < 0.93) return u_p3;
  return u_p4;
}

// Cielo: degradado alrededor del sol, de blanco a ultramar
vec3 sky(vec2 q, float r) {
  vec3 c = mix(u_p4, u_p3, smoothstep(0.0, 0.16, r));
  c = mix(c, u_p2, smoothstep(0.12, 0.38, r));
  c = mix(c, mix(u_p1, u_p2, 0.3) * 0.9, smoothstep(0.32, 0.66, r));
  c = mix(c, mix(u_p0, u_p1, 0.4) * 0.6, smoothstep(0.6, 1.15, r));
  return c * mix(0.6, 1.0, smoothstep(0.0, g_horizon, q.y));
}

// Bokeh: los puntos del puntillismo, ahora fuera de foco. Discos blandos con el borde algo
// más claro (como un objetivo de verdad), más grandes cuanto más cerca del sol
vec3 bokeh(vec2 q, float r, float cs, float density, float seed) {
  vec3 acc = vec3(0.0);
  vec2 cell = floor(q / cs);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 c = cell + vec2(float(i), float(j));
      float h = hash12(c + seed);
      if (h > density) continue;
      vec2 ctr = (c + 0.5 + (vec2(hash12(c + seed + 3.1), hash12(c + seed + 8.2)) - 0.5) * 0.8) * cs;
      float rad = cs * mix(0.28, 0.62, hash12(c + seed + 5.0)) * mix(1.25, 0.8, smoothstep(0.1, 0.9, length(ctr - g_sun)));
      float d = length(q - ctr) / rad;
      float disc = 1.0 - smoothstep(0.86, 1.0, d);
      float ring = smoothstep(0.7, 0.95, d) * disc;
      float v = clamp((1.0 - smoothstep(0.0, 1.2, length(ctr - g_sun))) + (hash12(c + seed + 1.7) - 0.5) * 0.45, 0.0, 1.0);
      acc += pigmentAt(v) * (disc * 0.55 + ring * 0.35);
    }
  }
  return acc;
}

// Hierba alta a contraluz: briznas que se afinan hasta la punta
vec2 grass(vec2 q, float base, float maxH, float w, float seed) {
  float cell = floor(q.x / w);
  float hit = 0.0;
  float tip = 0.0;
  for (int i = -2; i <= 2; i++) {
    float c = cell + float(i);
    float h = hash12(vec2(c, seed));
    float height = maxH * (0.25 + 0.75 * h * h);
    float lean = (hash12(vec2(c, seed + 4.0)) - 0.5) * 0.9;
    float t = (base - q.y) / height;
    if (t < 0.0 || t > 1.0) continue;
    float cx = (c + 0.5) * w + lean * height * t * t;
    float half_ = w * 0.42 * (1.0 - t);
    float inside = 1.0 - smoothstep(half_ * 0.6, half_, abs(q.x - cx));
    if (inside > hit) {
      hit = inside;
      tip = t;
    }
  }
  return vec2(hit, tip);
}

// La imagen que «pide» la instrucción, en coordenadas q (alto = 1, y hacia abajo, x centrada)
vec3 targetCine(vec2 q) {
  vec2 toSun = g_sun - q;
  float r = length(toSun);
  vec2 sunDir = toSun / max(r, 1e-4);

  // 1 · Fondo: cielo con bokeh, o pradera oscura con reflejo del sol
  float horizon = g_horizon + (fbm(vec2(q.x * 2.5, 3.0), u_octaves) - 0.5) * 0.03;
  vec3 col;
  if (q.y < horizon) {
    col = sky(q, r);
    // Arriba, donde el cielo es oscuro, los puntos aún están enfocados: puntillismo
    float cs = 0.014;
    vec2 cell = floor(q / cs);
    vec2 ctr = (cell + 0.5 + (vec2(hash12(cell + 3.1), hash12(cell + 8.2)) - 0.5) * 0.35) * cs;
    float sharp = (1.0 - smoothstep(0.3, 0.42, length(q - ctr) / cs)) * smoothstep(0.45, 0.9, r);
    col = mix(col, pigmentAt(clamp(1.05 - r * 0.95 + (hash12(cell) - 0.5) * 0.45, 0.0, 1.0)), sharp * 0.8);
    // Más cerca del sol, los mismos puntos fuera de foco
    col += bokeh(q, r, 0.07, 0.2, 11.0) * 0.6 * (1.0 - smoothstep(0.15, 0.75, r));
    col += bokeh(q, r, 0.032, 0.26, 23.0) * 0.45 * (1.0 - smoothstep(0.1, 0.6, r));
    // Disco del sol con su halo
    col = mix(col, u_p4 * 1.15, 1.0 - smoothstep(g_sunR * 0.96, g_sunR, r));
  } else {
    float depth = smoothstep(horizon, 1.0, q.y);
    vec3 earth = mix(vec3(0.16, 0.08, 0.06), vec3(0.05, 0.035, 0.04), depth);
    float sheen = exp(-abs(q.x - g_sun.x) * 3.0) * (1.0 - depth);
    col = earth + mix(u_p2, u_p3, 0.5) * sheen * 0.35;
    col *= 0.85 + 0.3 * fbm(q * vec2(4.0, 30.0), u_octaves);
  }
  // Hierba del fondo, en el horizonte
  vec2 gb = grass(q, horizon + 0.006, 0.035, 0.006, 3.0);
  col = mix(col, vec3(0.07, 0.04, 0.035) + mix(u_p2, u_p3, 0.6) * smoothstep(0.4, 1.0, gb.y) * exp(-abs(q.x - g_sun.x) * 2.0) * 0.7, gb.x);

  // 2 · El bisonte, a contraluz
  vec2 m = toBison(q);
  vec4 b = bisonAt(m);
  vec2 u = m * BISON;
  if (b.b > 0.02 || b.a > 0.02) {
    // Volumen: normal a partir de la altura «inflada» de la silueta
    vec4 bx1 = bisonAt(m + vec2(u_texel.x * 2.0, 0.0));
    vec4 bx0 = bisonAt(m - vec2(u_texel.x * 2.0, 0.0));
    vec4 by1 = bisonAt(m + vec2(0.0, u_texel.y * 2.0));
    vec4 by0 = bisonAt(m - vec2(0.0, u_texel.y * 2.0));
    vec3 n = normalize(vec3(-(bx1.r - bx0.r) * 9.0, -(by1.r - by0.r) * 9.0, 0.25 + b.r));
    // Normal del contorno (hacia fuera), de la silueta difuminada
    vec2 cg = vec2(bx1.b - bx0.b, by1.b - by0.b);
    vec2 outward = -cg / max(length(cg), 1e-4);

    // Pelo: hebras que caen en diagonal por el cuerpo y lana rizada en la giba y la cabeza
    vec2 uw = u + (vec2(fbm(u * 0.05, u_octaves), fbm(u * 0.05 + 7.0, u_octaves)) - 0.5) * 18.0;
    vec2 ub = mat2(0.94, -0.34, 0.34, 0.94) * uw;
    float body = vnoise(vec2(ub.x * 0.35, ub.y * 2.4)) * 0.6 + vnoise(vec2(ub.x * 0.9, ub.y * 5.0)) * 0.4;
    float wool = vnoise(uw * 0.7) * 0.5 + vnoise(uw * 1.9 + 3.0) * 0.35 + vnoise(uw * 4.2) * 0.15;
    // Donde acaba la lana no hay una línea: el límite lo rompe el propio pelo
    float woolMix = smoothstep(0.25, 0.75, b.g + (fbm(u * 0.08 + 5.0, u_octaves) - 0.5) * 0.7);
    float hair = mix(body, wool, woolMix);
    // Borde peludo: el umbral de la silueta lo rompe el propio pelo
    float fringe = mix(0.2, 0.42, woolMix);
    float cov = smoothstep(0.5 - fringe * 0.5, 0.5 + fringe * 0.5, b.b + (hair - 0.5) * fringe);

    vec3 albedo = mix(vec3(0.075, 0.05, 0.04), vec3(0.24, 0.14, 0.075), woolMix) * (0.6 + 0.8 * hair); // lana de la giba más clara que la grupa
    vec3 sunCol = mix(u_p3, u_p4, 0.35) * 1.2;
    float facing = max(dot(normalize(n.xy + 1e-5), sunDir), 0.0);
    float rim = pow(clamp(1.0 - n.z, 0.0, 1.0), 1.4) * facing;
    float edgeFacing = max(dot(outward, sunDir), 0.0);
    float halo = clamp(cov * (1.0 - cov) * 4.0, 0.0, 1.0) * smoothstep(0.0, 0.7, edgeFacing);
    // Línea de luz del contorno: el sol, detrás, enciende el borde del pelo
    float rimLine = cov * (1.0 - smoothstep(0.5, 0.8, b.b)) * pow(edgeFacing, 1.2);
    // Segundo contraluz, frío, desde arriba a la izquierda: dibuja la giba y la barba
    vec2 kick = normalize(vec2(-0.75, -0.65));
    float kickFacing = max(dot(outward, kick), 0.0);
    float kickLine = cov * (1.0 - smoothstep(0.5, 0.85, b.b)) * pow(kickFacing, 1.5);
    float kickHalo = clamp(cov * (1.0 - cov) * 4.0, 0.0, 1.0) * smoothstep(0.2, 0.9, kickFacing);
    float skyFill = max(-n.y, 0.0);
    float nearSun = 1.0 - smoothstep(0.15, 1.1, r);
    vec3 lit = albedo * 0.5
      + u_p1 * 0.1 * skyFill
      + sunCol * rim * (0.7 + 0.8 * hair) * nearSun * 0.8
      + sunCol * rimLine * (0.6 + 0.8 * hair) * (0.35 + nearSun) * 1.1
      + u_p5 * 0.07 * max(-n.x, 0.0) // luz fría de relleno desde delante
      + mix(u_p5, u_p4, 0.45) * (kickLine * (0.5 + 0.7 * hair) * 0.9 + kickHalo * 0.6)
      + mix(u_p1, u_p2, 0.5) * pow(clamp(1.0 - n.z, 0.0, 1.0), 2.0) * kickFacing * 0.25
      + sunCol * halo * 1.1;
    // Ojo: húmedo, con el brillo del sol
    vec2 eye = fromBison(vec2(25.0, 63.0));
    float er = 0.011 * g_bw;
    float ed = length(q - eye);
    lit = mix(lit, vec3(0.02, 0.015, 0.012), 1.0 - smoothstep(er * 0.8, er, ed));
    lit += u_p4 * (1.0 - smoothstep(0.0, er * 0.35, length(q - eye - sunDir * er * 0.45))) * 1.2;
    col = mix(col, lit, cov);

    // Cuernos: hueso claro, encendidos por detrás
    float horn = smoothstep(0.3, 0.6, b.a);
    vec2 hg = vec2(bx1.a - bx0.a, by1.a - by0.a);
    float hornRim = max(dot(-hg / max(length(hg), 1e-4), sunDir), 0.0) * (1.0 - smoothstep(0.55, 0.95, b.a));
    vec3 hornCol = vec3(0.1, 0.085, 0.075) + vec3(0.2, 0.16, 0.12) * vnoise(u * vec2(0.6, 3.0)) + sunCol * hornRim * 1.3;
    col = mix(col, hornCol, horn);
  }

  // 3 · Vaho: el aliento sale del morro y lo enciende el sol
  vec2 muzzle = fromBison(vec2(12.0, 80.0));
  vec2 pv = (q - muzzle - vec2(-0.035, -0.008) * g_bw) / (vec2(0.075, 0.035) * g_bw);
  float breath = exp(-dot(pv, pv)) * smoothstep(0.35, 0.75, fbm(q * 18.0 / g_bw + vec2(4.0), u_octaves));
  col += mix(u_p3, u_p4, 0.8) * breath * 0.4;

  // 4 · Rayos de luz entre el polvo, cortados por la silueta (volumen simple: 10 muestras)
  float occ = 0.0;
  for (int i = 1; i <= 10; i++) {
    vec2 pq = mix(q, g_sun, float(i) / 11.0);
    occ += smoothstep(0.35, 0.65, bisonAt(toBison(pq)).b);
  }
  float shaft = 1.0 - occ / 10.0;
  float angle = atan(toSun.y, toSun.x);
  float beams = 0.55 + 0.45 * vnoise(vec2(angle * 9.0, 1.0));
  col += mix(u_p2, u_p3, 0.7) * shaft * beams * exp(-r * 2.6) * 0.55;

  // Motas de polvo dentro de la luz
  vec2 mc = floor(q / 0.022);
  vec2 mp = (mc + 0.5 + (vec2(hash12(mc + 61.0), hash12(mc + 67.0)) - 0.5) * 0.9) * 0.022;
  float mote = (1.0 - smoothstep(0.0, 0.0035, length(q - mp))) * step(hash12(mc + 71.0), 0.22);
  col += u_p4 * mote * shaft * exp(-r * 2.0) * 0.9;

  // 5 · Hierba alta en primer plano, que tapa las pezuñas
  vec2 gf = grass(q, 1.02, 0.17 * max(g_bw, 0.8), 0.011, 7.0);
  vec3 bladeCol = vec3(0.03, 0.02, 0.02) + mix(u_p2, u_p3, 0.5) * smoothstep(0.55, 1.0, gf.y) * exp(-abs(q.x - g_sun.x) * 1.6) * 0.8;
  col = mix(col, bladeCol, gf.x);

  // 6 · Resplandor, viñeta y gradación de cine (sombras frías, luces cálidas)
  col += mix(u_p3, u_p4, 0.5) * exp(-r / (g_sunR * 1.6)) * 0.55;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, col * vec3(0.78, 0.86, 1.18), (1.0 - smoothstep(0.0, 0.35, lum)) * 0.5);
  vec2 vq = vec2(q.x / max(g_aspect, 0.5), q.y - 0.5);
  col *= 1.0 - 0.38 * smoothstep(0.45, 1.05, length(vq * vec2(1.1, 1.3)));
  return col;
}

// --- Imagen de partida: el bisonte del capítulo 1, en la pared de la cueva ---------
vec3 targetCave(vec2 q) {
  float h = fbm(q * 6.0, u_octaves);
  vec3 rock = u_rock * (0.7 + 0.42 * h);
  float flow = fbm(vec2(q.x * 9.0, q.y * 1.4), u_octaves);
  rock *= mix(vec3(1.0), vec3(0.84, 0.78, 0.72), smoothstep(0.55, 0.75, flow) * 0.5);
  vec2 lc = q - vec2(g_org.x + g_box.x * 0.45, g_org.y + g_box.y * 0.4);
  rock *= 0.5 + 0.65 * exp(-dot(lc, lc) * 2.4); // la antorcha, en el centro
  vec2 m = toBison(q);
  bool inside = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  vec4 mk = inside ? texture(u_mask, m) : vec4(0.0);
  float grain = vnoise(q * 420.0);
  vec3 c = mix(rock, u_ochre * (0.8 + 0.35 * h), smoothstep(0.35, 0.65, mk.r + (grain - 0.5) * 0.3));
  c = mix(c, u_charcoal, smoothstep(0.35, 0.7, mk.g + (grain - 0.5) * 0.35) * 0.95);
  c *= 1.0 - 0.4 * mk.b;
  // Contorno a carbón, roto por el grano de la roca
  if (inside) {
    float e = abs(texture(u_mask, m + vec2(u_maskTexel.x * 3.0, 0.0)).r - texture(u_mask, m - vec2(u_maskTexel.x * 3.0, 0.0)).r)
            + abs(texture(u_mask, m + vec2(0.0, u_maskTexel.y * 3.0)).r - texture(u_mask, m - vec2(0.0, u_maskTexel.y * 3.0)).r);
    c = mix(c, u_charcoal, smoothstep(0.25, 0.7, e) * smoothstep(0.3, 0.6, grain + 0.25) * 0.9);
  }
  return c;
}

// --- Imagen nueva: estudio realista a carboncillo sobre papel -----------------------
vec3 targetCharcoal(vec2 q) {
  vec2 px = q * u_size.y; // px de pantalla: el grano y el rayado tienen tamaño fijo
  float tooth = vnoise(px * 0.9) * 0.6 + vnoise(px * 2.3 + 7.0) * 0.4;
  vec3 paper = u_paper * (0.965 + 0.025 * fbm(q * 9.0, u_octaves) + 0.035 * tooth); // papel verjurado con grano
  float V = 0.0; // oscuridad del carbón, 0–1

  // Encaje del taller: línea de suelo y óvalos de construcción, muy flojos
  float feetY = fromBison(vec2(0.0, 112.0)).y;
  float cx = g_org.x + g_box.x * 0.5;
  float ground = 1.0 - smoothstep(0.0, 0.0016, abs(q.y - feetY - (vnoise(vec2(q.x * 18.0, 1.0)) - 0.5) * 0.005));
  V = max(V, ground * 0.32 * (1.0 - smoothstep(0.35, 0.75, abs(q.x - cx) / g_box.x)));
  vec2 ov = (q - fromBison(vec2(118.0, 56.0))) / (vec2(70.0, 38.0) / BISON * g_box);
  V = max(V, (1.0 - smoothstep(0.0, 0.012, abs(length(ov) - 1.0))) * 0.13);
  vec2 hv = (q - fromBison(vec2(30.0, 68.0))) / (vec2(22.0, 22.0) / BISON * g_box);
  V = max(V, (1.0 - smoothstep(0.0, 0.02, abs(length(hv) - 1.0))) * 0.13);
  // Sombra en el suelo, difuminada con el dedo
  vec2 sc = (q - vec2(cx + g_box.x * 0.03, feetY + 0.008)) / vec2(g_box.x * 0.5, 0.03);
  V = max(V, exp(-dot(sc, sc) * 1.6) * 0.42 * (0.75 + 0.25 * vnoise(q * 50.0)));

  vec2 m = toBison(q);
  vec4 b = bisonAt(m);
  vec2 u = m * BISON;
  if (b.b > 0.02 || b.a > 0.02) {
    vec4 bx1 = bisonAt(m + vec2(u_texel.x * 2.0, 0.0));
    vec4 bx0 = bisonAt(m - vec2(u_texel.x * 2.0, 0.0));
    vec4 by1 = bisonAt(m + vec2(0.0, u_texel.y * 2.0));
    vec4 by0 = bisonAt(m - vec2(0.0, u_texel.y * 2.0));
    vec3 n = normalize(vec3(-(bx1.r - bx0.r) * 9.0, -(by1.r - by0.r) * 9.0, 0.25 + b.r));
    vec2 cg = vec2(bx1.b - bx0.b, by1.b - by0.b);
    vec2 outward = -cg / max(length(cg), 1e-4);

    vec2 uw = u + (vec2(fbm(u * 0.05, u_octaves), fbm(u * 0.05 + 7.0, u_octaves)) - 0.5) * 18.0;
    vec2 ub = mat2(0.94, -0.34, 0.34, 0.94) * uw;
    float body = vnoise(vec2(ub.x * 0.35, ub.y * 2.6)) * 0.6 + vnoise(vec2(ub.x * 0.9, ub.y * 5.5)) * 0.4;
    float wool = vnoise(uw * 0.75) * 0.5 + vnoise(uw * 2.0 + 3.0) * 0.35 + vnoise(uw * 4.4) * 0.15;
    float woolMix = smoothstep(0.25, 0.75, b.g + (fbm(u * 0.08 + 5.0, u_octaves) - 0.5) * 0.7);
    float hair = mix(body, wool, woolMix);
    float fringe = mix(0.16, 0.36, woolMix);
    float cov = smoothstep(0.5 - fringe * 0.5, 0.5 + fringe * 0.5, b.b + (hair - 0.5) * fringe);

    // Luz de estudio, de arriba a la izquierda
    vec3 L = normalize(vec3(-0.55, -0.65, 0.55));
    float lam = max(dot(n, L), 0.0);
    float tone = mix(0.92, 0.12, lam);
    tone = mix(tone, tone * 0.55 + 0.42, woolMix); // la lana, más oscura
    tone += (hair - 0.5) * 0.5;
    // Rayado en los medios tonos, en la dirección del pelo
    vec2 hd = normalize(mix(vec2(0.94, 0.34), vec2(0.3, 0.95), woolMix));
    float hl = abs(fract(dot(px, hd) / 5.0 + vnoise(px * 0.05) * 0.6) - 0.5) * 2.0;
    float hatch = 1.0 - smoothstep(0.2, 0.55, hl);
    tone = mix(tone, max(tone, hatch * 0.8), smoothstep(0.25, 0.6, tone) * 0.55);
    // Luces levantadas con goma en el pelo que mira a la luz
    tone *= 1.0 - smoothstep(0.55, 0.9, lam) * smoothstep(0.55, 0.8, hair) * 0.7;
    V = mix(V, clamp(tone, 0.0, 1.0), cov);

    // Contorno con peso: más grueso y negro del lado de la sombra
    float side = max(dot(outward, normalize(vec2(0.55, 0.65))), 0.0);
    float edge = cov * (1.0 - smoothstep(0.5, mix(0.62, 0.78, side), b.b));
    V = max(V, edge * mix(0.45, 1.0, side));

    // Ojo: negro intenso, con el brillo del papel sin tocar
    vec2 eye = fromBison(vec2(25.0, 63.0));
    float er = 0.011 * g_bw;
    float ed = length(q - eye);
    V = max(V, 1.0 - smoothstep(er * 0.8, er, ed));
    V *= 1.0 - (1.0 - smoothstep(0.0, er * 0.35, length(q - eye + vec2(er * 0.35)))) ;

    // Cuernos: medio tono con el borde iluminado en blanco
    float horn = smoothstep(0.3, 0.6, b.a);
    vec2 hg = vec2(bx1.a - bx0.a, by1.a - by0.a);
    float hornLit = max(dot(-hg / max(length(hg), 1e-4), normalize(vec2(-0.55, -0.65))), 0.0);
    V = mix(V, 0.78 - 0.6 * hornLit * (1.0 - smoothstep(0.55, 0.95, b.a)), horn);
  }

  // El carbón se queda en las crestas del papel: el grano rompe los tonos
  float d = clamp(V * (0.72 + 0.56 * tooth) - 0.04, 0.0, 1.0);
  return mix(paper, u_charcoal, d * 0.96);
}

vec3 target(vec2 q) {
  if (u_mode == 0) return targetCine(q);
  if (u_src > 0.999) return targetCave(q);
  if (u_src < 0.001) return targetCharcoal(q);
  return mix(targetCharcoal(q), targetCave(q), u_src);
}

vec2 toQ(vec2 px, float aspect) {
  return vec2(px.x / u_size.y - aspect * 0.5, px.y / u_size.y);
}

// Estimación de la imagen limpia en el paso t: muestreada en celdas que se afinan
// de 128 px a 8 px al avanzar (primero la composición, luego el detalle)
vec3 estimate(vec2 px, float t, float aspect) {
  float lv = t * 4.0;
  float l0 = floor(lv);
  float c0 = LATENT * exp2(l0);
  float c1 = c0 * 2.0;
  float f = fract(lv);
  // Una sola evaluación cuando el paso cae justo en un nivel (casi siempre al final)
  if (f < 0.002) return target(toQ((floor(px / c0) + 0.5) * c0, aspect));
  vec3 a = target(toQ((floor(px / c0) + 0.5) * c0, aspect));
  vec3 b = target(toQ((floor(px / c1) + 0.5) * c1, aspect));
  return mix(a, b, f);
}

void main() {
  float aspect = u_size.x / u_size.y;
  frame(aspect);
  vec2 px = vec2(v_uv.x, 1.0 - v_uv.y) * u_size;
  vec2 cell = floor(px / LATENT);

  // Lente latente bajo el puntero: dentro, la imagen vuelve a su ruido (celda a celda)
  float R = min(u_size.x, u_size.y) * 0.17;
  float lens = u_ptr.z * (1.0 - smoothstep(R * 0.75, R, length((cell + 0.5) * LATENT - u_ptr.xy)));
  // Pasos discretos: 50, como un muestreador DDIM típico
  float tq = ceil(max(u_t, lens * 0.7) * 50.0 - 1e-3) / 50.0;
  float abar = pow(cos(tq * 1.5707963), 2.0);

  // Lo caro (la imagen a píxel) solo se calcula cuando hace falta
  bool decoding = u_decode > 0.001;
  vec3 col = u_screen;
  float on = u_mode == 1 ? 1.0 : max(step(hash12(cell + 42.0), u_appear * 1.05), step(0.02, lens));
  float dec = decoding ? step(hash12(cell * 1.37 + 7.0) * 0.9, u_decode * 0.95) * (1.0 - step(0.02, lens)) : 0.0;

  if (on > 0.0 && dec < 0.5) {
    vec3 x0 = estimate(px, tq, aspect);
    vec3 xt = sqrt(abar) * (x0 * 2.0 - 1.0) + sqrt(1.0 - abar) * gauss3(cell);
    col = clamp(xt * 0.5 + 0.5, 0.0, 1.0);
    // Retícula latente, tenue, mientras no se ha decodificado
    vec2 f = fract(px / LATENT);
    float grid = step(min(f.x, f.y), 1.0 / LATENT);
    col = mix(col, u_screen, grid * 0.18);
  }
  if (dec > 0.5) col = target(toQ(px, aspect));

  float a = u_alpha;
  fragColor = vec4(col * a, a);
}
