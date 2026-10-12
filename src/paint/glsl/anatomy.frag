// Anatomía de un cuadro: textura de cada capa y tres tonos por cara (isometric/color-luz §1).
// Luz arriba a la izquierda: cara superior la más clara, izquierda media, derecha oscura y fría.

in vec2 v_uv; // coordenadas de la cara superior de la losa, 0–1
in vec2 v_px;
in float v_face; // 0 superior · 1 izquierda · 2 derecha · 3 sombra en el suelo
in float v_layer;
in float v_dim; // 1 normal · <1 apagada mientras otra capa está en foco
in float v_fill; // cuánto se ha pintado esta capa, 0–1
out vec4 fragColor;

uniform float u_sheen; // brillo del barniz que recorre la superficie
uniform float u_alpha;
uniform float u_aspect; // ancho / fondo del cuadro

float lineSdf(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

// El bodegón del cuadro, en coordenadas de la superficie (x con aspecto)
float jug(vec2 q) {
  float body = length((q - vec2(0.42, 0.52)) / vec2(1.0, 1.15)) - 0.17;
  float neck = max(abs(q.x - 0.42) - 0.06, abs(q.y - 0.3) - 0.08);
  return min(body, neck);
}
float apple(vec2 q) { return length(q - vec2(0.8, 0.6)) - 0.09; }
float tableEdge(vec2 q) { return q.y - 0.66; }

vec4 layerTop(int layer, vec2 uv) {
  vec2 q = vec2(uv.x * u_aspect, uv.y);
  vec2 px = v_px;
  if (layer == 0) { // bastidor de madera: veta a lo largo del listón
    float grain = fbm(vec2(uv.x * 3.0, uv.y * 70.0), 4);
    vec3 c = mix(vec3(0.55, 0.38, 0.22), vec3(0.72, 0.53, 0.33), grain);
    return vec4(c, 1.0);
  }
  if (layer == 1) { // lienzo de lino: tafetán
    float w = 0.5 + 0.25 * sin(px.x * 2.1) + 0.25 * sin(px.y * 2.1) + vnoise(vec2(px.x * 0.04, px.y * 1.1)) * 0.3;
    return vec4(vec3(0.78, 0.71, 0.58) * (0.86 + 0.16 * w), 1.0);
  }
  if (layer == 2) { // encolado: cola animal, ámbar y translúcida
    float streak = fbm(vec2(q.x * 2.0, q.y * 12.0), 4);
    return vec4(vec3(0.86, 0.64, 0.3) * (0.9 + 0.2 * streak), 0.5);
  }
  if (layer == 3) { // preparación blanca, con las marcas de la espátula
    float marks = fbm(vec2(q.x * 1.5 + q.y * 0.8, q.y * 9.0), 4);
    return vec4(vec3(0.95, 0.94, 0.9) * (0.96 + 0.06 * marks), 1.0);
  }
  if (layer == 4) { // dibujo subyacente a carboncillo
    vec3 ground = vec3(0.95, 0.94, 0.9);
    float d = min(abs(jug(q)), abs(apple(q)));
    d = min(d, abs(tableEdge(q)));
    d = min(d, lineSdf(q, vec2(0.0, 0.66), vec2(u_aspect, 0.66)));
    d += (vnoise(px * 0.8) - 0.5) * 0.004;
    float ink = 1.0 - smoothstep(0.002, 0.006, d);
    return vec4(mix(ground, vec3(0.12, 0.11, 0.1), ink * 0.85), 1.0);
  }
  if (layer == 5) { // imprimatura: veladura de tierra que quita el blanco
    float strokes = fbm(vec2(q.x * 6.0 - q.y * 3.0, q.y * 3.0), 4);
    return vec4(vec3(0.72, 0.5, 0.33) * (0.88 + 0.2 * strokes), 0.72);
  }
  if (layer == 6) { // capas pictóricas: el bodegón al óleo
    float stroke = fbm(vec2(q.x * 14.0 + q.y * 4.0, q.y * 10.0), 4);
    vec3 c = vec3(0.24, 0.26, 0.19); // fondo verde oliva oscuro
    if (tableEdge(q) > 0.0) c = vec3(0.5, 0.33, 0.18); // mesa
    float j = jug(q);
    if (j < 0.0) {
      float lit = clamp(0.6 - (q.x - 0.42) * 2.6 - (q.y - 0.52) * 1.2, 0.0, 1.0);
      c = mix(vec3(0.13, 0.2, 0.38), vec3(0.36, 0.5, 0.76), lit);
    }
    float a = apple(q);
    if (a < 0.0) {
      float lit = clamp(0.65 - (q.x - 0.8) * 4.0 - (q.y - 0.6) * 3.0, 0.0, 1.0);
      c = mix(vec3(0.55, 0.16, 0.08), vec3(0.95, 0.5, 0.18), lit);
    }
    // Empastes de luz: toques blancos gruesos
    float hl = 1.0 - smoothstep(0.0, 0.025, length(q - vec2(0.36, 0.44)));
    hl = max(hl, 1.0 - smoothstep(0.0, 0.015, length(q - vec2(0.76, 0.55))));
    c = mix(c, vec3(0.97, 0.94, 0.86), hl * 0.9);
    return vec4(c * (0.9 + 0.16 * stroke), 1.0);
  }
  if (layer == 7) { // barniz: transparente, con un reflejo que lo recorre
    float band = exp(-pow((uv.x + uv.y) * 0.7 - u_sheen * 1.8 + 0.2, 2.0) * 60.0);
    return vec4(vec3(1.0, 0.98, 0.93), 0.12 + band * 0.55);
  }
  return vec4(1.0, 0.0, 1.0, 1.0);
}

void main() {
  int layer = int(v_layer + 0.5);
  int face = int(v_face + 0.5);
  if (face == 3) { // sombra suave sobre el suelo, desplazada a la derecha por la luz
    vec2 e = min(v_uv, 1.0 - v_uv);
    float a = smoothstep(0.0, 0.12, min(e.x, e.y)) * 0.16 * u_alpha * v_fill;
    fragColor = vec4(vec3(0.1, 0.08, 0.06) * a, a);
    return;
  }
  // Los cantos llevan el color del material, no el dibujo de la cara superior
  vec4 t = face == 0 ? layerTop(layer, v_uv) : layerTop(layer, vec2(0.03, 0.03));
  vec3 c = t.rgb;
  float alpha = t.a;
  if (face == 1) {
    c *= 0.8; // lateral iluminado: el color base
    alpha = max(alpha, 0.6);
  } else if (face == 2) {
    c *= 0.62 * vec3(0.95, 0.98, 1.05); // lateral en sombra: más oscuro y frío
    alpha = max(alpha, 0.6);
  }
  if (layer == 7 && face != 0) alpha = 0.25; // el canto del barniz apenas se ve
  // La capa se pinta con una pasada de pincel en diagonal, de borde mordido
  float sweep = v_uv.x * 0.6 + v_uv.y * 0.4 + (fbm(v_uv * 9.0 + v_layer * 3.0, 4) - 0.5) * 0.3;
  float reveal = smoothstep(v_fill * 1.35 - 0.2, v_fill * 1.35 - 0.12, sweep);
  alpha *= 1.0 - reveal;
  c *= v_dim;
  alpha *= u_alpha;
  fragColor = vec4(c * alpha, alpha);
}
