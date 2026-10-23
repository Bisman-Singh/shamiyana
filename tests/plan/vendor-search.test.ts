import { EVENT_TYPES } from "@/lib/plan/constants";
import { BASE_SHARES } from "@/lib/plan/shares";
import { VENDOR_SEARCH, vendorSearch } from "@/lib/plan/vendor-search";

describe("vendor search", () => {
  it.each(EVENT_TYPES)("only searches for vendors the %s budget has", (type) => {
    for (const category of Object.keys(VENDOR_SEARCH[type])) {
      expect(BASE_SHARES[type]).toHaveProperty(category);
    }
  });

  it("falls back to a plain phrase for a line the event type doesn't usually hire for", () => {
    expect(vendorSearch("wedding", "catering")).toBe("wedding caterers");
    expect(vendorSearch("birthday", "rituals")).toBe("pandit services");
  });
});
