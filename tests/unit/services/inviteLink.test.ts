import { describe, expect, it } from "vitest";
import { buildInviteLink } from "@/lib/invitations/inviteLink";
import { MINI_GRANT_HACKATHON_ID, MINI_GRANT_SLUG } from "@/lib/grants/programs";

const BUILD_GAMES = "249d2911-7931-4aa0-a696-37d8370b79f9";
const base = { projectId: "p1", memberId: "m1" };

describe("buildInviteLink", () => {
  it("sends build-games invitees to the staged submit form, keyed by member id", () => {
    const link = buildInviteLink({ ...base, hackathonId: BUILD_GAMES, stage: 2 });
    expect(link).toContain("/build-games/submit?stage=2&invitation=m1");
  });

  it("defaults build-games to stage 1", () => {
    expect(buildInviteLink({ ...base, hackathonId: BUILD_GAMES })).toContain("stage=1");
  });

  it("sends mini-grant invitees to the wizard, keyed by project id", () => {
    const link = buildInviteLink({ ...base, hackathonId: MINI_GRANT_HACKATHON_ID });
    expect(link).toContain(`/grants/${MINI_GRANT_SLUG}/apply?project=p1`);
    expect(link).not.toContain("invitation=");
  });

  it("falls back to the generic event submission page for any other hackathon", () => {
    const link = buildInviteLink({ ...base, hackathonId: "some-other-event" });
    expect(link).toContain("/events/project-submission?event=some-other-event&invitation=m1#team");
  });

  it("percent-encodes a hostile hackathon id instead of letting it into the URL raw", () => {
    const hostile = 'x"><a href="https://evil.test">Claim your grant</a><a href="';
    const link = buildInviteLink({ ...base, hackathonId: hostile });
    expect(link).not.toContain('"');
    expect(link).not.toContain("<");
    expect(link).toContain(`event=${encodeURIComponent(hostile)}`);
  });
});
