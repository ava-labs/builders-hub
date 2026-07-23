import { describe, expect, it } from "vitest";
import { emailSchema, isValidEmail } from "@/lib/email";

// The invite route validates `z.array(emailSchema)` atomically, so any address the
// UI accepts must also pass the schema — otherwise one chip rejects a whole batch.
describe("isValidEmail / emailSchema agree", () => {
  const samples = [
    "user@example.com",
    "first.last@sub.example.co.uk",
    "user+tag@example.com",
    "user_name@example-domain.com",
    "josé@example.com",
    "用户@例子.广告",
    "a@b.c",
    "joe@example..com",
    ".a@b.com",
    "a@b.com.",
    "notanemail",
    "",
  ];

  it.each(samples)("%s: the UI check matches the server schema", (email) => {
    expect(isValidEmail(email)).toBe(emailSchema.safeParse(email).success);
  });

  it("accepts ordinary addresses", () => {
    expect(isValidEmail("teammate@example.com")).toBe(true);
  });

  it("rejects obvious garbage", () => {
    expect(isValidEmail("notanemail")).toBe(false);
    expect(isValidEmail("a b@example.com")).toBe(false);
  });
});

// Characterization of the unified rule (Zod's email check), pinning exactly which
// addresses the platform accepts. Notable deliberate semantics, verified below:
// - plus-addressing and _ ' - in the local part are in;
// - RFC-5321-valid oddities (specials like !#$%&, quoted local parts, IP domains)
//   are out — Zod is stricter than the RFC on purpose;
// - unicode anywhere (josé@, münchen.de) is out — this is the tightening vs. the
//   old hand-rolled regex, see the module comment in lib/email.ts;
// - single-letter TLDs are out, any 2+ letter TLD of any length is in.
describe("isValidEmail semantics", () => {
  const valid = [
    // ordinary shapes
    "user@example.com",
    "first.last@example.com",
    "first.middle.last@example.com",
    "a.b.c.d@example.com",
    "user_name@example.com",
    "_underscore@example.com",
    "user-name@example.com",
    "a-b@c-d.ef",
    "123@example.com",
    "user123@example123.com",
    "o'brien@example.ie",
    // plus-addressing
    "user+tag@example.com",
    "user+tag+more@example.com",
    "user+filter123@example.co.uk",
    "+tag@example.com",
    "tag+@example.com",
    "a+b.c+d@example.com",
    // case-insensitive
    "USER@EXAMPLE.COM",
    "MixedCase@Example.Org",
    "uSeR+TaG@sUb.ExAmPlE.cOm",
    // short but legal
    "a@b.co",
    "a@b.cc",
    "user@e.co",
    "u@io.io",
    // new / long gTLDs
    "u@example.network",
    "team@build.racing",
    "dev@example.dev",
    "hi@example.xyz",
    "user@example.app",
    "user@example.codes",
    "user@example.museum",
    "user@example.travel",
    "user@example.photography",
    "user@example.accountants",
    "user@example.international",
    "user@example.veryverylongtldxx",
    "builder@avax.network",
    "gamer@team.games",
    "user@example.solutions",
    "user@example.ventures",
    // country / multi-level domains
    "user@example.co.uk",
    "user@ex-ample.co.uk",
    "user@example.com.br",
    "user@example.org.au",
    "x@sub.domain.example.travel",
    "user@a.b.c.d.example.com",
    "user@deep.sub.example.network",
    // hyphens & digits in domains
    "user@example-domain.com",
    "user@my-very-long-domain-name.com",
    "user@123domain.com",
    "user@domain123.net",
    "user@1.example.com",
    // punycode (the ASCII form of an IDN is fine; the unicode form is not)
    "user@xn--bcher-kva.com",
    "user@xn--mnchen-3ya.de",
    // long parts
    "verylonglocalpartverylonglocalpartverylonglocalpartverylonglocal@example.com",
    "user@verylongsubdomainverylongsubdomainverylongsubdomain.example.com",
    "first.last+very.long.tag.chain@some.deeply.nested.example.network",
    // combinations
    "o'connor+newsletter@example-domain.co.uk",
    "dev_ops-team+alerts@ci.example.solutions",
    "a_b-c'd+e.f@example.com",
    "x@y.zw",
    "root@example.engineering",
    "hello@example.consulting",
    "info@example.properties",
    // Zod quirk, pinned so an upgrade that changes it is noticed: a trailing
    // hyphen in a domain label is not rejected.
    "user@example-.com",
  ];

  const invalid = [
    // structure
    "plain",
    "",
    "@example.com",
    "user@",
    "user",
    "user@@example.com",
    "double@@example.com",
    "a@b@c.com",
    "user@example.com@example.com",
    // whitespace
    "user @example.com",
    "user@ example.com",
    "us er@example.com",
    "user@exam ple.com",
    " user@example.com",
    "user@example.com ",
    // dot placement
    ".leading@example.com",
    "trailing.@example.com",
    "user..double@example.com",
    "user@.example.com",
    "user@example..com",
    "user@example.com.",
    // domain shape
    "user@example",
    "user@localhost",
    "user@-example.com",
    "a@b.c",
    "1@2.3",
    "user@example.c",
    // RFC-valid but rejected by the unified rule
    '"quoted"@example.com',
    "user@[192.168.1.1]",
    "user@192.168.1.1",
    "user!def@example.com",
    "user#tag@example.com",
    "user$@example.com",
    "user&x@example.com",
    "user%40@example.com",
    "user@exa_mple.com",
    // unicode — the deliberate tightening vs. the old regex
    "josé@example.com",
    "用户@example.com",
    "user@münchen.de",
    "user@例子.广告",
  ];

  it.each(valid)("accepts %s", (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  it.each(invalid)("rejects %s", (email) => {
    expect(isValidEmail(email)).toBe(false);
  });

  it("keeps at least 30% failing cases in this suite", () => {
    expect(invalid.length / (valid.length + invalid.length)).toBeGreaterThanOrEqual(0.3);
  });

  it("client check and server schema agree on every case", () => {
    for (const email of [...valid, ...invalid]) {
      expect(isValidEmail(email)).toBe(emailSchema.safeParse(email).success);
    }
  });
});
