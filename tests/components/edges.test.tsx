// @vitest-environment jsdom
import { factsOf } from "@/lib/plan/schema";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocale } from "@/components/locale-provider";
import { useToday } from "@/components/planner/planner-parts";
import { Planner } from "@/components/planner/planner";
import { taskTitle } from "@/components/planner/task-title";
import { CheckGroup, RadioGroup, SelectField, TextArea, TextField } from "@/components/ui/field";
import { nextTabIndex } from "@/components/ui/tabs";
import { PlanStore } from "@/lib/client/plan-store";
import { getDictionary } from "@/lib/i18n";
import { draftFromBrief } from "@/lib/plan/draft";
import { saveIdea, withEnrichment } from "@/lib/plan/record";
import { NOW, communityBrief, recordFor, sampleEnrichment, weddingBrief } from "../fixtures";
import { jsonError, mockFetch, streamed } from "../helpers/fetch";
import { expectAccessible, renderIn } from "../helpers/render";
import { MemoryStorage } from "../helpers/storage";
import { openTab, panel, renderWorkspace } from "../helpers/workspace";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("small pieces", () => {
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
          options={[{ value: "x", label: "X" }]}
        />
        <SelectField id="d" label="Plain" options={[{ value: "y", label: "Y" }]} />
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

describe("brief form fields", () => {
  it("accepts typed values in every field and every choice", async () => {
    const onSubmit = vi.fn();
    const { BriefForm } = await import("@/components/planner/brief-form");
    renderIn(<BriefForm today="2026-10-21" editing={false} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText("Event name"), "Mela");
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-12-01" } });
    await userEvent.type(screen.getByLabelText("City or town"), "Pune");
    await userEvent.type(screen.getByLabelText("Guests"), "300");
    await userEvent.type(screen.getByLabelText("Total budget in rupees"), "250000");
    await userEvent.click(screen.getByRole("radio", { name: "Modern" }));
    await userEvent.click(screen.getByRole("radio", { name: "Jain" }));
    await userEvent.type(screen.getByLabelText(/Anything else/), "Rangoli");
    await userEvent.click(screen.getByRole("button", { name: "Make my plan" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Mela",
        guests: 300,
        budget: 2_50_000,
        style: "modern",
        food: "jain",
        notes: "Rangoli",
      }),
    );
  });
});

describe("workspace edges", () => {
  const ready = () =>
    withEnrichment(
      recordFor(weddingBrief),
      sampleEnrichment,
      { facts: factsOf(weddingBrief), locale: "en" },
      NOW,
    );

  beforeEach(() => {
    mockFetch({ "/api/plan": () => jsonError("ai_unavailable", 503) });
  });

  it("lowers a category with Less", async () => {
    const { saved } = renderWorkspace(ready());
    await openTab("Budget");
    const group = panel().getByRole("group", { name: "Adjust Venue" });
    await userEvent.click(group.querySelector("button") ?? group);
    expect(saved.current.factors).toEqual({ venue: 0.9 });
  });

  it("shows a saved idea that has no detail", async () => {
    const record = saveIdea(
      ready(),
      { id: "i1", area: "music", title: "Dhol at the entry", detail: "" },
      NOW,
    );
    renderWorkspace(record);
    await openTab("Ideas");
    expect(panel().getByText("Dhol at the entry", { selector: ".idea-title" })).toBeInTheDocument();
  });

  it("ignores an empty file pick and frees the preview when leaving", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(() => Promise.resolve({ width: 10, height: 10, close: vi.fn() })),
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as never);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((done) => {
      done(new Blob(["j"], { type: "image/jpeg" }));
    });
    const revoke = vi.fn();
    vi.stubGlobal(
      "URL",
      Object.assign(URL, { createObjectURL: vi.fn(() => "blob:p"), revokeObjectURL: revoke }),
    );
    const { unmount } = renderWorkspace(ready());
    await openTab("Ideas");
    const input = panel().getByLabelText("Choose a photo");
    fireEvent.change(input, { target: { files: [] } });
    expect(panel().queryByRole("img")).toBeNull();
    await userEvent.upload(input, new File(["x"], "a.jpg", { type: "image/jpeg" }));
    await panel().findByRole("img");
    unmount();
    expect(revoke).toHaveBeenCalledWith("blob:p");
  });

  it("does not send an empty chat message", async () => {
    const fetch = mockFetch({
      "/api/plan": () => jsonError("ai_unavailable", 503),
      "/api/refine": () => Response.json({}),
    });
    renderWorkspace(ready());
    await openTab("Ideas");
    const form = panel().getByLabelText("Your message").closest("form");
    fireEvent.submit(form ?? document.body);
    expect(fetch.bodies["/api/refine"]).toBeUndefined();
  });

  it("drops a stream answer that has nothing usable", async () => {
    mockFetch({ "/api/plan": () => streamed(["{"]) });
    const { saved } = renderWorkspace(recordFor(weddingBrief));
    expect(await screen.findByText(/stopped early/)).toBeInTheDocument();
    expect(saved.current.enrichment).toBeNull();
  });
});

