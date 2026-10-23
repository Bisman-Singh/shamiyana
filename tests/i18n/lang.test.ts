import { langOf } from "@/lib/i18n/lang";

describe("langOf", () => {
  it("marks text in the other language by its script", () => {
    expect(langOf("Marigold courtyard", "hi")).toBe("en");
    expect(langOf("गेंदे का आँगन", "en")).toBe("hi");
    expect(langOf("डीजे और DJ booth", "en")).toBe("hi");
  });

  it("leaves text in the page's language, and text with no letters, to the page", () => {
    expect(langOf("Marigold courtyard", "en")).toBeUndefined();
    expect(langOf("गेंदे का आँगन", "hi")).toBeUndefined();
    expect(langOf("₹1,50,000 · 2027", "hi")).toBeUndefined();
  });
});
