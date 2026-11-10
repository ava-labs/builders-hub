/**
 * Reads the regular files out of an uncompressed tar archive (ustar, with the
 * PAX long-name records npm writes). Enough for npm tarballs; not a general
 * tar implementation.
 */

export interface TarEntry {
  path: string;
  data: Uint8Array;
}

const decoder = new TextDecoder();
const encoder = new TextEncoder();

/** Writes a ustar archive of regular files. Paths up to 255 bytes, split across the prefix field. */
export function tar(entries: { path: string; data: Uint8Array | string; mode?: number }[]): Uint8Array {
  const blocks: Uint8Array[] = [];
  for (const entry of entries) {
    const data = typeof entry.data === "string" ? encoder.encode(entry.data) : entry.data;
    const header = new Uint8Array(512);
    const put = (text: string, offset: number, length: number) => header.set(encoder.encode(text).subarray(0, length), offset);
    const octalField = (value: number, length: number) => `${value.toString(8).padStart(length - 1, "0")}\0`;

    let name = entry.path;
    let prefix = "";
    if (encoder.encode(name).length > 100) {
      const split = [...name.matchAll(/\//g)].map((m) => m.index!).find((i) => name.length - i - 1 <= 100 && i <= 155);
      if (split === undefined) throw new Error(`Path too long for tar: ${entry.path}`);
      prefix = name.slice(0, split);
      name = name.slice(split + 1);
    }
    put(name, 0, 100);
    put(octalField(entry.mode ?? 0o644, 8), 100, 8);
    put(octalField(0, 8), 108, 8);
    put(octalField(0, 8), 116, 8);
    put(octalField(data.length, 12), 124, 12);
    put(octalField(0, 12), 136, 12);
    put("        ", 148, 8);
    header[156] = "0".charCodeAt(0);
    put("ustar\0", 257, 6);
    put("00", 263, 2);
    put(prefix, 345, 155);
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    put(`${checksum.toString(8).padStart(6, "0")}\0 `, 148, 8);

    blocks.push(header, data);
    const pad = (512 - (data.length % 512)) % 512;
    if (pad) blocks.push(new Uint8Array(pad));
  }
  blocks.push(new Uint8Array(1024));
  const out = new Uint8Array(blocks.reduce((n, b) => n + b.length, 0));
  let offset = 0;
  for (const block of blocks) {
    out.set(block, offset);
    offset += block.length;
  }
  return out;
}

function field(block: Uint8Array, offset: number, length: number): string {
  const slice = block.subarray(offset, offset + length);
  const end = slice.indexOf(0);
  return decoder.decode(end === -1 ? slice : slice.subarray(0, end));
}

function octal(block: Uint8Array, offset: number, length: number): number {
  const text = field(block, offset, length).trim();
  return text ? parseInt(text, 8) : 0;
}

function paxPath(data: Uint8Array): string | undefined {
  // Records are "<length> <key>=<value>\n".
  const text = decoder.decode(data);
  for (const record of text.split("\n")) {
    const match = /^\d+ path=(.*)$/.exec(record);
    if (match) return match[1];
  }
  return undefined;
}

export function* untar(archive: Uint8Array): Generator<TarEntry> {
  let offset = 0;
  let longName: string | undefined;
  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) return;

    const size = octal(header, 124, 12);
    const type = String.fromCharCode(header[156] || 48);
    const dataStart = offset + 512;
    const data = archive.subarray(dataStart, dataStart + size);
    offset = dataStart + Math.ceil(size / 512) * 512;

    if (type === "x") {
      longName = paxPath(data);
      continue;
    }
    if (type === "g") continue;
    if (type === "L") {
      longName = field(data, 0, data.length);
      continue;
    }

    const prefix = field(header, 345, 155);
    const name = field(header, 0, 100);
    const path = longName ?? (prefix ? `${prefix}/${name}` : name);
    longName = undefined;
    if (type === "0" || type === "7") yield { path, data };
  }
}
