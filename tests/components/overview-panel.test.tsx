// @vitest-environment jsdom
import { factsOf } from "@/lib/plan/schema";
import { screen } from "@testing-library/react";
import { tasksFor } from "@/lib/plan/catalog";
import { withEnrichment } from "@/lib/plan/record";
import type { Brief, PlanRecord } from "@/lib/plan/schema";
import {
  NOW,
  birthdayBrief,
  birthdayFacts,
  recordFor,
  sampleEnrichment,
  weddingBrief,
} from "../helpers/fixtures";
import { stubObjectUrls } from "../helpers/browser";
import { jsonError, mockFetch } from "../helpers/fetch";
import { expectAccessible } from "../helpers/render";
import { panel, renderWorkspace } from "../helpers/workspace";

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

beforeEach(() => {
  stubObjectUrls("blob:x");
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
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
