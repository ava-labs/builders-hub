import { NextResponse } from "next/server";
import { listBlueprints, loadRegistry } from "@/lib/blueprints";

export const runtime = "nodejs";

/** The template gallery: public, read-only, and the same catalog the agent sees. */
export async function GET() {
  const registry = loadRegistry();
  const blueprints = listBlueprints().map(({ manifest, sources, tests }) => ({
    id: manifest.id,
    title: manifest.title,
    summary: manifest.summary,
    description: manifest.description,
    category: manifest.category,
    level: manifest.level,
    tags: manifest.tags,
    prompts: manifest.prompts,
    networks: Object.fromEntries(
      Object.entries(manifest.networks).map(([role, spec]) => [
        role,
        {
          description: spec.description,
          default: spec.default,
          defaultName: registry.networks[spec.default]?.name ?? spec.default,
          allowed: spec.allowed.map((key) => ({ key, name: registry.networks[key]?.name ?? key, testnet: registry.networks[key]?.testnet === true })),
        },
      ]),
    ),
    params: manifest.params.map((p) => ({
      name: p.name,
      type: p.type,
      description: p.description,
      default: p.default ?? null,
      example: p.example ?? null,
    })),
    contracts: manifest.contracts.map((c) => ({ name: c.name, description: c.description, audited: !!c.artifact })),
    prerequisites: manifest.prerequisites,
    outline: manifest.steps.map((s) => ({ title: s.title, kind: s.kind, role: s.network, optional: !!s.optional })),
    steps: manifest.steps.length,
    files: sources.length + tests.length,
  }));
  return NextResponse.json({ blueprints }, { headers: { "cache-control": "public, max-age=300" } });
}
