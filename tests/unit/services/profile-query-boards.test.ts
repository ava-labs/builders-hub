import { beforeEach, describe, expect, it, vi } from "vitest";

const { boardFindMany, playgroundFindMany, getAuthSession } = vi.hoisted(() => ({
  boardFindMany: vi.fn(),
  playgroundFindMany: vi.fn(),
  getAuthSession: vi.fn(),
}));

vi.mock("@/prisma/prisma", () => ({
  prisma: {
    queryBoard: { findMany: boardFindMany },
    statsPlayground: { findMany: playgroundFindMany },
  },
}));
vi.mock("@/lib/auth/authSession", () => ({ getAuthSession }));

import { NextRequest } from "next/server";
import { boardFromPlayground, PLAYGROUND_SCOPE, playgroundBoardId } from "@/lib/explorer-query/playground";
import { MAX_TILES } from "@/lib/explorer-query/board-wire";
import { chainLabelOf, getProfileBoards, MAX_PROFILE_BOARDS, playgroundCharts } from "@/server/services/query-boards";
import { GET } from "@/app/api/profile/query-boards/route";

/* The profile's Query section lists a user's boards in every scope, and
   each Playground dashboard that has not come over yet as the board it
   becomes (server/services/query-boards.ts). */

type BoardRow = { id: string; scope: string; name: string; tiles: unknown; updated_at: Date; deleted_at: Date | null };
type DashboardRow = { id: string; name: string; charts: unknown; updated_at: Date };

const series = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  visible: true,
  chainId: "43114",
  metricKey: "txCount",
  chartStyle: "line",
  yAxis: "left",
  ...over,
});
const chart = (...s: unknown[]) => ({ id: "c", title: "A chart", colSpan: 12, dataSeries: s });

const board = (over: Partial<BoardRow>): BoardRow => ({
  id: "b-000001",
  scope: "mainnet:c-chain",
  name: "Board",
  tiles: [],
  updated_at: new Date("2026-10-01T00:00:00Z"),
  deleted_at: null,
  ...over,
});
const dashboard = (over: Partial<DashboardRow>): DashboardRow => ({
  id: "3f1c2a9e-1111-4a2b-9c3d-123456789abc",
  name: "Fees",
  charts: { charts: [chart(series())] },
  updated_at: new Date("2026-09-01T00:00:00Z"),
  ...over,
});

/* the store answers as Postgres would, so a wrong where shows as a wrong list */
function seed(boards: BoardRow[], dashboards: DashboardRow[]) {
  boardFindMany.mockImplementation(
    async (args: { where: { deleted_at?: null; scope?: string; id?: { in: string[] } }; take?: number }) => {
      const { where } = args;
      let rows = boards;
      if ("deleted_at" in where) rows = rows.filter((b) => b.deleted_at === null);
      if (where.scope) rows = rows.filter((b) => b.scope === where.scope);
      if (where.id) rows = rows.filter((b) => where.id!.in.includes(b.id));
      rows = [...rows].sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());
      return args.take ? rows.slice(0, args.take) : rows;
    },
  );
  playgroundFindMany.mockResolvedValue(dashboards);
}

beforeEach(() => {
  boardFindMany.mockReset();
  playgroundFindMany.mockReset();
  getAuthSession.mockReset();
});

