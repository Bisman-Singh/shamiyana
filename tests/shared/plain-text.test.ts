import { cleanText, clip } from "@/lib/shared/plain-text";

describe("cleanText", () => {
  it("removes control characters and bidi overrides", () => {
    expect(cleanText("a\u0000b\u202Ec\u2066d\u007F")).toBe("a b c d");
  });

  it("removes C1 control characters too", () => {
    expect(cleanText("a\u0085b\u009Fc")).toBe("a b c");
  });

  it("drops newlines unless asked to keep them", () => {
    expect(cleanText("one\ntwo")).toBe("one two");
    expect(cleanText("one  \r\ntwo\tthree", true)).toBe("one\ntwo three");
  });

  it("normalises to NFC and trims", () => {
    expect(cleanText("  café  ")).toBe("café");
  });
});

describe("clip", () => {
  it("returns an empty string for anything that is not text", () => {
    expect(clip(42, 10)).toBe("");
    expect(clip(null, 10)).toBe("");
  });

  it("flattens whitespace into one line", () => {
    expect(clip("  Marigold\n\n canopy\t", 50)).toBe("Marigold canopy");
  });

  it("never splits a Devanagari conjunct", () => {
    const word = "क्षत्रिय";
    const cut = clip(`${word} ${word}`, 3);
    expect(cut.length).toBeLessThanOrEqual(3);
    expect(cut).toBe("क्ष");
  });

  it("never splits an emoji sequence and stays within the unit budget", () => {
    const family = "\u{1F468}‍\u{1F469}‍\u{1F467}";
    expect(clip(`${family}${family}`, family.length + 1)).toBe(family);
  });

  it("trims a trailing space left by the cut", () => {
    expect(clip("ab cd", 3)).toBe("ab");
  });
});
