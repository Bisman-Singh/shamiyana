// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { withEnrichment } from "@/lib/plan/record";
import { factsOf, type Brief } from "@/lib/plan/schema";
import {
  NOW,
  communityBrief,
  recordFor,
  sampleEnrichment,
  weddingBrief,
} from "../helpers/fixtures";
import { jsonError, mockFetch, streamed } from "../helpers/fetch";
import { openTab, panel, renderWorkspace } from "../helpers/workspace";

/** The announcer's text once its frame-delayed update has landed. */
async function announced(text: string | RegExp) {
  await waitFor(() => {
    expect(screen.getByTestId("announcer")).toHaveTextContent(text);
  });
}

const ready = (brief: Brief = weddingBrief) =>
  withEnrichment(recordFor(brief), sampleEnrichment, { facts: factsOf(brief), locale: "en" }, NOW);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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

  it("moves focus from Undo to the open panel when AI ideas land and end the offer", async () => {
    let release: () => void = () => undefined;
    mockFetch({
      "/api/plan": () =>
        new Promise<Response>((resolve) => {
          release = () => {
            resolve(streamed([JSON.stringify(sampleEnrichment)]));
          };
        }),
    });
    renderWorkspace(recordFor(communityBrief));
    await openTab("Timeline");
    await userEvent.click(
      panel().getByRole("button", { name: "Remove Fix the budget and the sponsorship target" }),
    );
    expect(screen.getByRole("button", { name: "Undo" })).toHaveFocus();
    release();
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
      expect(screen.getByRole("tabpanel")).toHaveFocus();
    });
  });

  it("sends focus to the wrong field, then announces and refocuses after an add", async () => {
    renderWorkspace(ready(communityBrief));
    await openTab("Timeline");
    await userEvent.click(panel().getByRole("button", { name: "Add task" }));
    await waitFor(() => {
      expect(panel().getByLabelText("Task")).toHaveFocus();
    });
    await userEvent.type(panel().getByLabelText("Task"), "Hire chairs");
    await userEvent.click(panel().getByRole("button", { name: "Add task" }));
    await waitFor(() => {
      expect(panel().getByLabelText("Do it by")).toHaveFocus();
    });
    fireEvent.change(panel().getByLabelText("Do it by"), { target: { value: "2026-11-01" } });
    await userEvent.click(panel().getByRole("button", { name: "Add task" }));
    await announced("Added “Hire chairs”.");
    await waitFor(() => {
      expect(panel().getByLabelText("Task")).toHaveFocus();
    });

    await openTab("Guests");
    await userEvent.click(panel().getByRole("button", { name: "Add" }));
    await waitFor(() => {
      expect(panel().getByLabelText("Name or household")).toHaveFocus();
    });
    await userEvent.type(panel().getByLabelText("Name or household"), "Nani");
    await userEvent.click(panel().getByRole("button", { name: "Add" }));
    await announced("Added Nani.");
    await waitFor(() => {
      expect(panel().getByLabelText("Name or household")).toHaveFocus();
    });
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
