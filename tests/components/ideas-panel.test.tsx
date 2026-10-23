// @vitest-environment jsdom
import userEvent from "@testing-library/user-event";
import { birthdayBrief, birthdayFacts, recordFor, readyPlan } from "../helpers/fixtures";
import { stubObjectUrls } from "../helpers/browser";
import { jsonError, mockFetch } from "../helpers/fetch";
import { expectAccessible } from "../helpers/render";
import { openTab, panel, renderWorkspace } from "../helpers/workspace";

beforeEach(() => {
  stubObjectUrls("blob:x");
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  mockFetch({ "/api/plan": () => jsonError("ai_unavailable", 503) });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ideas", () => {
  it("saves and removes ideas", async () => {
    const { saved, container } = renderWorkspace(readyPlan());
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
