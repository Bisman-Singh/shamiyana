import { nextTabIndex } from "@/components/ui/tabs";

describe("nextTabIndex", () => {
  it("moves through tabs with wrap-around and ignores other keys", () => {
    expect(nextTabIndex("ArrowRight", 5, 6)).toBe(0);
    expect(nextTabIndex("ArrowLeft", 0, 6)).toBe(5);
    expect(nextTabIndex("End", 2, 6)).toBe(5);
    expect(nextTabIndex("a", 2, 6)).toBeNull();
  });
});
