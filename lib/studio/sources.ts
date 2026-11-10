import { posix } from "node:path";

/*
 * Builds the `sources` map of a Standard JSON input from a few entry files.
 * Unit names follow solc's own rules — relative imports resolve against the
 * importing unit, direct imports go through the remappings — so the names we
 * choose are exactly the ones solc looks up, and the input it gets needs no
 * import callback.
 */

export type SourceReader = (unitName: string) => Promise<string | undefined>;

export class MissingImportError extends Error {
  constructor(readonly missing: { unit: string; importedBy: string }[]) {
    super(`Could not resolve ${missing.map((m) => `"${m.unit}" (imported by ${m.importedBy})`).join(", ")}`);
    this.name = "MissingImportError";
  }
}

export class SourceLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceLimitError";
  }
}

/** Blanks comments while leaving string literals, and every offset, intact. */
export function stripComments(source: string): string {
  let out = "";
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];
    if (c === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") {
        out += " ";
        i++;
      }
    } else if (c === "/" && next === "*") {
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
        out += source[i] === "\n" ? "\n" : " ";
        i++;
      }
      out += i < source.length ? "  " : "";
      i += 2;
    } else if (c === '"' || c === "'") {
      const quote = c;
      out += c;
      i++;
      while (i < source.length && source[i] !== quote && source[i] !== "\n") {
        if (source[i] === "\\") {
          out += source[i++];
        }
        out += source[i++] ?? "";
      }
      if (i < source.length) out += source[i++];
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

const IMPORT = /\bimport\s+(?:[^;"']*?\bfrom\s+)?(["'])([^"']+)\1/g;

export function importsOf(source: string): string[] {
  return [...stripComments(source).matchAll(IMPORT)].map((m) => m[2]);
}

export interface Remapping {
  context: string;
  prefix: string;
  target: string;
}

export function parseRemappings(remappings: string[]): Remapping[] {
  return remappings.map((r) => {
    const eq = r.indexOf("=");
    const left = r.slice(0, eq);
    const colon = left.indexOf(":");
    return {
      context: colon === -1 ? "" : left.slice(0, colon),
      prefix: colon === -1 ? left : left.slice(colon + 1),
      target: r.slice(eq + 1),
    };
  });
}

/** The source unit name solc uses for `importPath` written in `importer`. */
export function resolveImport(importer: string, importPath: string, remappings: Remapping[]): string {
  if (importPath.startsWith("./") || importPath.startsWith("../")) {
    return posix.normalize(posix.join(posix.dirname(importer), importPath));
  }
  // Longest prefix wins; a longer context wins ties, as in solc.
  const match = remappings
    .filter((r) => importer.startsWith(r.context) && importPath.startsWith(r.prefix))
    .sort((a, b) => b.context.length - a.context.length || b.prefix.length - a.prefix.length)[0];
  return match ? match.target + importPath.slice(match.prefix.length) : importPath;
}

/** A relative path with no parent hops or empty segments. */
export function isSafeUnitPath(unit: string): boolean {
  if (unit.startsWith("/") || unit.includes("\\")) return false;
  return unit.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

export interface CollectOptions {
  remappings: string[];
  maxFiles?: number;
  maxBytes?: number;
}

export async function collectSources(
  entries: Record<string, string>,
  read: SourceReader,
  { remappings, maxFiles = 600, maxBytes = 5 * 1024 * 1024 }: CollectOptions,
): Promise<Record<string, string>> {
  const remaps = parseRemappings(remappings);
  const sources: Record<string, string> = { ...entries };
  const queue = Object.keys(entries);
  const attempted = new Set(queue);
  const missing: { unit: string; importedBy: string }[] = [];
  let bytes = Object.values(entries).reduce((n, s) => n + s.length, 0);

  while (queue.length) {
    const unit = queue.shift()!;
    for (const importPath of importsOf(sources[unit])) {
      const name = resolveImport(unit, importPath, remaps);
      if (attempted.has(name)) continue;
      attempted.add(name);
      const content = isSafeUnitPath(name) ? await read(name) : undefined;
      if (content === undefined) {
        missing.push({ unit: name, importedBy: unit });
        continue;
      }
      sources[name] = content;
      queue.push(name);
      bytes += content.length;
      if (Object.keys(sources).length > maxFiles) throw new SourceLimitError(`More than ${maxFiles} source files`);
      if (bytes > maxBytes) throw new SourceLimitError(`Sources exceed ${Math.round(maxBytes / 1024 / 1024)} MB`);
    }
  }
  if (missing.length) throw new MissingImportError(missing);
  return sources;
}

/** First reader that knows the unit wins. */
export function chainReaders(...readers: SourceReader[]): SourceReader {
  return async (unit) => {
    for (const read of readers) {
      const content = await read(unit);
      if (content !== undefined) return content;
    }
    return undefined;
  };
}

/** 1-based line and column of a solc byte offset. */
export function lineColumn(source: string, byteOffset: number): { line: number; column: number } {
  const bytes = new TextEncoder().encode(source);
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < Math.min(byteOffset, bytes.length); i++) {
    if (bytes[i] === 10) {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: byteOffset - lineStart + 1 };
}
