// Worker: construye los toques fuera del hilo principal y devuelve el buffer transferido.
import { buildPoints } from './pointillism-data.js';

self.onmessage = ({ data: { id, width, height } }) => {
  const { data, count, spacing } = buildPoints(width, height);
  self.postMessage({ id, data, count, spacing }, [data.buffer]);
};
