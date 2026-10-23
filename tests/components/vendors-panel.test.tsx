// @vitest-environment jsdom
import { factsOf } from "@/lib/plan/schema";
import userEvent from "@testing-library/user-event";
import { withEnrichment } from "@/lib/plan/record";
import type { Brief, PlanRecord } from "@/lib/plan/schema";
import { NOW, recordFor, sampleEnrichment, weddingBrief } from "../helpers/fixtures";
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
