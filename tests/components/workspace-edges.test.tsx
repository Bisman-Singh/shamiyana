// @vitest-environment jsdom
import { factsOf } from "@/lib/plan/schema";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { formatMoney } from "@/lib/i18n/format";
import { planBudget } from "@/lib/plan/budget";
import { saveIdea, withEnrichment } from "@/lib/plan/record";
import { NOW, TODAY, recordFor, sampleEnrichment, weddingBrief } from "../helpers/fixtures";
import { stubCanvas, stubObjectUrls } from "../helpers/browser";
import { jsonError, mockFetch, streamed } from "../helpers/fetch";
import { renderIn } from "../helpers/render";
import { openTab, panel, renderWorkspace } from "../helpers/workspace";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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
    stubCanvas();
    const { revoke } = stubObjectUrls("blob:p");
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
    const venue = planBudget(factsOf(weddingBrief), {});
    const shifted = planBudget(factsOf(weddingBrief), { venue: 0.8 });
    const amount = (lines: typeof venue) =>
      formatMoney(lines.find((l) => l.category === "venue")?.amount ?? 0, "en");
    const text = `Less for Venue: ${amount(venue)} to ${amount(shifted)}`;
    expect(panel().getByText(text)).toBeInTheDocument();
    await userEvent.click(panel().getByRole("button", { name: /^Apply/ }));
    expect(panel().getByText(text)).toBeInTheDocument();
    const { BudgetPanel } = await import("@/components/planner/budget-panel");
    const { usePlanView } = await import("@/components/planner/workspace/use-plan-view");
    function NoFood() {
      const view = usePlanView(recordFor(weddingBrief), TODAY);
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
    stubCanvas();
    stubObjectUrls("blob:p");
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
