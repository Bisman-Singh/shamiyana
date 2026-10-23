// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { useToday } from "@/components/planner/use-today";

afterEach(() => {
  vi.useRealTimers();
});

describe("useToday", () => {
  it("rolls today over while the page stays open", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 21, 23, 59, 30));
    const { result } = renderHook(() => useToday());
    expect(result.current).toBe("2026-10-21");
    act(() => {
      vi.setSystemTime(new Date(2026, 9, 22, 0, 0, 40));
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe("2026-10-22");
  });
});
