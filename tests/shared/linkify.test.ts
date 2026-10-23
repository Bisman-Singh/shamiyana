import { linkify } from "@/lib/shared/linkify";

describe("linkify", () => {
  it("turns bare https links into link runs", () => {
    expect(linkify("See https://ai.google.dev/gemini-api/terms for more")).toEqual([
      { at: 0, text: "See ", link: false },
      { at: 4, text: "https://ai.google.dev/gemini-api/terms", link: true },
      { at: 42, text: " for more", link: false },
    ]);
  });
});
