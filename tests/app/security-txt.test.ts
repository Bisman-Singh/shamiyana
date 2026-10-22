import { readFileSync } from "node:fs";

const DAY = 86_400_000;

describe("security.txt", () => {
  const fields = new Map(
    readFileSync("public/.well-known/security.txt", "utf8")
      .trim()
      .split("\n")
      .map((line) => {
        const [key = "", ...rest] = line.split(": ");
        return [key, rest.join(": ")] as const;
      }),
  );

  it("names a contact, the policy and its own canonical address", () => {
    expect(fields.get("Contact")).toBe(
      "https://github.com/Bisman-Singh/shamiyana/security/advisories/new",
    );
    expect(fields.get("Policy")).toMatch(/SECURITY\.md$/);
    expect(fields.get("Canonical")).toMatch(/^https:\/\/.+\/\.well-known\/security\.txt$/);
    expect(fields.get("Preferred-Languages")).toBe("en, hi");
  });

  it("expires within a year, as RFC 9116 asks, and is not stale", () => {
    const left = Date.parse(fields.get("Expires") ?? "") - Date.now();
    expect(left).toBeGreaterThan(0);
    expect(left).toBeLessThanOrEqual(366 * DAY);
  });
});
