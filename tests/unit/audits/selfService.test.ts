import { describe, expect, it } from "vitest";
import { auditorSelfUpdateSchema, auditorUpdateSchema } from "@/types/audits";
import { isFirmOwner } from "@/app/api/audits/portal/utils";

describe("auditorSelfUpdateSchema", () => {
  it("accepts a services subset and a website", () => {
    const parsed = auditorSelfUpdateSchema.safeParse({ services: ["OpSec"], website: "avax.network" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.website).toBe("https://avax.network");
  });

  it("turns an empty website into null and dedupes services (S-14)", () => {
    const parsed = auditorSelfUpdateSchema.safeParse({ services: ["OpSec", "OpSec"], website: "" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.website).toBeNull();
      expect(parsed.data.services).toEqual(["OpSec"]);
    }
  });

  it("rejects active, firm_name, quote_email, logo_url and unknown keys", () => {
    for (const bad of [
      { active: false },
      { firm_name: "X" },
      { quote_email: "a@b.example" },
      { logo_url: "https://x" },
      { attio_ref: "y" },
    ]) {
      expect(auditorSelfUpdateSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("rejects a non-http(s) scheme, javascript: and a bare scheme (S-7)", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "vbscript:x", "https://"]) {
      expect(auditorSelfUpdateSchema.safeParse({ website: bad }).success).toBe(false);
    }
  });
});

describe("auditorUpdateSchema (admin) gains website and logo_url", () => {
  it("dedupes services and accepts a null website", () => {
    const parsed = auditorUpdateSchema.safeParse({ services: ["OpSec", "OpSec"], website: "" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.services).toEqual(["OpSec"]);
  });
});

describe("isFirmOwner", () => {
  it("is true only for the quote email", () => {
    const firm = { quote_email: "quotes@nordlicht.example" };
    expect(isFirmOwner(firm, "quotes@nordlicht.example")).toBe(true);
    expect(isFirmOwner(firm, "alice@nordlicht.example")).toBe(false);
  });
});
