// Ruido y papel compartidos por todas las técnicas.
// Determinista: sin tiempo ni aleatorios, el mismo progreso pinta el mismo cuadro.

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// fbm de 4 octavas, o de 2 en el nivel de calidad más bajo
float fbm(vec2 p, int octaves) {
  float v = 0.0;
  float a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    if (i >= octaves) break;
    v += a * vnoise(p);
    p = r * p * 2.03 + 17.0;
    a *= 0.5;
  }
  return v;
}

// Papel de grano fino prensado en frío: lomas de ~6 px y diente de 1 px
float paperHeight(vec2 px) {
  float bumps = vnoise(px * 0.16) * 0.6 + vnoise(px * 0.37 + 9.0) * 0.28;
  float tooth = vnoise(px * 1.1) * 0.12;
  return bumps + tooth;
}

// Borde de pliego con barbas: 1 dentro, 0 fuera
float deckle(vec2 uv, vec2 sizePx) {
  vec2 d = min(uv, 1.0 - uv) * sizePx;
  float edge = min(d.x, d.y);
  float rough = vnoise(uv * sizePx * 0.06) * 6.0 + vnoise(uv * sizePx * 0.25) * 2.0;
  return smoothstep(2.0, 5.0, edge - rough);
}

vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }
vec3 toSrgb(vec3 c) { return pow(max(c, 0.0), vec3(1.0 / 2.2)); }

// Kubelka-Munk de tres canales: el modo barato de la escalera de calidad
vec3 kmMix(vec3 a, vec3 b, float t) {
  vec3 ra = clamp(toLinear(a), 0.001, 0.999);
  vec3 rb = clamp(toLinear(b), 0.001, 0.999);
  vec3 ka = (1.0 - ra) * (1.0 - ra) / (2.0 * ra);
  vec3 kb = (1.0 - rb) * (1.0 - rb) / (2.0 * rb);
  vec3 k = mix(ka, kb, t);
  vec3 r = 1.0 + k - sqrt(k * k + 2.0 * k);
  return toSrgb(r);
}

// Diente del soporte para medios secos (carboncillo, tiza): el pigmento se queda en las crestas.
// variant 0: roca caliza de cueva · 1: papel verjurado preparado
float tooth(vec2 px, int variant) {
  if (variant == 0) {
    return vnoise(px * 0.22) * 0.55 + vnoise(px * 0.7 + 3.0) * 0.3 + vnoise(px * 1.6) * 0.15;
  }
  float laid = vnoise(vec2(px.x * 0.15, px.y * 1.8)) * 0.15; // líneas del verjurado
  return vnoise(px * 0.5) * 0.5 + vnoise(px * 1.3 + 5.0) * 0.35 + laid;
}
