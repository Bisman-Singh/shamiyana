// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { stubObjectUrls } from "@/tests/helpers/browser";
import { jsonError, mockFetch } from "@/tests/helpers/fetch";
import { communityBrief, readyPlan } from "@/tests/helpers/fixtures";
import { expectAccessible } from "@/tests/helpers/render";
import { openTab, panel, renderWorkspace } from "@/tests/helpers/workspace";

const downloads: { name: string; text: string }[] = [];

beforeEach(() => {
  downloads.length = 0;
  stubObjectUrls("blob:x");
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push({ name: this.download, text: this.href });
  });
  mockFetch({ "/api/plan": () => jsonError("ai_unavailable", 503) });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Focus and the live region once their frame-delayed updates land. */
async function settles(focused: () => HTMLElement, said: string | RegExp) {
  await waitFor(() => {
    expect(focused()).toHaveFocus();
    expect(screen.getByTestId("announcer")).toHaveTextContent(said);
  });
}

describe("timeline", () => {
  it("ticks off, removes with undo, restores and exports a calendar", async () => {
    const { saved, container } = renderWorkspace(readyPlan());
    await openTab("Timeline");
    await expectAccessible(container);
    const p = panel();
    expect(p.getByText(/tasks are overdue/)).toBeInTheDocument();
    await userEvent.click(p.getByRole("checkbox", { name: "Done: Visit and book the main venue" }));
    expect(saved.current.done).toContain("w_book_venue");
    await userEvent.click(p.getByRole("button", { name: "Remove Book the mehndi artist" }));
    expect(saved.current.hidden).toEqual(["w_book_mehndi"]);
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(saved.current.hidden).toEqual([]);
    await userEvent.click(p.getByRole("button", { name: "Remove Book the mehndi artist" }));
    await userEvent.click(p.getByRole("button", { name: "Show 1 removed task" }));
    expect(saved.current.hidden).toEqual([]);
    await settles(() => screen.getByRole("tabpanel"), "1 removed task is back on the list.");
    expect(p.getAllByRole("link", { name: /Add to Google Calendar/ })[0]).toHaveAttribute(
      "target",
      "_blank",
    );
    await userEvent.click(p.getByRole("button", { name: "Calendar (.ics)" }));
    expect(downloads[0]?.name).toBe("winter-wedding-in-jaipur.ics");
    expect(p.getByText("AI")).toBeInTheDocument();
  });

  it("adds a task with checks on its title and date", async () => {
    const { saved } = renderWorkspace(readyPlan(communityBrief));
    await openTab("Timeline");
    const p = panel();
    await userEvent.click(p.getByRole("button", { name: "Add task" }));
    expect(p.getByText("Write the task in 1 to 120 characters.")).toBeInTheDocument();
    expect(p.getByText("Pick a date between today and the event.")).toBeInTheDocument();
    await userEvent.click(p.getByLabelText("Task"));
    await userEvent.paste("Book a generator");
    await userEvent.type(p.getByLabelText("Do it by"), "2026-11-01");
    await userEvent.selectOptions(p.getByLabelText("Area"), "venue");
    await userEvent.click(p.getByRole("button", { name: "Add task" }));
    expect(saved.current.tasks.at(-1)).toMatchObject({
      title: "Book a generator",
      area: "venue",
      leadDays: 6,
      source: "custom",
    });
    expect(p.getByText("Yours")).toBeInTheDocument();
  });

  it("stops offering to add tasks at the limit", async () => {
    const tasks = Array.from({ length: 60 }, (_, i) => ({
      id: `t${i}`,
      title: `Task ${i}`,
      area: "planning" as const,
      leadDays: 1,
      source: "custom" as const,
    }));
    renderWorkspace(readyPlan(communityBrief, { tasks }));
    await openTab("Timeline");
    expect(panel().getByText("You've added the most tasks a plan can hold.")).toBeInTheDocument();
  });
});
