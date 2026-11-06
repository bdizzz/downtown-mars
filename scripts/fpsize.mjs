// How big first person's first fetch gets (#371): fp.bin gzipped (GitHub Pages serves it gzipped),
// projected to a model for every item. Used by scripts/models.mjs and tests/models.test.ts.

import { gzipSync } from "node:zlib";

/**
 * fp.bin's gzipped size if all `items` had a model as big, on average, as the `models` it has now:
 * the textures (the first `texturesBytes` of the arrays, shared whatever happens) plus the rest
 * scaled up.
 * @param {Uint8Array} file fp.bin's bytes
 * @param {number} texturesBytes
 * @param {number} models
 * @param {number} items
 * @returns {number}
 */
export function projectFirstFetch(file, texturesBytes, models, items) {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const start = 12 + view.getUint32(8, true);
  const textures = gzipSync(file.subarray(start, start + texturesBytes), { level: 9 }).length;
  const whole = gzipSync(file, { level: 9 }).length;
  return Math.round(textures + ((whole - textures) / Math.max(1, models)) * items);
}
