import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loader } from 'fumadocs-core/source'
import { generateFiles } from 'fumadocs-openapi'
import { createOpenAPI } from 'fumadocs-openapi/server'
import { getFixedSections } from '@/utils/remote-content/sections.mts'
import { rpcReferenceOptions } from '@/scripts/rpc-reference-options.mts'

// A docs page that no meta.json reaches still gets a route and shows up in
// search, but no sidebar links to it, so readers land on stale copies. These
// checks build the real fumadocs page tree and fail on any page left out.

const REPO = path.join(__dirname, '../../..')
const DOCS_DIR = path.join(REPO, 'content/docs')

// Tracked files only: the pages the build generates are gitignored, and stale
// local copies of them would make the result depend on the machine.
const trackedFiles = execFileSync('git', ['ls-files', '--', 'content/docs'], { cwd: REPO, encoding: 'utf8' })
  .split('\n')
  .filter((file) => file && fs.existsSync(path.join(REPO, file)))
  .map((file) => path.relative('content/docs', file))

const trackedPages = trackedFiles.filter((file) => /\.mdx?$/.test(file))
const metaFiles = trackedFiles.filter((file) => path.basename(file) === 'meta.json')

type Placement = 'sidebar' | 'tree' | 'missing'

// Where each page lands: inside a root folder (a docs sidebar), elsewhere in
// the tree, or nowhere (fumadocs parks it in the hidden fallback tree).
function placePages(pages: string[]): Map<string, Placement> {
  const source = loader({
    baseUrl: '/docs',
    source: {
      files: [
        ...[...new Set(pages)].map((file) => ({ type: 'page' as const, path: file, data: { title: file } })),
        ...metaFiles.map((file) => ({
          type: 'meta' as const,
          path: file,
          data: JSON.parse(fs.readFileSync(path.join(DOCS_DIR, file), 'utf8')),
        })),
      ],
    },
  })
  const byUrl = new Map<string, Placement>()
  const mark = (url: string, inSidebar: boolean) => {
    if (byUrl.get(url) !== 'sidebar') byUrl.set(url, inSidebar ? 'sidebar' : 'tree')
  }
  const visit = (nodes: typeof source.pageTree.children, inSidebar: boolean) => {
    for (const node of nodes) {
      if (node.type === 'page') mark(node.url, inSidebar)
      if (node.type === 'folder') {
        const sidebar = inSidebar || node.root === true
        if (node.index) mark(node.index.url, sidebar)
        visit(node.children, sidebar)
      }
    }
  }
  visit(source.pageTree.children, false)
  return new Map(source.getPages().map((page) => [page.path, byUrl.get(page.url) ?? 'missing']))
}

function mdxFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return mdxFiles(full)
    return entry.name.endsWith('.mdx') ? [full] : []
  })
}

describe('docs sidebar coverage', () => {
  // rpcs/index.mdx is the RPC overview above the per-chain RPC sidebars, and
  // docs pages link to it; every other tracked page belongs in a sidebar.
  it('lists every tracked docs page inside a docs sidebar', () => {
    const placements = placePages(trackedPages)
    expect(
      trackedPages.filter((file) => file !== 'rpcs/index.mdx' && placements.get(file) !== 'sidebar'),
    ).toEqual([])
  })

  // The ACP and release sections stay out: their file lists come from the GitHub API.
  it('publishes every synced upstream page inside a docs sidebar', () => {
    const synced = getFixedSections()
      .flatMap((section) => section.configs)
      .map((config) => config.outputPath)
      .filter((output) => output.startsWith('content/docs/'))
      .map((output) => path.relative('content/docs', output))
    const placements = placePages([...trackedPages, ...synced])
    expect(synced.filter((file) => placements.get(file) !== 'sidebar')).toEqual([])
  })

  it('lists every RPC reference page the OpenAPI generator writes', { timeout: 60_000 }, async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'rpc-reference-'))
    try {
      for (const [spec, folder] of [
        ['platformvm.yaml', 'rpcs/p-chain'],
        ['coreth.yaml', 'rpcs/c-chain'],
        ['xchain.yaml', 'rpcs/x-chain'],
      ]) {
        await generateFiles({
          input: createOpenAPI({ input: [path.join(REPO, 'public/openapi', spec)] }),
          output: path.join(out, folder),
          ...rpcReferenceOptions,
        })
      }
      // The generator backs up and restores each folder's own index.mdx.
      const generated = mdxFiles(out)
        .map((file) => path.relative(out, file))
        .filter((file) => path.basename(file) !== 'index.mdx')
      expect(generated.length).toBeGreaterThan(0)
      const placements = placePages([...trackedPages, ...generated])
      expect(generated.filter((file) => placements.get(file) === 'missing')).toEqual([])
    } finally {
      fs.rmSync(out, { recursive: true, force: true })
    }
  })
})