describe("getProfileBoards", () => {
  it("lists live boards in every scope, newest first, with labels and links", async () => {
    seed(
      [
        board({
          id: "cchain-1",
          name: "Swaps",
          tiles: [{ kind: "chart" }, { kind: "chart" }, { kind: "note" }],
          updated_at: new Date("2026-10-02T00:00:00Z"),
        }),
        board({
          id: "pchain-1",
          scope: "mainnet:p-chain",
          name: "Stake",
          tiles: [{ kind: "chart" }],
          updated_at: new Date("2026-10-03T00:00:00Z"),
        }),
        board({ id: "fuji-1", scope: "fuji:c-chain", name: "  ", updated_at: new Date("2026-09-30T00:00:00Z") }),
      ],
      [],
    );
    const { boards } = await getProfileBoards("u-ada");
    expect(boards.map((b) => b.id)).toEqual(["pchain-1", "cchain-1", "fuji-1"]);
    expect(boards[1]).toEqual({
      id: "cchain-1",
      name: "Swaps",
      scope: "mainnet:c-chain",
      network: "mainnet",
      chain: "c-chain",
      chainLabel: "C-Chain",
      networkLabel: "Mainnet",
      tiles: 3,
      charts: 2,
      updatedAt: "2026-10-02T00:00:00.000Z",
      href: "/explorer/mainnet/c-chain/query/boards/cchain-1",
    });
    expect(boards[0]).toMatchObject({ chainLabel: "P-Chain", href: "/explorer/mainnet/p-chain/query/boards/pchain-1" });
    expect(boards[2]).toMatchObject({ name: "Untitled board", chainLabel: "C-Chain", networkLabel: "Fuji", charts: 0 });
  });

  it("hides deleted boards", async () => {
    seed([board({ id: "gone-1", deleted_at: new Date("2026-10-01T00:00:00Z") }), board({ id: "kept-1" })], []);
    const { boards } = await getProfileBoards("u-ada");
    expect(boards.map((b) => b.id)).toEqual(["kept-1"]);
  });

  it("lists a dashboard that has not come over once, as the board Query makes of it", async () => {
    const d = dashboard({});
    seed([], [d, { ...d }]);
    const { boards } = await getProfileBoards("u-ada");
    expect(boards).toHaveLength(1);
    const made = boardFromPlayground({ ...d, updated_at: d.updated_at.toISOString() })!;
    expect(boards[0]).toMatchObject({
      id: made.id,
      name: "Fees",
      scope: PLAYGROUND_SCOPE,
      tiles: made.tiles.length,
      charts: made.tiles.length,
      updatedAt: "2026-09-01T00:00:00.000Z",
      href: `/explorer/mainnet/c-chain/query/boards/${playgroundBoardId(d.id)}`,
    });
  });

  it("does not list a dashboard twice once it is a board, or after its board was deleted", async () => {
    const migrated = dashboard({ id: "11111111-aaaa-bbbb-cccc-000000000001", name: "Migrated" });
    const deleted = dashboard({ id: "11111111-aaaa-bbbb-cccc-000000000002", name: "Deleted" });
    seed(
      [
        board({ id: playgroundBoardId(migrated.id), name: "Migrated", tiles: [{ kind: "metric" }] }),
        board({ id: playgroundBoardId(deleted.id), deleted_at: new Date("2026-01-01T00:00:00Z") }),
      ],
      [migrated, deleted],
    );
    const { boards } = await getProfileBoards("u-ada");
    expect(boards.map((b) => b.id)).toEqual([playgroundBoardId(migrated.id)]);
    // the read of made boards asks for these dashboards' ids only, so it stays bounded
    const madeRead = boardFindMany.mock.calls.map(([args]) => args.where).find((w) => w.id);
    expect(madeRead).toEqual({
      user_id: "u-ada",
      scope: PLAYGROUND_SCOPE,
      id: { in: [playgroundBoardId(migrated.id), playgroundBoardId(deleted.id)] },
    });
  });

  it("leaves out a board whose link no page opens", async () => {
    seed(
      [
        board({ id: "ok-board-1" }),
        board({ id: "bad/../../id", name: "Bad id" }),
        board({ id: "bad-scope-1", scope: "mainnet:C_Chain" }),
      ],
      [],
    );
    const { boards } = await getProfileBoards("u-ada");
    expect(boards.map((b) => b.id)).toEqual(["ok-board-1"]);
  });

  it("leaves out a dashboard that draws nothing", async () => {
    seed(
      [],
      [
        dashboard({ id: "dash-a1", charts: { charts: [] } }),
        dashboard({ id: "dash-a2", charts: [chart(series({ visible: false }))] }),
        dashboard({ id: "dash-a3", charts: [chart(series({ metricKey: "notAMetric" }))] }),
        dashboard({ id: "dash-a4", charts: [chart(series({ chainId: "0xabc" }))] }),
        dashboard({ id: "dash-a5", name: "", charts: [chart(series())] }),
      ],
    );
    const { boards } = await getProfileBoards("u-ada");
    expect(boards.map((b) => b.id)).toEqual(["pg-dasha5"]);
    expect(boards[0].name).toBe("Untitled board");
  });

  it("names an unnamed dashboard as the board Query makes of it", async () => {
    for (const name of ["", "   "]) {
      const d = dashboard({ id: "dash-b1", name });
      seed([], [d]);
      const { boards } = await getProfileBoards("u-ada");
      const made = boardFromPlayground({ ...d, updated_at: d.updated_at.toISOString() })!;
      // the profile row and the board that its link opens show one name
      expect(boards[0].name).toBe(made.name);
      expect(made.name).toBe("Untitled board");
    }
  });

  it("mixes boards and dashboards by time and keeps at most the cap", async () => {
    seed(
      [
        board({ id: "new-board", updated_at: new Date("2026-10-04T00:00:00Z") }),
        board({ id: "old-board", updated_at: new Date("2026-08-01T00:00:00Z") }),
      ],
      [dashboard({ id: "mid", updated_at: new Date("2026-09-15T00:00:00Z") })],
    );
    const { boards } = await getProfileBoards("u-ada");
    expect(boards.map((b) => b.id)).toEqual(["new-board", "pg-mid", "old-board"]);

    const many = Array.from({ length: MAX_PROFILE_BOARDS + 5 }, (_, i) =>
      board({ id: `b-${String(i).padStart(6, "0")}`, updated_at: new Date(Date.UTC(2026, 0, 1, 0, i)) }),
    );
    seed(many, [dashboard({ id: "newest", updated_at: new Date("2027-01-01T00:00:00Z") })]);
    const capped = (await getProfileBoards("u-ada")).boards;
    expect(capped).toHaveLength(MAX_PROFILE_BOARDS);
    expect(capped[0].id).toBe("pg-newest");
  });

  it("reads only the user's rows", async () => {
    seed([], [dashboard({})]);
    await getProfileBoards("u-ada");
    expect(boardFindMany).toHaveBeenCalledTimes(2);
    for (const [args] of boardFindMany.mock.calls) expect(args.where.user_id).toBe("u-ada");
    expect(playgroundFindMany.mock.calls[0][0].where).toEqual({ user_id: "u-ada" });
  });
});

