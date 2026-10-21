// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ErrorPage from "@/app/error";
import { LocaleProvider } from "@/components/locale-provider";
import { Planner } from "@/components/planner/planner";
import { AnnouncerProvider } from "@/components/ui/announcer";
import { PlanStore } from "@/lib/client/plan-store";
import { getDictionary } from "@/lib/i18n";
import { withEnrichment } from "@/lib/plan/record";
import { factsOf, type Brief } from "@/lib/plan/schema";
import { NOW, communityBrief, recordFor, sampleEnrichment, weddingBrief } from "../fixtures";
import { jsonError, mockFetch, streamed } from "../helpers/fetch";
import { MemoryStorage } from "../helpers/storage";
import { openTab, panel, renderWorkspace } from "../helpers/workspace";

/** The announcer's text once its frame-delayed update has landed. */
async function announced(text: string | RegExp) {
  await waitFor(() => {
    expect(screen.getByTestId("announcer")).toHaveTextContent(text);
  });
}

function planner() {
  const store = new PlanStore(() => new MemoryStorage());
  render(
    <LocaleProvider locale="en" dict={getDictionary("en")}>
      <AnnouncerProvider>
        <Planner store={store} />
      </AnnouncerProvider>
    </LocaleProvider>,
  );
  return store;
}

const ready = (brief: Brief = weddingBrief) =>
  withEnrichment(recordFor(brief), sampleEnrichment, { facts: factsOf(brief), locale: "en" }, NOW);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("focus follows every view change", () => {
  it("lands on the plan title after creating, editing and cancelling, and on the form title when it opens", async () => {
    mockFetch({ "/api/plan": () => jsonError("ai_unavailable", 503) });
    planner();
    expect(screen.getByRole("heading", { level: 1 })).not.toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: /Diwali mela/ }));
    await userEvent.click(screen.getByRole("button", { name: "Make my plan" }));
    expect(screen.getByRole("heading", { level: 1, name: "Block C Diwali mela" })).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Edit details" }));
    expect(screen.getByRole("heading", { level: 1, name: "Edit event details" })).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("heading", { level: 1, name: "Block C Diwali mela" })).toHaveFocus();
  });

  it("puts a deleted plan back with Undo and focuses it", async () => {
    mockFetch({ "/api/plan": () => jsonError("ai_unavailable", 503) });
    const store = planner();
    await userEvent.click(screen.getByRole("button", { name: /Diwali mela/ }));
    await userEvent.click(screen.getByRole("button", { name: "Make my plan" }));
    const id = store.getSnapshot().data.plans[0]?.id;
    await userEvent.click(screen.getByRole("button", { name: "Delete this plan" }));
    await announced("Deleted “Block C Diwali mela”.");
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(store.getSnapshot().data.plans.map((p) => p.id)).toEqual([id]);
    expect(screen.getByRole("heading", { level: 1, name: "Block C Diwali mela" })).toHaveFocus();
  });
});

describe("workspace focus and announcements", () => {
  beforeEach(() => {
    mockFetch({ "/api/plan": () => jsonError("ai_unavailable", 503) });
  });

  it("focuses Undo after a removal, the open panel after undoing, and drops Undo once the plan moves on", async () => {
    renderWorkspace(ready(communityBrief));
    await openTab("Timeline");
    await userEvent.click(
      panel().getByRole("button", { name: "Remove Fix the budget and the sponsorship target" }),
    );
    expect(screen.getByRole("button", { name: "Undo" })).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => {
      expect(screen.getByRole("tabpanel")).toHaveFocus();
    });
    await userEvent.click(
      panel().getByRole("button", { name: "Remove Fix the budget and the sponsorship target" }),
    );
    await userEvent.click(
      panel().getByRole("checkbox", { name: /Done: Form the organising committee/ }),
    );
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });

  it("sends focus to the wrong field, then announces and refocuses after an add", async () => {
    renderWorkspace(ready(communityBrief));
    await openTab("Timeline");
    await userEvent.click(panel().getByRole("button", { name: "Add task" }));
    expect(panel().getByLabelText("Task")).toHaveFocus();
    await userEvent.type(panel().getByLabelText("Task"), "Hire chairs");
    await userEvent.click(panel().getByRole("button", { name: "Add task" }));
    expect(panel().getByLabelText("Do it by")).toHaveFocus();
    fireEvent.change(panel().getByLabelText("Do it by"), { target: { value: "2026-11-01" } });
    await userEvent.click(panel().getByRole("button", { name: "Add task" }));
    await announced("Added “Hire chairs”.");
    expect(panel().getByLabelText("Task")).toHaveFocus();

    await openTab("Guests");
    await userEvent.click(panel().getByRole("button", { name: "Add" }));
    expect(panel().getByLabelText("Name or household")).toHaveFocus();
    await userEvent.type(panel().getByLabelText("Name or household"), "Nani");
    await userEvent.click(panel().getByRole("button", { name: "Add" }));
    await announced("Added Nani.");
    expect(panel().getByLabelText("Name or household")).toHaveFocus();
  });

  it("keeps focus on buttons that become unavailable, and ignores clicks on them", async () => {
    const record = { ...ready(), factors: { venue: 1.5 } };
    const { saved } = renderWorkspace(record);
    await openTab("Budget");
    const more = panel().getAllByRole("button", { name: "More" })[0] ?? document.body;
    more.focus();
    await userEvent.click(more);
    expect(saved.current.factors).toEqual({ venue: 1.5 });
    expect(more).toHaveFocus();
    const apply = panel().getByRole("button", { name: /^Apply/ });
    await userEvent.click(apply);
    expect(apply).toHaveFocus();
    await userEvent.click(apply);
    expect(saved.current.factors).toEqual({ venue: 1.5, decor: 1.2 });

    await openTab("Ideas");
    const save = panel().getAllByRole("button", { name: /^Save idea/ })[0] ?? document.body;
    await userEvent.click(save);
    expect(save).toHaveFocus();
    await userEvent.click(save);
    expect(saved.current.ideas).toHaveLength(1);
    await userEvent.click(panel().getByRole("button", { name: /^Remove/ }));
    await announced("Removed “Marigold canopy”.");
  });

  it("ignores Less at the lowest weight", async () => {
    const { saved } = renderWorkspace({ ...ready(), factors: { venue: 0.5 } });
    await openTab("Budget");
    const less = panel().getAllByRole("button", { name: "Less" })[0] ?? document.body;
    await userEvent.click(less);
    expect(saved.current.factors).toEqual({ venue: 0.5 });
  });

  it("does not move between tabs on a modified arrow key", async () => {
    renderWorkspace(ready());
    screen.getByRole("tab", { name: "Overview" }).focus();
    await userEvent.keyboard("{Alt>}{ArrowRight}{/Alt}");
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
  });
});

