import 'dotenv/config';

import { Prisma, PrismaClient } from '@prisma/client';

import {
  BUILD_GAMES_2026_STAGE_ROWS,
  type BuildGamesStageSeedRow,
} from './data/build-games-2026-stage-progression.mts';

const prisma = new PrismaClient();

const BUILD_GAMES_HACKATHON_ID = '249d2911-7931-4aa0-a696-37d8370b79f9';
const IMPORT_SOURCE = 'build_games_2026_final_csv';
const DRY_RUN = process.argv.includes('--dry-run');
const UPDATE_CONCURRENCY = 8;

type ImportSummary = {
  updated: number;
  unchanged: number;
  warnings: string[];
  unresolved: string[];
};

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isRecord(value: Prisma.JsonValue | unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function shallowEqualRecord(
  a: Record<string, unknown> | null,
  b: Record<string, unknown>,
): boolean {
  if (a === null) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => a[key] === b[key]);
}

function buildImportedProgression(row: BuildGamesStageSeedRow) {
  return {
    source: IMPORT_SOURCE,
    stage_classification: row.stageClassification,
    current_stage: row.stage,
    bucket: row.bucket,
    member_confirmation: row.memberConfirmation,
    source_project_name: row.projectName,
  };
}

function mergeFormData(existingFormData: Prisma.JsonValue | null, row: BuildGamesStageSeedRow): Prisma.InputJsonValue {
  const root = isRecord(existingFormData) ? existingFormData : {};
  const existingBuildGames = isRecord(root.build_games) ? root.build_games : {};

  return {
    ...root,
    build_games: {
      ...existingBuildGames,
      imported_stage_progression: buildImportedProgression(row),
    },
  } as Prisma.InputJsonValue;
}

type ProjectRecord = {
  id: string;
  project_name: string;
  hackaton_id: string | null;
};

type FormDataRecord = {
  id: string;
  project_id: string;
  form_data: Prisma.JsonValue;
  current_stage: number;
  timestamp: Date;
};

type PendingWrite = {
  kind: 'update';
  row: BuildGamesStageSeedRow;
  formDataId: string;
  nextFormData: Prisma.InputJsonValue;
};

async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let index = 0;
  const runners: Promise<void>[] = [];
  const workerCount = Math.max(1, Math.min(limit, items.length));
  for (let w = 0; w < workerCount; w += 1) {
    runners.push(
      (async () => {
        while (index < items.length) {
          const current = index;
          index += 1;
          await worker(items[current]);
        }
      })(),
    );
  }
  await Promise.all(runners);
}

