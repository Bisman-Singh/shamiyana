// @vitest-environment jsdom
import { downloadText } from "@/lib/client/download";
import { stubObjectUrls } from "@/tests/helpers/browser";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("downloadText", () => {
  it("downloads text through a temporary link", () => {
    const { revoke } = stubObjectUrls("blob:file");
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    downloadText("plan.csv", "text/csv", "a,b");
    expect(click).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith("blob:file");
    expect(document.querySelector("a[download]")).toBeNull();
  });
});
