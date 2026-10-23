// @vitest-environment jsdom
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { useLocale } from "@/components/locale-provider";
import { useToday } from "@/components/planner/planner-parts";
import { taskTitle } from "@/components/planner/task-title";
import { CheckGroup, RadioGroup, SelectField, TextArea, TextField } from "@/components/ui/field";
import { nextTabIndex } from "@/components/ui/tabs";
import { getDictionary } from "@/lib/i18n";
import { draftFromBrief } from "@/lib/plan/draft";
import { communityBrief } from "../fixtures";
import { expectAccessible } from "../helpers/render";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("small pieces", () => {
  it("hands over the chosen option and ignores a value outside the options", () => {
    const onValueChange = vi.fn();
    render(
      <SelectField
        id="size"
        label="Size"
        value="m"
        onValueChange={onValueChange}
        options={[
          { value: "s", label: "Small" },
          { value: "m", label: "Medium" },
        ]}
      />,
    );
    const select = screen.getByLabelText("Size");
    fireEvent.change(select, { target: { value: "s" } });
    expect(onValueChange).toHaveBeenCalledWith("s");
    fireEvent.change(select, { target: { value: "xl" } });
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it("refuses to run without a locale provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderHook(() => useLocale())).toThrow("useLocale needs a LocaleProvider");
  });

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

  it("falls back to a task's id when it has no title or translation", () => {
    const dict = getDictionary("en");
    expect(taskTitle({ id: "unknown_task", title: null }, dict)).toBe("unknown_task");
    expect(taskTitle({ id: "w_book_venue", title: null }, dict)).toBe(
      "Visit and book the main venue",
    );
  });

  it("moves through tabs with wrap-around and ignores other keys", () => {
    expect(nextTabIndex("ArrowRight", 5, 6)).toBe(0);
    expect(nextTabIndex("ArrowLeft", 0, 6)).toBe(5);
    expect(nextTabIndex("End", 2, 6)).toBe(5);
    expect(nextTabIndex("a", 2, 6)).toBeNull();
  });

  it("keeps a community event's kind when editing", () => {
    expect(draftFromBrief(communityBrief).kind).toBe("festival");
  });
});

describe("form controls", () => {
  it("ties hints and errors to their controls", async () => {
    const { container } = render(
      <form>
        <TextField id="a" label="Name" hint="Your name" error="Required" />
        <TextArea id="b" label="Notes" />
        <TextArea id="b2" label="Story" error="Too long" />
        <SelectField
          id="c"
          label="Pick"
          hint="One of these"
          error="Pick one"
          value="x"
          onValueChange={vi.fn()}
          options={[{ value: "x", label: "X" }]}
        />
        <SelectField
          id="d"
          label="Plain"
          value="y"
          onValueChange={vi.fn()}
          options={[{ value: "y", label: "Y" }]}
        />
        <RadioGroup
          id="e"
          name="e"
          legend="Size"
          value="s"
          onChange={vi.fn()}
          options={[{ value: "s", label: "Small", hint: "Under 50" }]}
        />
        <CheckGroup
          id="f"
          name="f"
          legend="Extras"
          value={[]}
          onChange={vi.fn()}
          options={[{ value: "z", label: "Z" }]}
        />
      </form>,
    );
    expect(screen.getByLabelText("Name")).toHaveAccessibleDescription("Your name Required");
    expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Notes")).not.toHaveAttribute("aria-describedby");
    expect(screen.getByLabelText("Story")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Pick")).toHaveAccessibleDescription("One of these Pick one");
    expect(screen.getByLabelText("Plain")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByText("Under 50")).toBeInTheDocument();
    await expectAccessible(container);
  });
});

describe("announcer without a provider", () => {
  it("is a harmless no-op", async () => {
    const { useAnnounce } = await import("@/components/ui/announcer");
    const { result } = renderHook(() => useAnnounce());
    expect(() => {
      result.current("hello");
    }).not.toThrow();
  });
});
