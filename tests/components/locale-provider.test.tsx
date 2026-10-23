// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { useLocale } from "@/components/locale-provider";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useLocale", () => {
  it("refuses to run without a locale provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderHook(() => useLocale())).toThrow("useLocale needs a LocaleProvider");
  });
});
