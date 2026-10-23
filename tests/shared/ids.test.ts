import { newId, stableId } from "@/lib/shared/ids";

describe("ids", () => {
  it("makes random ids and stable content ids", () => {
    expect(newId()).toMatch(/^[0-9a-f-]{36}$/);
    expect(stableId("ai", "Book tent")).toBe(stableId("ai", "Book tent"));
    expect(stableId("ai", "Book tent")).not.toBe(stableId("ai", "Book tents"));
    expect(stableId("ai", "मेहंदी")).toMatch(/^ai-[0-9a-z]+$/);
  });
});
