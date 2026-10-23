import { planRequestSchema } from "@/lib/api/contracts";
import { FIXED_NOW } from "../helpers/ai";
import { TODAY, weddingFacts } from "../helpers/fixtures";

describe("request schemas", () => {
  it("accepts a device date a day either side of the server", () => {
    const schema = planRequestSchema(FIXED_NOW);
    for (const today of ["2026-10-20", TODAY, "2026-10-22"]) {
      expect(schema.safeParse({ facts: weddingFacts, locale: "en", today }).success).toBe(true);
    }
    expect(schema.parse({ facts: weddingFacts, locale: "hi", today: TODAY }).fresh).toBe(false);
  });
});
