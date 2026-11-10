import JSZip from 'jszip';

/*
 * Reads a picked folder or a zip in the browser. It keeps only what the
 * server might use and leaves dependencies and build output behind, so a
 * whole repo does not become a huge upload. The server decides the rest.
 */

export interface ReadFile {
  path: string;
  content: string;
}

export interface ReadResult {
  root: string;
  files: ReadFile[];
  /** Files left in the browser: dependencies, build output, other file types, oversized files. */
  leftOut: number;
}

const SKIPPED_DIRS = new Set([
  'lib',
  'node_modules',
  'out',
  'cache',
  'artifacts',
  'broadcast',
  'coverage',
  'typechain',
  'typechain-types',
  'dist',
  'build',
]);
const CONFIG = /(^|\/)(foundry\.toml|remappings\.txt|package\.json|hardhat\.config\.(js|ts|cjs|mjs))$/;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_FILES = 2000;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;

function wanted(path: string): boolean {
  const segments = path.split('/');
  if (segments.some((s) => s.startsWith('.') || SKIPPED_DIRS.has(s))) return false;
  return path.endsWith('.sol') || path.endsWith('.md') || CONFIG.test(path);
}

const rootOf = (paths: string[]) => {
  const tops = new Set(paths.map((p) => p.split('/')[0]));
  return tops.size === 1 && paths.every((p) => p.includes('/')) ? [...tops][0] : '';
};

export async function readFolder(list: FileList): Promise<ReadResult> {
  const all = Array.from(list);
  const files: ReadFile[] = [];
  let leftOut = 0;
  let total = 0;
  for (const file of all) {
    const path = file.webkitRelativePath || file.name;
    if (
      !wanted(path) ||
      file.size > MAX_FILE_BYTES ||
      files.length >= MAX_FILES ||
      total + file.size > MAX_TOTAL_BYTES
    ) {
      leftOut++;
      continue;
    }
    total += file.size;
    files.push({ path, content: await file.text() });
  }
  return { root: rootOf(all.map((f) => f.webkitRelativePath || f.name)), files, leftOut };
}

export async function readZip(file: File): Promise<ReadResult> {
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files).filter((e) => !e.dir);
  const files: ReadFile[] = [];
  let leftOut = 0;
  let total = 0;
  for (const entry of entries) {
    if (!wanted(entry.name) || files.length >= MAX_FILES) {
      leftOut++;
      continue;
    }
    const content = await entry.async('string');
    if (content.length > MAX_FILE_BYTES || total + content.length > MAX_TOTAL_BYTES) {
      leftOut++;
      continue;
    }
    total += content.length;
    files.push({ path: entry.name, content });
  }
  return { root: rootOf(entries.map((e) => e.name)) || file.name.replace(/\.zip$/i, ''), files, leftOut };
}
