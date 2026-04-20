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

type ImportSummary = {
  created: number;
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

async function importRow(row: BuildGamesStageSeedRow, summary: ImportSummary): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: row.projectId },
    select: {
      id: true,
      project_name: true,
      hackaton_id: true,
    },
  });

  if (!project) {
    summary.unresolved.push(`Missing project for ${row.projectId} (${row.projectName})`);
    return;
  }

  if (project.hackaton_id !== BUILD_GAMES_HACKATHON_ID) {
    summary.unresolved.push(`Project ${row.projectId} (${project.project_name}) is not part of Build Games`);
    return;
  }

  if (normalizeName(project.project_name) !== normalizeName(row.projectName)) {
    summary.warnings.push(
      `Name mismatch for ${row.projectId}: DB="${project.project_name}" vs sheet="${row.projectName}"`,
    );
  }

  const existingRows = await prisma.formData.findMany({
    where: {
      project_id: row.projectId,
      origin: 'build_games',
    },
    orderBy: {
      timestamp: 'desc',
    },
  });

  if (existingRows.length > 1) {
    summary.warnings.push(
      `Multiple build_games FormData rows found for ${row.projectId}; updating the most recent record`,
    );
  }

  const latest = existingRows[0];
  const nextFormData = mergeFormData(latest?.form_data ?? null, row);
  const nextImportedProgression = buildImportedProgression(row);

  if (!latest) {
    if (DRY_RUN) {
      summary.created += 1;
      return;
    }

    await prisma.formData.create({
      data: {
        origin: 'build_games',
        project_id: row.projectId,
        current_stage: row.stage,
        timestamp: new Date(),
        form_data: nextFormData,
      },
    });

    summary.created += 1;
    return;
  }

  const latestRoot = isRecord(latest.form_data) ? latest.form_data : {};
  const latestBuildGames = isRecord(latestRoot.build_games) ? latestRoot.build_games : {};
  const currentImportedProgression = isRecord(latestBuildGames.imported_stage_progression)
    ? latestBuildGames.imported_stage_progression
    : null;

  const stageUnchanged = latest.current_stage === row.stage;
  const importMetaUnchanged = JSON.stringify(currentImportedProgression) === JSON.stringify(nextImportedProgression);

  if (stageUnchanged && importMetaUnchanged) {
    summary.unchanged += 1;
    return;
  }

  if (DRY_RUN) {
    summary.updated += 1;
    return;
  }

  await prisma.formData.update({
    where: { id: latest.id },
    data: {
      current_stage: row.stage,
      timestamp: new Date(),
      form_data: nextFormData,
    },
  });

  summary.updated += 1;
}

async function main() {
  const summary: ImportSummary = {
    created: 0,
    updated: 0,
    unchanged: 0,
    warnings: [],
    unresolved: [],
  };

  const duplicateIds = new Set<string>();
  const seenIds = new Set<string>();

  for (const row of BUILD_GAMES_2026_STAGE_ROWS) {
    if (seenIds.has(row.projectId)) {
      duplicateIds.add(row.projectId);
    }
    seenIds.add(row.projectId);
  }

  if (duplicateIds.size > 0) {
    throw new Error(`Duplicate project ids found in embedded Build Games stage data: ${[...duplicateIds].join(', ')}`);
  }

  console.log(
    `${DRY_RUN ? '[dry-run] ' : ''}Importing ${BUILD_GAMES_2026_STAGE_ROWS.length} Build Games stage rows into Builder Hub...`,
  );

  for (const row of BUILD_GAMES_2026_STAGE_ROWS) {
    await importRow(row, summary);
  }

  console.log('');
  console.log('Build Games stage progression import summary');
  console.log('------------------------------------------');
  console.log(`Created FormData rows: ${summary.created}`);
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
