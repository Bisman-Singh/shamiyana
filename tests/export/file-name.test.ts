import { fileName } from "@/lib/export/file-name";

describe("fileName", () => {
  it("makes safe file names in any script", () => {
    expect(fileName("Winter wedding in Jaipur!", "ics")).toBe("winter-wedding-in-jaipur.ics");
    expect(fileName("../../etc/passwd", "csv")).toBe("etc-passwd.csv");
    expect(fileName("दादी का जन्मदिन", "csv")).toBe("दादी-का-जन्मदिन.csv");
    expect(fileName("!!!", "json")).toBe("plan.json");
    expect(fileName(`${"a".repeat(47)} b`, "ics")).toBe(`${"a".repeat(47)}.ics`);
  });
});