async function main() {
  const summary: ImportSummary = {
    updated: 0,
    unchanged: 0,
    warnings: [],
    unresolved: [],
  };

  const duplicateIds = new Set<string>();
  const seenIds = new Set<string>();
  for (const row of BUILD_GAMES_2026_STAGE_ROWS) {
    if (seenIds.has(row.projectId)) duplicateIds.add(row.projectId);
    seenIds.add(row.projectId);
  }
  if (duplicateIds.size > 0) {
    throw new Error(`Duplicate project ids found in embedded Build Games stage data: ${[...duplicateIds].join(', ')}`);
  }

  console.log(
    `${DRY_RUN ? '[dry-run] ' : ''}Importing ${BUILD_GAMES_2026_STAGE_ROWS.length} Build Games stage rows into Builder Hub...`,
  );

  // Prefetch every project and every build_games FormData row the seed cares
  // about in two queries, instead of 2 * N. The whole seed runs in ~1057
  // in-memory lookups plus the updates, which keeps the Neon pooler happy.
  const projectIds = [...seenIds];
  const projects = (await prisma.project.findMany({
    where: { id: { in: projectIds } },
    select: { id: true, project_name: true, hackaton_id: true },
  })) as ProjectRecord[];
  const projectsById = new Map(projects.map((p) => [p.id, p]));

  const formDataRows = (await prisma.formData.findMany({
    where: { project_id: { in: projectIds }, origin: 'build_games' },
    orderBy: { timestamp: 'desc' },
    select: { id: true, project_id: true, form_data: true, current_stage: true, timestamp: true },
  })) as FormDataRecord[];

  const formDataByProjectId = new Map<string, FormDataRecord[]>();
  for (const fd of formDataRows) {
    const arr = formDataByProjectId.get(fd.project_id) ?? [];
    arr.push(fd);
    formDataByProjectId.set(fd.project_id, arr);
  }

  const pending: PendingWrite[] = [];

  for (const row of BUILD_GAMES_2026_STAGE_ROWS) {
    const project = projectsById.get(row.projectId);

    if (!project) {
      summary.unresolved.push(`Missing project for ${row.projectId} (${row.projectName})`);
      continue;
    }

    if (project.hackaton_id !== BUILD_GAMES_HACKATHON_ID) {
      summary.unresolved.push(`Project ${row.projectId} (${project.project_name}) is not part of Build Games`);
      continue;
    }

    if (normalizeName(project.project_name) !== normalizeName(row.projectName)) {
      summary.warnings.push(
        `Name mismatch for ${row.projectId}: DB="${project.project_name}" vs sheet="${row.projectName}"`,
      );
    }

    const existingRows = formDataByProjectId.get(row.projectId) ?? [];
    if (existingRows.length > 1) {
      summary.warnings.push(
        `Multiple build_games FormData rows found for ${row.projectId}; updating the most recent record`,
      );
    }

    const latest = existingRows[0];

    if (!latest) {
      summary.unresolved.push(
        `No build_games FormData row found for ${row.projectId} (${project.project_name})`,
      );
      continue;
    }

    const nextFormData = mergeFormData(latest.form_data, row);
    const nextImportedProgression = buildImportedProgression(row);

    const latestRoot = isRecord(latest.form_data) ? latest.form_data : {};
    const latestBuildGames = isRecord(latestRoot.build_games) ? latestRoot.build_games : {};
    const currentImportedProgression = isRecord(latestBuildGames.imported_stage_progression)
      ? latestBuildGames.imported_stage_progression
      : null;

    const stageUnchanged = latest.current_stage === row.stage;
    const importMetaUnchanged = shallowEqualRecord(currentImportedProgression, nextImportedProgression);

    if (stageUnchanged && importMetaUnchanged) {
      summary.unchanged += 1;
      continue;
    }

    if (DRY_RUN) {
      summary.updated += 1;
      continue;
    }

    pending.push({ kind: 'update', row, formDataId: latest.id, nextFormData });
  }

  if (!DRY_RUN && pending.length > 0) {
    console.log(
      `Writing ${pending.length} FormData row(s) with concurrency ${UPDATE_CONCURRENCY}...`,
    );
    await runWithConcurrency(pending, UPDATE_CONCURRENCY, async (item) => {
      await prisma.formData.update({
        where: { id: item.formDataId },
        data: {
          current_stage: item.row.stage,
          timestamp: new Date(),
          form_data: item.nextFormData,
        },
      });
      summary.updated += 1;
    });
  }

  console.log('');
  console.log('Build Games stage progression import summary');
  console.log('------------------------------------------');
  console.log(`Updated FormData rows: ${summary.updated}`);
  console.log(`Unchanged FormData rows: ${summary.unchanged}`);
  console.log(`Warnings: ${summary.warnings.length}`);
  console.log(`Unresolved rows: ${summary.unresolved.length}`);

  if (summary.warnings.length > 0) {
    console.log('');
    console.log('Warnings');
    console.log('--------');
    for (const warning of summary.warnings) {
      console.log(`- ${warning}`);
    }
  }

  if (summary.unresolved.length > 0) {
    console.log('');
    console.log('Unresolved rows');
    console.log('---------------');
    for (const unresolved of summary.unresolved) {
      console.log(`- ${unresolved}`);
    }
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error('Build Games stage progression import failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
