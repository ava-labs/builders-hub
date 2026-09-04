import { describe, expect, it } from 'vitest';
import { actionFromMethod, hasPermission } from '@/lib/auth/rolePermissions';
import { matchRoute } from '@/lib/auth/routeManifest';
import { isProtectedPath } from '@/lib/auth/protected-paths';

/**
 * The scope rule is the guard against the bug class where a role that is only
 * scoped to its own events satisfied a platform-wide check (see
 * /api/events/[id]/evaluation-phase, /api/projects/[id]/winner).
 *
 * Rule: an "all" grant answers anything; a scoped grant answers only a
 * requirement asking for that same scope.
 */
describe('permission scope', () => {
  const EVENT_MANAGE = { resource: 'event', action: 'manage' } as const;
  const EVENT_MANAGE_OWN = { resource: 'event', action: 'manage', scope: 'own' } as const;

  it('denies team1_admin the platform-wide event:manage question', () => {
    // The whole point: this must be false, so routes are forced to resolve
    // ownership through canEditEvent / canManageProjectOutcome.
    expect(hasPermission(['team1_admin'], EVENT_MANAGE)).toBe(false);
  });

  it('grants team1_admin the scoped question', () => {
    expect(hasPermission(['team1_admin'], EVENT_MANAGE_OWN)).toBe(true);
  });

  it('grants platform admins both the scoped and unscoped question', () => {
    expect(hasPermission(['devrel'], EVENT_MANAGE)).toBe(true);
    expect(hasPermission(['devrel'], EVENT_MANAGE_OWN)).toBe(true);
  });

  it('scopes team1_event_admin to its own events', () => {
    const EVENT_READ = { resource: 'event', action: 'read' } as const;
    expect(hasPermission(['team1_event_admin'], EVENT_READ)).toBe(false);
    expect(hasPermission(['team1_event_admin'], { ...EVENT_READ, scope: 'own' })).toBe(true);
  });

  it('leaves unscoped grants unscoped', () => {
    // hackathon_creator's event:write is a genuine global capability
    // ("may create/enter the editor at all"), not a per-event grant.
    expect(hasPermission(['hackathon_creator'], { resource: 'event', action: 'write' })).toBe(true);
  });

  it('makes event:write scope:"own" the common event-management gate', () => {
    // team1_admin's ONLY event grant is scoped, so it satisfies no unscoped
    // event question. Every entry point (manifest, editor, nav, managed list,
    // admin panel) must therefore ask the scoped question or team1_admin is
    // locked out of event management entirely.
    const GATE = { resource: 'event', action: 'write', scope: 'own' } as const;
    expect(hasPermission(['team1_admin'], GATE)).toBe(true);
    expect(hasPermission(['hackathon_creator'], GATE)).toBe(true);
    expect(hasPermission(['devrel'], GATE)).toBe(true);
    // read-only role stays out
    expect(hasPermission(['team1_event_admin'], GATE)).toBe(false);
    expect(hasPermission(['showcase'], GATE)).toBe(false);

    // The regression itself: team1_admin satisfies NO unscoped event question.
    for (const action of ['read', 'write', 'manage'] as const) {
      expect(
        hasPermission(['team1_admin'], { resource: 'event', action }),
        `team1_admin must not satisfy unscoped event:${action}`,
      ).toBe(false);
    }
  });

  it('keeps the broader grant when a user holds both a scoped and unscoped one', () => {
    // Dedup is keyed on resource:action:scope — if it were keyed on
    // resource:action only, whichever role was listed first would win and a
    // devrel who is also team1_admin could lose platform-wide access.
    expect(hasPermission(['team1_admin', 'devrel'], EVENT_MANAGE)).toBe(true);
    expect(hasPermission(['devrel', 'team1_admin'], EVENT_MANAGE)).toBe(true);
  });

  it('does not let a scoped grant leak across resources', () => {
    expect(hasPermission(['team1_event_admin'], { resource: 'showcase', action: 'read' })).toBe(false);
  });
});

/**
 * Mirrors the decision proxy.ts makes, so the manifest and the role map are
 * tested together. A scoped grant + an Edge gate that forgets to pass `scope`
 * is a silent 403 on a route the user legitimately owns — the exact failure
 * the RouteConfig.scope field exists to prevent.
 */
