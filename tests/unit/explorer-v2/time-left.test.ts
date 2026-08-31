import { describe, expect, it } from "vitest";
import { formatTime, timeLeft } from "../../../components/explorer-v2/format";

const NOW_MS = Date.UTC(2026, 7, 31, 12, 0, 0); // 2026-08-31 12:00:00 UTC
const NOW_SECS = NOW_MS / 1000;

describe("timeLeft", () => {
  it("keeps whole days as the figure while a day or more remains", () => {
    const end = NOW_SECS + 73 * 86_400 + 5 * 3_600 + 12 * 60 + 30;
    const t = timeLeft(end, NOW_MS);
    expect(t.days).toBe(73);
    expect(t.value).toBe("73");
    expect(t.short).toBe("73d");
    expect(t.precise).toBe(`73d 5h 12m left · ends ${formatTime(end)}`);
  });

  it("spells out zero hours and minutes on an exact day boundary", () => {
    const end = NOW_SECS + 3 * 86_400;
    const t = timeLeft(end, NOW_MS);
    expect(t.value).toBe("3");
    expect(t.precise).toBe(`3d 0h 0m left · ends ${formatTime(end)}`);
  });

  it("switches the figure to hours and minutes under a day", () => {
    const end = NOW_SECS + 18 * 3_600 + 24 * 60 + 59;
    const t = timeLeft(end, NOW_MS);
    expect(t.days).toBe(0);
    expect(t.value).toBe("18h 24m");
    expect(t.short).toBe("18h 24m");
    expect(t.precise).toBe(`18h 24m left · ends ${formatTime(end)}`);
  });

  it("shows minutes alone under an hour", () => {
    const end = NOW_SECS + 45 * 60 + 10;
    const t = timeLeft(end, NOW_MS);
    expect(t.value).toBe("45m");
    expect(t.precise).toBe(`45m left · ends ${formatTime(end)}`);
  });

  it("clamps to zero once the end has passed", () => {
    const end = NOW_SECS - 3_600;
    const t = timeLeft(end, NOW_MS);
    expect(t.days).toBe(0);
    expect(t.value).toBe("0m");
    expect(t.precise).toBe(`0m left · ends ${formatTime(end)}`);
  });

  it("formats large day counts through formatNumber", () => {
    const end = NOW_SECS + 1_001 * 86_400;
    expect(timeLeft(end, NOW_MS).value).toBe("1,001");
  });
});
