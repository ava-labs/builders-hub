import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(), event: vi.fn(), judge: vi.fn(), project: vi.fn(), projects: vi.fn(),
}));
vi.mock("@/lib/auth/authSession", () => ({ getAuthSession: mocks.session }));
vi.mock("@/prisma/prisma", () => ({ prisma: {
  hackathon: { findUnique: mocks.event },
  hackathonJudge: { findUnique: mocks.judge },
  project: { findUnique: mocks.project, findMany: mocks.projects },
} }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
vi.mock("@/components/evaluate/HackathonEvaluateDashboard", () => ({ HackathonEvaluateDashboard: () => null }));

import Page from "@/app/(home)/events/[id]/evaluate/page";
import { GET } from "@/app/api/events/[id]/evaluation-phase/route";
import { canManageHackathonOutcomes, canManageProjectOutcome } from "@/lib/auth/permissions";

const context = () => ({ params: Promise.resolve({ id: "event" }) });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.event.mockResolvedValue({ id: "event", title: "Event", created_by: "owner", cohosts: [], evaluation_phase: "PICKING" });
  mocks.judge.mockResolvedValue(null);
  mocks.projects.mockResolvedValue([]);
  mocks.project.mockResolvedValue({ hackaton_id: "event" });
});

describe("evaluation dashboard access", () => {
  it.each(["PICKING", "EVALUATION"])("loads scores with the current %s visibility on refresh", async (phase) => {
    mocks.session.mockResolvedValue({ user: { id: "owner", custom_attributes: ["team1_admin"] } });
    mocks.event.mockResolvedValue({ id: "event", title: "Event", created_by: "owner", cohosts: [], evaluation_phase: phase });
    mocks.projects.mockResolvedValue([{
      id: "project", github_repository: "https://github.com/example/project", created_at: new Date(),
      is_rejected: false,
      evaluations: [{
        evaluator_id: "judge", score_overall: 4, scores: { quality: 4 }, verdict: "strong", comment: "Good",
        created_at: new Date(), updated_at: new Date(),
      }],
    }]);
    const dashboard = (await Page(context())).props.children[1];
    expect(dashboard.props.initialPhase).toBe(phase);
    const evaluation = dashboard.props.projects[0].evaluations[0];
    expect(evaluation.score_overall).toBe(phase === "PICKING" ? 4 : null);
    expect(evaluation.comment).toBe(phase === "PICKING" ? "Good" : null);
  });

  it.each([
    ["team1_admin", true],
    ["hackathon_creator", false],
  ])("lets an owning %s manage phases without granting scoring rights", async (role, canPickWinners) => {
    mocks.session.mockResolvedValue({ user: { id: "owner", custom_attributes: [role] } });
    const page = await Page(context());
    const dashboard = page.props.children[1];
    expect(dashboard.props.canManagePhase).toBe(true);
    expect(dashboard.props.canEvaluate).toBe(false);
    expect(dashboard.props.canPickWinners).toBe(canPickWinners);
    expect((await GET({} as never, context())).status).toBe(200);
  });

  it("keeps unrelated organizers out of the dashboard and phase data", async () => {
    mocks.session.mockResolvedValue({ user: { id: "stranger", custom_attributes: ["team1_admin"] } });
    await expect(Page(context())).rejects.toThrow("redirect:/");
    expect((await GET({} as never, context())).status).toBe(403);
    expect(mocks.projects).not.toHaveBeenCalled();
  });

  it("allows assigned role-less judges to score but not manage", async () => {
    mocks.session.mockResolvedValue({ user: { id: "judge", custom_attributes: [] } });
    mocks.judge.mockResolvedValue({ id: "assignment" });
    const dashboard = (await Page(context())).props.children[1];
    expect(dashboard.props.canEvaluate).toBe(true);
    expect(dashboard.props.canManagePhase).toBe(false);
    expect(dashboard.props.canPickWinners).toBe(false);
  });

  it.each(["team1_admin", "hackathon_creator", "devrel"])("uses the same winner policy for %s in the UI and API", async (role) => {
    const session = { user: { id: "owner", custom_attributes: [role] } };
    expect(await canManageProjectOutcome(session, "project")).toBe(await canManageHackathonOutcomes(session, "event"));
  });
});
