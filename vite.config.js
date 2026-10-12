import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync } from 'node:fs';

// Los shaders llevan comentarios largos (son la documentación de la técnica). Al construir
// se quitan comentarios y sangrías: el GLSL llega igual al navegador y pesa mucho menos.
// Las directivas (#define, #ifndef…) conservan su salto de línea.
function glslMinify() {
  return {
    name: 'pigmento-glsl-minify',
    enforce: 'pre',
    apply: 'build',
    load(id) {
      const [file, query] = id.split('?');
      if (query !== 'raw' || !/\.(glsl|frag|vert)$/.test(file)) return null;
      const src = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
        .split('\n')
        .map((l) => l.trim().replace(/\s+/g, ' '))
        .filter(Boolean);
      let out = '';
      for (const line of src) out += line.startsWith('#') ? `\n${line}\n` : `${line} `;
      return `export default ${JSON.stringify(out.replace(/\n\s+/g, '\n'))};`;
    },
  };
}

// `npm run build`         → dist/ normal, con assets separados (para servir).
// `npm run build:single`  → dist-single/index.html autocontenido (para compartir o incrustar).
export default defineConfig(({ mode }) => ({
  base: './',
  css: {
    preprocessorOptions: {
      scss: { loadPaths: ['node_modules'], api: 'modern-compiler' },
    },
  },
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    assetsInlineLimit: mode === 'single' ? 100_000_000 : 4096,
    target: 'es2020',
  },
  plugins: mode === 'single' ? [glslMinify(), viteSingleFile()] : [glslMinify()],
}));