describe("AI announcements", () => {
  it("says when ideas are ready", async () => {
    mockFetch({ "/api/plan": () => streamed([JSON.stringify(sampleEnrichment)]) });
    renderWorkspace(recordFor(weddingBrief));
    await announced("Ideas ready.");
  });

  it("says when the assistant proposes nothing, and returns focus to the message box after Discard", async () => {
    let call = 0;
    mockFetch({
      "/api/plan": () => jsonError("ai_unavailable", 503),
      "/api/refine": () => {
        call += 1;
        return call === 1
          ? Response.json({ reply: "Music is already covered.", changes: [] })
          : Response.json({ reply: "Done.", changes: [{ op: "set_guests", count: 300 }] });
      },
    });
    renderWorkspace(ready());
    await openTab("Ideas");
    const box = panel().getByLabelText("Your message");
    await userEvent.click(box);
    await userEvent.paste("What about music?");
    await userEvent.click(panel().getByRole("button", { name: "Send" }));
    await announced("Music is already covered. No changes proposed.");
    expect(panel().getByText("No changes proposed.")).toBeInTheDocument();
    await userEvent.click(box);
    await userEvent.paste("Make it 300 guests");
    await userEvent.click(panel().getByRole("button", { name: "Send" }));
    await userEvent.click(await panel().findByRole("button", { name: "Discard" }));
    expect(box).toHaveFocus();
  });

  it("does not send a second message while the first is pending", async () => {
    let release: (r: Response) => void = () => undefined;
    const fetch = mockFetch({
      "/api/plan": () => jsonError("ai_unavailable", 503),
      "/api/refine": () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    });
    renderWorkspace(ready());
    await openTab("Ideas");
    await userEvent.click(panel().getByLabelText("Your message"));
    await userEvent.paste("Hello");
    const send = panel().getByRole("button", { name: "Send" });
    await userEvent.click(send);
    await userEvent.click(panel().getByRole("button", { name: "Thinking…" }));
    release(Response.json({ reply: "Hi.", changes: [] }));
    await announced(/Hi\./);
    expect(fetch.bodies["/api/refine"]).toHaveLength(1);
  });
});

describe("error page", () => {
  it("moves focus to what happened", () => {
    render(
      <LocaleProvider locale="en" dict={getDictionary("en")}>
        <ErrorPage reset={vi.fn()} />
      </LocaleProvider>,
    );
    expect(screen.getByRole("heading", { name: "Something went wrong" })).toHaveFocus();
  });
});

describe("photo guards", () => {
  it("sends one photo at a time and saves each idea once", async () => {
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
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:p");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    let release: (r: Response) => void = () => undefined;
    const fetch = mockFetch({
      "/api/plan": () => jsonError("ai_unavailable", 503),
      "/api/vision": () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    });
    const { saved } = renderWorkspace(ready());
    await openTab("Ideas");
    await userEvent.upload(
      panel().getByLabelText("Choose a photo"),
      new File(["x"], "a.jpg", { type: "image/jpeg" }),
    );
    const go = await panel().findByRole("button", { name: "Get ideas from this photo" });
    await userEvent.click(go);
    await userEvent.click(panel().getByRole("button", { name: "Looking at your photo…" }));
    release(
      Response.json({
        kind: "decor",
        mood: "Warm",
        palette: [],
        ideas: [{ area: "decor", title: "Torans", detail: "" }],
        notes: [],
      }),
    );
    await announced("Ideas from your photo are ready.");
    expect(fetch.bodies["/api/vision"]).toHaveLength(1);
    const save = panel().getByRole("button", { name: /^Save idea Torans/ });
    await userEvent.click(save);
    await userEvent.click(save);
    expect(saved.current.ideas.filter((i) => i.title === "Torans")).toHaveLength(1);
  });
});
