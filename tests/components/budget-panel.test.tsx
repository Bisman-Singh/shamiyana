// @vitest-environment jsdom
import { factsOf } from "@/lib/plan/schema";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { nudge } from "@/components/planner/budget-panel";
import { withEnrichment } from "@/lib/plan/record";
import type { Brief, PlanRecord } from "@/lib/plan/schema";
import { NOW, birthdayBrief, recordFor, sampleEnrichment, weddingBrief } from "../helpers/fixtures";
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
    expect(
      panel().getByText(
        /^Planned amounts are a starting split of your budget, not vendor quotes\./,
      ),
    ).toBeVisible();
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
