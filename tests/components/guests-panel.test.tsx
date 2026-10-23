// @vitest-environment jsdom
import { factsOf } from "@/lib/plan/schema";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { withEnrichment } from "@/lib/plan/record";
import type { Brief, PlanRecord } from "@/lib/plan/schema";
import { NOW, birthdayBrief, recordFor, sampleEnrichment, weddingBrief } from "../fixtures";
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
