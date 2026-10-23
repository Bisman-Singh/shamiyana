// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { stubObjectUrls } from "@/tests/helpers/browser";
import { jsonError, mockFetch } from "@/tests/helpers/fetch";
import { birthdayBrief, readyPlan } from "@/tests/helpers/fixtures";
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

describe("budget", () => {
  it("nudges a category, resets it and applies an AI suggestion", async () => {
    const { saved, container } = renderWorkspace(readyPlan());
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

  it("disables the limits and flags bookings over plan and over budget", async () => {
    renderWorkspace(
      readyPlan(birthdayBrief, {
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
