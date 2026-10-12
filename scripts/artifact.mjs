// Convierte dist-single/index.html en el fragmento que publica un Artifact de claude.ai:
// sin doctype/html/head/body (el visor pone su propio esqueleto) ni metas duplicadas.
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync('dist-single/index.html', 'utf8');
const head = html.match(/<head>([\s\S]*)<\/head>/)[1];
const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1];
const title = head.match(/<title>[\s\S]*?<\/title>/)[0];
const rest = head
  .replace(title, '')
  .replace(/<meta charset[^>]*>/, '')
  .replace(/<meta name="viewport"[^>]*>/, '');
writeFileSync('dist-single/pigmento.html', `${title}\n${rest}\n${body}`);
console.log('dist-single/pigmento.html', Math.round((title.length + rest.length + body.length) / 1024), 'KB');
