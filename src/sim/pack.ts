// Packing for saves (#533, docs/PLAN-PEOPLE.md "Saves"). Two pieces, both pure
// and runnable in the browser, the worker and Node alike:
//
// - A typed-array column (one field for every person, say) goes into the save
//   as base64 of its bytes, not as a JSON list of numbers: 10,000 ages are
//   20 KB of Uint16 bytes instead of ~50 KB of digits and commas.
// - The whole save text is gzipped with the platform's CompressionStream.
//
// Bytes are in the platform's order, which is little-endian on everything the
// game runs on (and in Godot); a reader in another language reads them so.

export type Column =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array;

type ColumnOf<T extends Column> = { new (buffer: ArrayBuffer): T; BYTES_PER_ELEMENT: number };

/** btoa takes a string of byte-sized characters; building it in chunks keeps big columns off the call stack's limit. */
const CHUNK = 0x8000;

export function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += CHUNK) s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(s);
}

export function base64ToBytes(text: string): Uint8Array {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** A typed-array column as base64 of its bytes, for a save. */
export function packColumn(column: Column): string {
  return bytesToBase64(new Uint8Array(column.buffer, column.byteOffset, column.byteLength));
}

/** A column back from `packColumn`, given its type: `unpackColumn(text, Uint16Array)`. */
export function unpackColumn<T extends Column>(text: string, type: ColumnOf<T>): T {
  const bytes = base64ToBytes(text);
  if (bytes.byteLength % type.BYTES_PER_ELEMENT !== 0) throw new Error("That column's length doesn't fit its type.");
  // A fresh buffer, so the column is aligned for its type.
  return new type(bytes.buffer as ArrayBuffer);
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** Text gzipped, for storing a save. */
export function gzip(text: string): Promise<Uint8Array> {
  return pipe(new TextEncoder().encode(text), new CompressionStream("gzip"));
}

/** Text back from `gzip`. Rejects if the bytes aren't gzip. */
export async function gunzip(bytes: Uint8Array): Promise<string> {
  return new TextDecoder().decode(await pipe(bytes, new DecompressionStream("gzip")));
}
