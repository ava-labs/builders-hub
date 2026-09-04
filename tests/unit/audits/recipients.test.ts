import { describe, expect, it, vi, beforeEach } from "vitest";

const { sendMailMock } = vi.hoisted(() => ({ sendMailMock: vi.fn() }));
vi.mock("@/server/services/mail", () => ({ sendMail: sendMailMock }));

import { firmContact, recipientsOf, sendToFirm } from "@/server/services/audits/emails/recipients";

beforeEach(() => {
  sendMailMock.mockReset();
  sendMailMock.mockResolvedValue(undefined);
});

describe("recipientsOf", () => {
  it("is the quote email plus every approved teammate, lowercased and de-duplicated", () => {
    expect(
      recipientsOf({
        quote_email: "quotes@nordlicht.example",
        members: [
          { email: "Alice@Nordlicht.Example" },
          { email: "quotes@nordlicht.example" },
          { email: "bob@nordlicht.example" },
        ],
      }),
    ).toEqual(["quotes@nordlicht.example", "alice@nordlicht.example", "bob@nordlicht.example"]);
  });

  it("degrades to the quote email when a row was loaded without members", () => {
    expect(recipientsOf({ quote_email: "quotes@nordlicht.example" })).toEqual([
      "quotes@nordlicht.example",
    ]);
  });
});

describe("firmContact", () => {
  const FIRM = {
    quote_email: "quotes@nordlicht.example",
    members: [{ email: "alice@nordlicht.example" }],
  };

  it("hands the project the teammate who saved the quote while that address is still approved", () => {
    expect(firmContact(FIRM, "Alice@Nordlicht.Example")).toBe("alice@nordlicht.example");
    expect(firmContact(FIRM, "quotes@nordlicht.example")).toBe("quotes@nordlicht.example");
  });

  it("falls back to the quote email for a removed teammate or a quote saved before team access", () => {
    expect(firmContact(FIRM, "gone@nordlicht.example")).toBe("quotes@nordlicht.example");
    expect(firmContact(FIRM, null)).toBe("quotes@nordlicht.example");
    expect(firmContact({ quote_email: "quotes@nordlicht.example" }, "x@nordlicht.example")).toBe(
      "quotes@nordlicht.example",
    );
  });
});

describe("sendToFirm", () => {
  it("sends the same message to every address", async () => {
    await sendToFirm(["a@x.example", "b@x.example"], "<p>hi</p>", "Subject", "hi");

    expect(sendMailMock).toHaveBeenCalledTimes(2);
    expect(sendMailMock.mock.calls.map((call) => call[0])).toEqual(["a@x.example", "b@x.example"]);
    expect(sendMailMock.mock.calls[1].slice(1)).toEqual(["<p>hi</p>", "Subject", "hi"]);
  });

  it("counts the firm as reached when one address fails but another succeeds", async () => {
    sendMailMock.mockRejectedValueOnce(new Error("bounce"));

    await expect(
      sendToFirm(["a@x.example", "b@x.example"], "h", "s", "t"),
    ).resolves.toBeUndefined();
  });

  it("rejects only when every address fails, and with no recipients", async () => {
    sendMailMock.mockRejectedValue(new Error("sendgrid down"));

    await expect(sendToFirm(["a@x.example"], "h", "s", "t")).rejects.toThrow("sendgrid down");
    await expect(sendToFirm([], "h", "s", "t")).rejects.toThrow();
  });
});
