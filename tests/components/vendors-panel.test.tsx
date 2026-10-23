// @vitest-environment jsdom
import userEvent from "@testing-library/user-event";
import { readyPlan } from "../helpers/fixtures";
import { stubObjectUrls } from "../helpers/browser";
import { jsonError, mockFetch } from "../helpers/fetch";
import { expectAccessible } from "../helpers/render";
import { openTab, panel, renderWorkspace } from "../helpers/workspace";

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
    const { saved, container } = renderWorkspace(readyPlan());
    await openTab("Vendors");
    const p = panel();
    await userEvent.click(p.getByText("Food and catering"));
    await expectAccessible(container);
    expect(
      p.getByRole("heading", { level: 3, name: "Ask them, Food and catering" }),
    ).toBeInTheDocument();
    await userEvent.selectOptions(p.getByLabelText("Status for Food and catering"), "booked");
    await userEvent.click(p.getByLabelText("Agreed price (₹), Food and catering"));
    await userEvent.paste("4,80,000");
    await userEvent.click(p.getByLabelText("Paid so far (₹), Food and catering"));
    await userEvent.paste("50000");
    await userEvent.click(p.getByLabelText("Notes, Food and catering"));
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
    await userEvent.clear(p.getByLabelText("Agreed price (₹), Food and catering"));
    expect(saved.current.vendors.catering?.quote).toBe(0);
    await userEvent.click(p.getByRole("button", { name: "Vendor checklist (CSV)" }));
    expect(downloads[0]?.name).toBe("winter-wedding-in-jaipur.checklist.csv");
  });

  it("marks the English search phrase inside a Hindi sentence", async () => {
    renderWorkspace(readyPlan(), vi.fn(), "hi");
    await openTab("वेंडर");
    const link = panel().getAllByRole("link", { name: /^Maps पर Jaipur में .+ खोजें/ })[0];
    expect(link?.querySelector('[lang="en"]')?.textContent).toMatch(/^[a-z ]+$/);
  });

  it("keeps what is typed in an amount, saves only a real amount and says what to fix", async () => {
    const { saved } = renderWorkspace(readyPlan());
    await openTab("Vendors");
    const p = panel();
    await userEvent.click(p.getByText("Food and catering"));
    const quote = p.getByLabelText("Agreed price (₹), Food and catering");
    await userEvent.type(quote, "3 lakh");
    expect(quote).toHaveValue("3 lakh");
    expect(quote).toHaveAttribute("aria-invalid", "true");
    expect(quote).toHaveAccessibleDescription("Use digits only, up to ₹50 crore.");
    // "3" was an amount before the word began, and nothing after it was saved
    expect(saved.current.vendors.catering?.quote).toBe(3);
    await userEvent.clear(quote);
    await userEvent.type(quote, "9999999999");
    expect(quote).toHaveAttribute("aria-invalid", "true");
    // the last amount within ₹50 crore stays saved while the field shows the error
    expect(saved.current.vendors.catering?.quote).toBe(99_999_999);
    await userEvent.clear(quote);
    await userEvent.type(quote, "₹3,00,000");
    expect(quote).not.toHaveAttribute("aria-invalid");
    expect(saved.current.vendors.catering?.quote).toBe(3_00_000);
  });
});