describe("playgroundCharts", () => {
  /* the board test of playground.ts, which this service cannot import */
  const cases: unknown[] = [
    null,
    [],
    { charts: [] },
    [chart(series())],
    { charts: [chart(series()), chart(series({ visible: false })), chart(series({ chainId: "all" }))] },
    [chart(series({ chainId: "primary", metricKey: "dailyRewards" }))],
    [chart(series({ visible: false }), series({ metricKey: "feesPaid" }))],
    [chart()],
    Array.from({ length: MAX_TILES + 3 }, () => chart(series())),
  ];
  it.each(cases.map((c, i) => [i, c]))("matches boardFromPlayground (case %i)", (_i, charts) => {
    const made = boardFromPlayground({ id: "dash-1", name: "x", charts });
    expect(playgroundCharts(charts)).toBe(made ? made.tiles.length : 0);
  });
});

describe("chainLabelOf", () => {
  it("names the Primary Network chains by letter and an L1 by its catalog name", () => {
    expect(chainLabelOf("mainnet", "c-chain")).toBe("C-Chain");
    expect(chainLabelOf("fuji", "p-chain")).toBe("P-Chain");
    expect(chainLabelOf("mainnet", "aibmainnet")).toBe("AIB Mainnet");
    expect(chainLabelOf("mainnet", "no-such-chain")).toBe("no-such-chain");
  });
});

describe("GET /api/profile/query-boards", () => {
  const req = () => new NextRequest("http://localhost/api/profile/query-boards");

  it("refuses a reader who is not signed in", async () => {
    getAuthSession.mockResolvedValue(null);
    const res = await GET(req(), undefined);
    expect(res.status).toBe(401);
    expect(boardFindMany).not.toHaveBeenCalled();
  });

  it("answers the signed-in user's own boards", async () => {
    getAuthSession.mockResolvedValue({ user: { id: "u-ada" } });
    seed([board({ id: "mine-1" })], []);
    const res = await GET(req(), undefined);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { boards: Array<{ id: string }> };
    expect(body.boards.map((b) => b.id)).toEqual(["mine-1"]);
    expect(boardFindMany.mock.calls[0][0].where.user_id).toBe("u-ada");
  });

  it("answers no boards to a user who has not accepted the terms", async () => {
    getAuthSession.mockResolvedValue({ user: { id: "pending_abc" } });
    const res = await GET(req(), undefined);
    expect(await res.json()).toEqual({ boards: [] });
    expect(boardFindMany).not.toHaveBeenCalled();
  });
});
