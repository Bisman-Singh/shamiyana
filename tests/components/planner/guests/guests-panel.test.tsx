// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
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

describe("guests", () => {
  it("adds households, tracks replies and offers the expected count", async () => {
    const { saved, container } = renderWorkspace(readyPlan());
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

  it("refuses a missing or too large party size with an error on that field, saving nothing", async () => {
    const { saved } = renderWorkspace(readyPlan());
    await openTab("Guests");
    const p = panel();
    await userEvent.click(p.getByLabelText("Name or household"));
    await userEvent.paste("Nanaji");
    for (const typed of ["", "50"]) {
      await userEvent.clear(p.getByLabelText("People"));
      if (typed) await userEvent.type(p.getByLabelText("People"), typed);
      await userEvent.click(p.getByRole("button", { name: "Add" }));
      const people = p.getByLabelText("People");
      await waitFor(() => {
        expect(people).toHaveFocus();
      });
      expect(people).toHaveAttribute("aria-invalid", "true");
      expect(people).toHaveAccessibleDescription("Enter a party size from 1 to 20.");
    }
    expect(saved.current.guests).toEqual([]);
    await userEvent.clear(p.getByLabelText("People"));
    await userEvent.type(p.getByLabelText("People"), "20");
    await userEvent.click(p.getByRole("button", { name: "Add" }));
    expect(saved.current.guests[0]?.party).toBe(20);
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
    renderWorkspace(readyPlan(birthdayBrief, { guests }));
    await openTab("Guests");
    expect(panel().getByText("The guest list is full.")).toBeInTheDocument();
    expect(panel().getAllByRole("row")).toHaveLength(101);
    await userEvent.click(panel().getByRole("button", { name: "Show 100 more" }));
    expect(panel().getAllByRole("row")).toHaveLength(201);
  });
});
