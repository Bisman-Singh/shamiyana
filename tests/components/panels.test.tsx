// @vitest-environment jsdom
import { factsOf } from "@/lib/plan/schema";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { nudge } from "@/components/planner/budget-panel";
import { tasksFor } from "@/lib/plan/catalog";
import { withEnrichment } from "@/lib/plan/record";
import type { Brief, PlanRecord } from "@/lib/plan/schema";
import {
  NOW,
  birthdayBrief,
  birthdayFacts,
  communityBrief,
  recordFor,
  sampleEnrichment,
  weddingBrief,
} from "../fixtures";
import { stubObjectUrls } from "../helpers/browser";
import { jsonError, mockFetch } from "../helpers/fetch";
import { expectAccessible } from "../helpers/render";
import { openTab, panel, renderWorkspace } from "../helpers/workspace";

/** A plan with AI ideas already in it, built the way the app builds it. */
function ready(brief: Brief = weddingBrief, patch: Partial<PlanRecord> = {}): PlanRecord {
  const base = withEnrichment(
    recordFor(brief),
    sampleEnrichment,
    { facts: factsOf(brief), locale: "en" },
    NOW,
  );
  return { ...base, ...patch };
}

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

describe("overview", () => {
  it("shows the key figures, next tasks, theme and risks", async () => {
    const { container } = renderWorkspace(ready());
    const p = panel();
    expect(p.getByText("Left to commit")).toBeInTheDocument();
    expect(p.getByText("Next up")).toBeInTheDocument();
    expect(p.getByText("Marigold courtyard")).toBeInTheDocument();
    expect(p.getByRole("heading", { level: 3, name: "Marigold courtyard" })).toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toHaveAttribute("tabindex", "0");
    expect(p.getByText("February evenings get cold.")).toBeInTheDocument();
    expect(screen.getByText("116 days to go")).toBeInTheDocument();
    await expectAccessible(container);
  });

  it("marks English AI text and an English title in the Hindi interface", async () => {
    const { container } = renderWorkspace(ready(), vi.fn(), "hi");
    expect(screen.getByRole("heading", { level: 1 })).toHaveAttribute("lang", "en");
    expect(
      await panel().findByRole("heading", { level: 3, name: "Marigold courtyard" }),
    ).toHaveAttribute("lang", "en");
    expect(panel().getByText("February evenings get cold.").closest("li")).toHaveAttribute(
      "lang",
      "en",
    );
    await expectAccessible(container);
  });

  it("marks a Hindi title in the English interface and nothing that matches the page", () => {
    renderWorkspace(recordFor({ ...weddingBrief, title: "रोहन की शादी" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveAttribute("lang", "hi");
    expect(document.querySelectorAll('[lang="en"]')).toHaveLength(0);
  });

  it("names the browser tab after the open plan and gives the old title back on close", () => {
    document.title = "Shamiyana";
    const record = ready();
    const { unmount } = renderWorkspace(record);
    expect(document.title).toBe(`${record.brief.title} · Shamiyana`);
    unmount();
    expect(document.title).toBe("Shamiyana");
  });

  it("says when everything is done, today, or past", () => {
    const { unmount } = renderWorkspace(recordFor({ ...birthdayBrief, date: "2026-10-21" }));
    expect(screen.getByText("It's today")).toBeInTheDocument();
    unmount();
    renderWorkspace(recordFor({ ...birthdayBrief, date: "2026-10-01" }));
    expect(screen.getByText("This date has passed")).toBeInTheDocument();
  });

  it("congratulates when no task is left", () => {
    const base = recordFor(birthdayBrief);
    renderWorkspace({
      ...base,
      done: tasksFor(birthdayBrief).map((t) => t.id),
      enrichedFor: { facts: birthdayFacts, locale: "en" },
    });
    expect(panel().getByText("Every task is done. Enjoy the day.")).toBeInTheDocument();
  });
});

/** Focus and the live region once their frame-delayed updates land. */
async function settles(focused: () => HTMLElement, said: string | RegExp) {
  await waitFor(() => {
    expect(focused()).toHaveFocus();
    expect(screen.getByTestId("announcer")).toHaveTextContent(said);
  });
}

describe("budget", () => {
  it("nudges a category, resets it and applies an AI suggestion", async () => {
    const { saved, container } = renderWorkspace(ready());
    await openTab("Budget");
    await expectAccessible(container);
    const decor = within(panel().getByRole("group", { name: "Adjust Decor and flowers" }));
    await userEvent.click(decor.getByRole("button", { name: "More" }));
    expect(saved.current.factors).toEqual({ decor: 1.1 });
    const more = () => decor.getByRole("button", { name: "More" });
    await settles(more, /^Decor and flowers is now planned at ₹/);
    const raised = screen.getByTestId("announcer").textContent;
    await userEvent.click(decor.getByRole("button", { name: /Reset/ }));
    expect(saved.current.factors).toEqual({});
    await settles(more, /^Decor and flowers is now planned at ₹/);
    expect(screen.getByTestId("announcer").textContent).not.toBe(raised);
    await userEvent.click(panel().getByRole("button", { name: /^Apply/ }));
    expect(saved.current.factors).toEqual({ decor: 1.2 });
    expect(panel().getByRole("button", { name: /^Applied/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await userEvent.click(panel().getByRole("button", { name: "Budget (CSV)" }));
    expect(downloads[0]?.name).toBe("winter-wedding-in-jaipur.budget.csv");
  });

  it("keeps weights inside 0.5 and 1.5", () => {
    expect(nudge(1.5, 1)).toBe(1.5);
    expect(nudge(0.5, -1)).toBe(0.5);
    expect(nudge(1, -1)).toBeCloseTo(0.9, 10);
  });

  it("disables the limits and flags bookings over plan and over budget", async () => {
    renderWorkspace(
      ready(birthdayBrief, {
        factors: { venue: 1.5, cake: 0.5 },
        vendors: { venue: { status: "booked", quote: 2_00_000, paid: 0, note: "" } },
      }),
    );
    await openTab("Budget");
    const p = panel();
    expect(
      within(p.getByRole("group", { name: "Adjust Venue" })).getByRole("button", { name: "More" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      within(p.getByRole("group", { name: "Adjust Cake and desserts" })).getByRole("button", {
        name: "Less",
      }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(p.getByText(/Bookings are ₹50,000 over your total budget/)).toBeInTheDocument();
    expect(p.getByText(/over plan/)).toBeInTheDocument();
  });
});

describe("timeline", () => {
  it("ticks off, removes with undo, restores and exports a calendar", async () => {
    const { saved, container } = renderWorkspace(ready());
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
    const { saved } = renderWorkspace(ready(communityBrief));
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
    renderWorkspace(ready(communityBrief, { tasks }));
    await openTab("Timeline");
    expect(panel().getByText("You've added the most tasks a plan can hold.")).toBeInTheDocument();
  });
});

describe("vendors", () => {
  it("tracks status, price, payments and notes per vendor", async () => {
    const { saved, container } = renderWorkspace(ready());
    await openTab("Vendors");
    const p = panel();
    await userEvent.click(p.getByText("Food and catering"));
    await expectAccessible(container);
    expect(
      p.getByRole("heading", { level: 3, name: "Ask them, Food and catering" }),
    ).toBeInTheDocument();
    await userEvent.selectOptions(p.getByLabelText("Status for Food and catering"), "booked");
    await userEvent.click(
      p.getByLabelText("Agreed price (₹)", { selector: "#vendor-catering-quote" }),
    );
    await userEvent.paste("4,80,000");
    await userEvent.click(
      p.getByLabelText("Paid so far (₹)", { selector: "#vendor-catering-paid" }),
    );
    await userEvent.paste("50000");
    await userEvent.click(p.getByLabelText("Notes", { selector: "#vendor-catering-note" }));
    await userEvent.paste("Tasting on Sunday");
    expect(saved.current.vendors.catering).toEqual({
      status: "booked",
      quote: 4_80_000,
      paid: 50_000,
      note: "Tasting on Sunday",
    });
    expect(p.getByText("Is the dal baati made on site?")).toBeInTheDocument();
    expect(
      p.getAllByRole("link", { name: /Search Maps for wedding caterers in Jaipur/ })[0],
    ).toHaveAttribute("href", expect.stringContaining("google.com/maps/search"));
    await userEvent.clear(
      p.getByLabelText("Agreed price (₹)", { selector: "#vendor-catering-quote" }),
    );
    expect(saved.current.vendors.catering?.quote).toBe(0);
    await userEvent.click(p.getByRole("button", { name: "Vendor checklist (CSV)" }));
    expect(downloads[0]?.name).toBe("winter-wedding-in-jaipur.checklist.csv");
  });
});

describe("guests", () => {
  it("adds households, tracks replies and offers the expected count", async () => {
    const { saved, container } = renderWorkspace(ready());
    await openTab("Guests");
    const p = panel();
    expect(p.getByText(/No guests yet/)).toBeInTheDocument();
    expect(p.getByRole("button", { name: "Guest list (CSV)" })).toBeDisabled();
    await userEvent.click(p.getByRole("button", { name: "Add" }));
    expect(p.getByText("Write a name in 1 to 80 characters.")).toBeInTheDocument();
    await userEvent.click(p.getByLabelText("Name or household"));
    await userEvent.paste("Mamaji's family");
    const party = p.getByLabelText("People");
    await userEvent.clear(party);
    await userEvent.click(party);
    await userEvent.paste("4");
    await userEvent.selectOptions(p.getByLabelText("Food"), "jain");
    await userEvent.selectOptions(p.getByLabelText("Group"), "friends");
    await userEvent.click(p.getByRole("button", { name: "Add" }));
    expect(saved.current.guests[0]).toMatchObject({
      name: "Mamaji's family",
      party: 4,
      rsvp: "pending",
      diet: "jain",
      group: "friends",
    });
    await expectAccessible(container);
    const reply = p.getByLabelText("Reply from Mamaji's family");
    fireEvent.change(reply, { target: { value: "bogus" } });
    expect(saved.current.guests[0]?.rsvp).toBe("pending");
    await userEvent.selectOptions(reply, "yes");
    expect(saved.current.guests[0]?.rsvp).toBe("yes");
    expect(p.getByText(/Jain 4/)).toBeInTheDocument();
    await userEvent.click(p.getByRole("button", { name: "Use 4 as the guest count" }));
    expect(saved.current.brief.guests).toBe(4);
    await settles(() => screen.getByRole("tabpanel"), "The plan now counts 4 guests.");
    await userEvent.selectOptions(p.getByLabelText("Show"), "no");
    expect(p.queryByText("Mamaji's family")).toBeNull();
    await userEvent.selectOptions(p.getByLabelText("Show"), "all");
    await userEvent.click(p.getByRole("button", { name: "Guest list (CSV)" }));
    expect(downloads[0]?.name).toBe("winter-wedding-in-jaipur.guests.csv");
    await userEvent.click(p.getByRole("button", { name: "Remove Mamaji's family" }));
    expect(saved.current.guests).toEqual([]);
  });

  it("counts a party size that isn't a number as one and stops at the list limit", async () => {
    const { saved } = renderWorkspace(ready());
    await openTab("Guests");
    const p = panel();
    await userEvent.click(p.getByLabelText("Name or household"));
    await userEvent.paste("Nanaji");
    await userEvent.clear(p.getByLabelText("People"));
    await userEvent.click(p.getByRole("button", { name: "Add" }));
    expect(saved.current.guests[0]?.party).toBe(1);
  });

  it("hides the add form when the list is full", async () => {
    const guests = Array.from({ length: 2000 }, (_, i) => ({
      id: `g${i}`,
      name: `Guest ${i}`,
      group: "family" as const,
      party: 1,
      rsvp: "pending" as const,
      diet: "veg" as const,
    }));
    renderWorkspace(ready(birthdayBrief, { guests }));
    await openTab("Guests");
    expect(panel().getByText("The guest list is full.")).toBeInTheDocument();
    expect(panel().getAllByRole("row")).toHaveLength(101);
    await userEvent.click(panel().getByRole("button", { name: "Show 100 more" }));
    expect(panel().getAllByRole("row")).toHaveLength(201);
  });
});

describe("ideas", () => {
  it("saves and removes ideas", async () => {
    const { saved, container } = renderWorkspace(ready());
    await openTab("Ideas");
    await expectAccessible(container);
    const p = panel();
    expect(p.getByRole("heading", { level: 4, name: "Marigold courtyard" })).toBeInTheDocument();
    await userEvent.click(p.getAllByRole("button", { name: /^Save idea/ })[0] ?? document.body);
    expect(saved.current.ideas[0]).toMatchObject({ title: "Marigold canopy", area: "decor" });
    expect(p.getAllByRole("button", { name: /^Saved/ }).length).toBeGreaterThan(0);
    expect(p.getByText("Dal baati churma, Gatte ki sabzi")).toBeInTheDocument();
    await userEvent.click(p.getByRole("button", { name: /^Remove/ }));
    expect(saved.current.ideas).toEqual([]);
  });

  it("has an empty saved list and no AI sections without ideas", async () => {
    renderWorkspace(
      recordFor(birthdayBrief, { enrichedFor: { facts: birthdayFacts, locale: "en" } }),
    );
    await openTab("Ideas");
    expect(panel().getByText(/Ideas you save from the AI/)).toBeInTheDocument();
    expect(panel().queryByText("Menu")).toBeNull();
  });
});

describe("header actions", () => {
  it("edits, downloads a backup and prints", async () => {
    const print = vi.fn();
    vi.stubGlobal("print", print);
    const { onEdit } = renderWorkspace(ready());
    await userEvent.click(screen.getByRole("button", { name: "Edit details" }));
    expect(onEdit).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Full backup (JSON)" }));
    expect(downloads[0]?.name).toBe("winter-wedding-in-jaipur.json");
    await userEvent.click(screen.getByRole("button", { name: "Print" }));
    expect(print).toHaveBeenCalled();
  });
});
