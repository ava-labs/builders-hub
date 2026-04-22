import 'dotenv/config';

import { Prisma, PrismaClient } from '@prisma/client';

import {
  BUILD_GAMES_2026_STAGE_ROWS,
  type BuildGamesStageSeedRow,
} from './data/build-games-2026-stage-progression.mts';

const prisma = new PrismaClient();

const BUILD_GAMES_HACKATHON_ID = '249d2911-7931-4aa0-a696-37d8370b79f9';
const IMPORT_SOURCE = 'build_games_2026_final_csv';

type CheckSummary = {
  checked: number;
  expectedByStage: Record<1 | 2 | 3 | 4, number>;
  missingProjects: string[];
  wrongHackathon: string[];
  missingFormData: string[];
  stageMismatches: string[];
  importMetaMismatches: string[];
  warnings: string[];
};

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getImportedProgression(formData: unknown): Record<string, unknown> | null {
  if (!isRecord(formData)) {
    return null;
  }

  const buildGames = formData.build_games;
  if (!isRecord(buildGames)) {
    return null;
  }

  const importedStageProgression = buildGames.imported_stage_progression;
  return isRecord(importedStageProgression) ? importedStageProgression : null;
}

function expectedCounts(rows: BuildGamesStageSeedRow[]) {
  return rows.reduce(
    (acc, row) => {
      acc[row.stage] = (acc[row.stage] ?? 0) + 1;
      return acc;
    },
    { 1: 0, 2: 0, 3: 0, 4: 0 } as Record<1 | 2 | 3 | 4, number>,
  );
}

type ProjectRecord = {
  id: string;
  project_name: string;
  hackaton_id: string | null;
};

type FormDataRecord = {
  id: string;
  project_id: string;
  current_stage: number;
  form_data: Prisma.JsonValue;
  timestamp: Date;
};

function checkRow(
  row: BuildGamesStageSeedRow,
  project: ProjectRecord | undefined,
  projectFormData: FormDataRecord[] | undefined,
  summary: CheckSummary,
) {
  if (!project) {
    summary.missingProjects.push(`${row.projectId} (${row.projectName})`);
    return;
  }

  if (project.hackaton_id !== BUILD_GAMES_HACKATHON_ID) {
    summary.wrongHackathon.push(`${row.projectId} (${project.project_name})`);
    return;
  }

  if (normalizeName(project.project_name) !== normalizeName(row.projectName)) {
    summary.warnings.push(
      `Name mismatch for ${row.projectId}: DB="${project.project_name}" vs seed="${row.projectName}"`,
    );
  }

  const rows = projectFormData ?? [];
  if (rows.length === 0) {
    summary.missingFormData.push(`${row.projectId} (${project.project_name})`);
    return;
  }

  if (rows.length > 1) {
    summary.warnings.push(
      `Multiple build_games FormData rows found for ${row.projectId}; checked latest row ${rows[0].id}`,
    );
  }

  const latest = rows[0];
  if (latest.current_stage !== row.stage) {
    summary.stageMismatches.push(
      `${row.projectId} (${project.project_name}) expected stage ${row.stage}, found ${latest.current_stage}`,
    );
  }

  const importedProgression = getImportedProgression(latest.form_data);
  if (!importedProgression) {
    summary.importMetaMismatches.push(
      `${row.projectId} (${project.project_name}) is missing build_games.imported_stage_progression`,
    );
    return;
  }

  const expectedPairs: Array<[string, string | number]> = [
    ['source', IMPORT_SOURCE],
    ['stage_classification', row.stageClassification],
    ['current_stage', row.stage],
    ['bucket', row.bucket],
    ['member_confirmation', row.memberConfirmation],
    ['source_project_name', row.projectName],
  ];

  const mismatches = expectedPairs
    .filter(([key, expected]) => importedProgression[key] !== expected)
    .map(
      ([key, expected]) =>
        `${key}=expected ${JSON.stringify(expected)} got ${JSON.stringify(importedProgression[key])}`,
    );

  if (mismatches.length > 0) {
    summary.importMetaMismatches.push(
      `${row.projectId} (${project.project_name}) metadata mismatch: ${mismatches.join(', ')}`,
    );
  }

  summary.checked += 1;
}

async function main() {
  const counts = expectedCounts(BUILD_GAMES_2026_STAGE_ROWS);
  const summary: CheckSummary = {
    checked: 0,
    expectedByStage: counts,
    missingProjects: [],
    wrongHackathon: [],
    missingFormData: [],
    stageMismatches: [],
    importMetaMismatches: [],
    warnings: [],
  };

  console.log(`Checking ${BUILD_GAMES_2026_STAGE_ROWS.length} seeded Build Games projects...`);
  console.log(`Expected stage 1 applied only : ${counts[1]}`);
  console.log(`Expected stage 2 only         : ${counts[2]}`);
  console.log(`Expected stage 3 only         : ${counts[3]}`);
  console.log(`Expected stage 4 finalists    : ${counts[4]}`);

  // Prefetch in two queries instead of hitting the DB per row. This keeps the
  // check tolerant of Neon pooler idle-drops on long runs.
  const projectIds = BUILD_GAMES_2026_STAGE_ROWS.map((r) => r.projectId);
  const projects = (await prisma.project.findMany({
    where: { id: { in: projectIds } },
    select: { id: true, project_name: true, hackaton_id: true },
  })) as ProjectRecord[];
  const projectsById = new Map(projects.map((p) => [p.id, p]));

  const formDataRows = (await prisma.formData.findMany({
    where: { project_id: { in: projectIds }, origin: 'build_games' },
    orderBy: { timestamp: 'desc' },
    select: { id: true, project_id: true, current_stage: true, form_data: true, timestamp: true },
  })) as FormDataRecord[];

  const formDataByProjectId = new Map<string, FormDataRecord[]>();
  for (const fd of formDataRows) {
    const arr = formDataByProjectId.get(fd.project_id) ?? [];
    arr.push(fd);
    formDataByProjectId.set(fd.project_id, arr);
  }

  for (const row of BUILD_GAMES_2026_STAGE_ROWS) {
    checkRow(
      row,
      projectsById.get(row.projectId),
      formDataByProjectId.get(row.projectId),
      summary,
    );
  }

  console.log('');
  console.log('Build Games stage progression check summary');
  console.log('------------------------------------------');
  console.log(`Rows verified: ${summary.checked}`);
  console.log(`Missing projects: ${summary.missingProjects.length}`);
  console.log(`Wrong hackathon: ${summary.wrongHackathon.length}`);
  console.log(`Missing FormData rows: ${summary.missingFormData.length}`);
  console.log(`Stage mismatches: ${summary.stageMismatches.length}`);
  console.log(`Import metadata mismatches: ${summary.importMetaMismatches.length}`);
  console.log(`Warnings: ${summary.warnings.length}`);

  const failures = [
    ...summary.missingProjects,
    ...summary.wrongHackathon,
    ...summary.missingFormData,
    ...summary.stageMismatches,
    ...summary.importMetaMismatches,
  ];

  if (summary.warnings.length > 0) {
    console.log('');
    console.log('Warnings');
    console.log('--------');
    for (const warning of summary.warnings) {
      console.log(`- ${warning}`);
    }
  }

  if (failures.length > 0) {
    console.log('');
    console.log('Failures');
    console.log('--------');
    for (const failure of failures) {
      console.log(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('');
  console.log('All seeded Build Games stage assignments matched the expected stage 1 through stage 4 funnel.');
}

main()
  .catch((error) => {
    console.error('Build Games stage progression check failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