describe("budget and photo edges", () => {
  it("words a downward AI shift and handles a plan with no food line", async () => {
    mockFetch({ "/api/plan": () => jsonError("ai_unavailable", 503) });
    const shifts = [{ category: "venue" as const, factor: 0.8, reason: "Home venue." }];
    const record = withEnrichment(
      recordFor(weddingBrief),
      { ...sampleEnrichment, shifts },
      { facts: factsOf(weddingBrief), locale: "en" },
      NOW,
    );
    renderWorkspace(record);
    await openTab("Budget");
    expect(panel().getByText("Less for Venue by 20%")).toBeInTheDocument();
    const { BudgetPanel } = await import("@/components/planner/budget-panel");
    const { usePlanView } = await import("@/components/planner/workspace");
    function NoFood() {
      const view = usePlanView(recordFor(weddingBrief), "2026-10-21");
      return (
        <BudgetPanel
          view={{ ...view, budget: { ...view.budget, perGuestCatering: null } }}
          ideas={null}
          update={vi.fn()}
        />
      );
    }
    renderIn(<NoFood />);
    expect(screen.getAllByText(/left to commit/).at(-1)?.textContent).not.toContain("per guest");
  });

  it("shows a photo answer without colours or notes", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(() => Promise.resolve({ width: 10, height: 10, close: vi.fn() })),
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as never);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((done) => {
      done(new Blob(["j"], { type: "image/jpeg" }));
    });
    vi.stubGlobal(
      "URL",
      Object.assign(URL, { createObjectURL: vi.fn(() => "blob:p"), revokeObjectURL: vi.fn() }),
    );
    mockFetch({
      "/api/plan": () => jsonError("ai_unavailable", 503),
      "/api/vision": () =>
        Response.json({
          kind: "other",
          mood: "A screenshot",
          palette: [],
          ideas: [{ area: "theme", title: "Keep it simple", detail: "" }],
          notes: [],
        }),
    });
    renderWorkspace(
      withEnrichment(
        recordFor(weddingBrief),
        sampleEnrichment,
        { facts: factsOf(weddingBrief), locale: "en" },
        NOW,
      ),
    );
    await openTab("Ideas");
    await userEvent.upload(
      panel().getByLabelText("Choose a photo"),
      new File(["x"], "a.jpg", { type: "image/jpeg" }),
    );
    await userEvent.click(
      await panel().findByRole("button", { name: "Get ideas from this photo" }),
    );
    expect(await panel().findByText("A screenshot")).toBeInTheDocument();
    expect(panel().queryByText("Colours in the photo")).toBeNull();
    expect(panel().queryByText("Things to keep in mind")).toBeNull();
  });
});

describe("planner edges", () => {
  it("offers a shared plan even when full, but can't add it, and lists plans with none open", async () => {
    const { encodeShare } = await import("@/lib/export/share");
    window.history.replaceState(null, "", `/#plan=${await encodeShare(recordFor(weddingBrief))}`);
    const plans = Array.from({ length: 20 }, (_, i) => recordFor(weddingBrief, { id: `p${i}` }));
    const storage = new MemoryStorage();
    storage.setItem("shamiyana:v1", JSON.stringify({ version: 1, activeId: null, plans }));
    renderIn(<Planner store={new PlanStore(() => storage)} />);
    expect(await screen.findByRole("button", { name: "Add to my plans" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New plan" })).toHaveAccessibleDescription(
      /up to 20 plans/,
    );
    window.history.replaceState(null, "", "/");
  });

  it("ignores a restore with no file chosen", () => {
    const store = new PlanStore(() => new MemoryStorage());
    renderIn(<Planner store={store} />);
    fireEvent.change(screen.getByLabelText("Restore from a backup"), { target: { files: [] } });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("drops ideas that arrive for a plan deleted while they were being written", async () => {
    let release: () => void = () => undefined;
    const answer = JSON.stringify(sampleEnrichment);
    mockFetch({
      "/api/plan": () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(answer.slice(0, 40)));
              release = () => {
                controller.enqueue(new TextEncoder().encode(answer.slice(40)));
                controller.close();
              };
            },
          }),
        ),
    });
    const store = new PlanStore(() => new MemoryStorage());
    renderIn(<Planner store={store} />);
    await userEvent.click(screen.getByRole("button", { name: /Wedding in Jaipur/ }));
    await userEvent.click(screen.getByRole("button", { name: "Make my plan" }));
    await screen.findByText(/Gemini is writing ideas/);
    await userEvent.click(screen.getByRole("button", { name: "Delete this plan" }));
    release();
    await waitFor(() => {
      expect(store.getSnapshot().data.plans).toEqual([]);
    });
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
