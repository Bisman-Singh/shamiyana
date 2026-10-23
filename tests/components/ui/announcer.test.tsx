// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { useAnnounce } from "@/components/ui/announcer";

describe("useAnnounce without a provider", () => {
  it("is a harmless no-op", () => {
    const { result } = renderHook(() => useAnnounce());
    expect(() => {
      result.current("hello");
    }).not.toThrow();
  });
});
