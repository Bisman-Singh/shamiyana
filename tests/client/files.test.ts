// @vitest-environment jsdom
import { readTextFile } from "@/lib/client/files";

describe("readTextFile", () => {
  it("reads small text files only", async () => {
    expect(await readTextFile(new File(["hello"], "a.json"), 10)).toBe("hello");
    expect(await readTextFile(new File(["hello world"], "a.json"), 5)).toBeNull();
  });
});