describe('middleware gate for scoped routes', () => {
  const gate = (roles: string[], pathname: string, method: string) => {
    const matched = matchRoute(pathname);
    if (!matched) return 'public';
    if (matched.authOnly) return 'pass';
    const action = matched.action ?? actionFromMethod(method);
    return hasPermission(roles, {
      resource: matched.resource!,
      action,
      scope: matched.scope,
    })
      ? 'pass'
      : 'blocked';
  };

  const JUDGES = '/api/events/abc123/judges';

  it('lets team1_admin reach the judges route so the handler can scope it', () => {
    // canManageHackathonJudges() does the real created_by/cohost check.
    expect(gate(['team1_admin'], JUDGES, 'POST')).toBe('pass');
  });

  it('still lets platform admins through', () => {
    expect(gate(['devrel'], JUDGES, 'POST')).toBe('pass');
    expect(gate(['devrel'], JUDGES, 'DELETE')).toBe('pass');
  });

  it('blocks roles with no judge:assign grant at the Edge', () => {
    expect(gate(['hackathon_creator'], JUDGES, 'POST')).toBe('blocked');
    expect(gate(['showcase'], JUDGES, 'POST')).toBe('blocked');
    expect(gate([], JUDGES, 'POST')).toBe('blocked');
  });

  it('lets the event-management roles reach the editor, but not the read-only one', () => {
    for (const p of ['/events/edit', '/events/edit/abc', '/hackathons/edit']) {
      expect(gate(['team1_admin'], p, 'GET'), `${p} must admit team1_admin`).toBe('pass');
      expect(gate(['hackathon_creator'], p, 'GET'), `${p} must admit hackathon_creator`).toBe('pass');
      expect(gate(['devrel'], p, 'GET'), `${p} must admit devrel`).toBe('pass');
      // read-only on events — stopped at the Edge rather than rendering and bouncing
      expect(gate(['team1_event_admin'], p, 'GET'), `${p} must block team1_event_admin`).toBe('blocked');
      expect(gate(['showcase'], p, 'GET'), `${p} must block unrelated roles`).toBe('blocked');
    }
  });

  it('grants Team1 Academy access to the Team1 role family and platform admins', () => {
    const T1 = { resource: 'academy:team1', action: 'read' } as const;
    expect(hasPermission(['team1'], T1)).toBe(true);
    expect(hasPermission(['team1_admin'], T1)).toBe(true);
    expect(hasPermission(['team1_event_admin'], T1)).toBe(true);
    expect(hasPermission(['devrel'], T1)).toBe(true);

    // team1_lead (chapter lead / co-lead) carries academy access AND insights.
    expect(hasPermission(['team1_lead'], T1)).toBe(true);
    expect(hasPermission(['team1_lead'], { resource: 'builder_insights', action: 'read' })).toBe(true);
    // …and insights is what separates it from the other Team1 roles.
    for (const r of ['team1', 'team1_admin', 'team1_event_admin']) {
      expect(hasPermission([r], { resource: 'builder_insights', action: 'read' })).toBe(false);
    }

    // Retired tags grant nothing; the 20260525 migration folds them into
    // team1_lead / team1 before deleting them.
    for (const retired of ['Team1-Leader', 'team1-leader', 'Team1-member', 'T1-Technical', 'judge', 'superadmin']) {
      expect(hasPermission([retired], T1)).toBe(false);
      expect(hasPermission([retired], { resource: 'builder_insights', action: 'read' })).toBe(false);
    }
    expect(hasPermission([], T1)).toBe(false);
  });

  it('gates every Team1 Academy path on academy:team1, certificates included', () => {
    // Certificate paths are the trap: matchRoute sorts wildcards by LENGTH, so
    // "/academy/**/get-certificate" (27) out-ranks "/academy/team1/**" (17)
    // and would silently downgrade Team1 certificates to authOnly. The explicit
    // "/academy/team1/**/get-certificate" entries are what prevent that.
    const team1Paths = [
      '/academy/team1',
      '/academy/team1/course-x',
      '/academy/team1/course-x/lesson-1',
      '/academy/team1/course-x/get-certificate',
      '/academy/team1/course-x/certificate',
      '/api/raw/academy/team1',
      '/api/raw/academy/team1/course-x/lesson-1',
    ];
    for (const p of team1Paths) {
      expect(gate(['team1'], p, 'GET'), `${p} should admit team1`).toBe('pass');
      expect(gate(['devrel'], p, 'GET'), `${p} should admit devrel`).toBe('pass');
      expect(gate(['showcase'], p, 'GET'), `${p} must NOT admit a non-Team1 role`).toBe('blocked');
      expect(gate([], p, 'GET'), `${p} must NOT admit a role-less user`).toBe('blocked');
    }
  });

  it('leaves non-Team1 academy routes as they were', () => {
    // Ordinary course certificates stay auth-only for any logged-in learner…
    expect(gate([], '/academy/avalanche-l1/fundamentals/get-certificate', 'GET')).toBe('pass');
    // …and ordinary course content stays public.
    expect(gate([], '/academy/avalanche-l1/fundamentals', 'GET')).toBe('public');
  });

  it('does not gate ordinary users out of academy badges', () => {
    // Regression guard for the manifest entry that 403'd every quiz completion.
    expect(gate([], '/api/badge', 'GET')).toBe('pass');
    expect(gate([], '/api/badge/assign', 'POST')).toBe('pass');
    // …while the admin path stays gated.
    expect(gate([], '/api/badge/console-migrate', 'POST')).toBe('blocked');
    expect(gate(['devrel'], '/api/badge/console-migrate', 'POST')).toBe('pass');
  });
});

/**
 * ROUTE_MANIFEST (server gate) and PROTECTED_PATHS (login-modal trigger) are two
 * lists that must agree: a path gated by one but not the other either pops a
 * login modal on a public page, or gates a page with no modal to explain why.
 */
describe('grants gating: manifest and login-modal list agree', () => {
  const gated = (p: string) => matchRoute(p) !== null;

  it('leaves the public grants pages public in BOTH lists', () => {
    for (const p of ['/grants', '/grants/retro9000returning', '/grants/team1-mini-grants']) {
      expect(gated(p), `${p} must not be gated by the manifest`).toBe(false);
      expect(isProtectedPath(p), `${p} must not trigger the login modal`).toBe(false);
    }
  });

  it('gates the application flows in BOTH lists', () => {
    for (const p of [
      '/grants/retro9000',
      '/grants/avalanche-research-proposals',
      '/grants/team1-mini-grants/apply',
    ]) {
      expect(gated(p), `${p} must be gated by the manifest`).toBe(true);
      expect(isProtectedPath(p), `${p} must trigger the login modal`).toBe(true);
    }
  });

  it('does not let a protected path swallow a sibling that merely shares its prefix', () => {
    // "/grants/retro9000returning" begins with "/grants/retro9000".
    expect(isProtectedPath('/grants/retro9000returning')).toBe(false);
    expect(isProtectedPath('/grants/retro9000')).toBe(true);
    expect(isProtectedPath('/grants/retro9000/step-2')).toBe(true);
  });
});
