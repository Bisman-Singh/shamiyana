// @vitest-environment jsdom
import { factsOf } from "@/lib/plan/schema";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { withEnrichment } from "@/lib/plan/record";
import type { Brief, PlanRecord } from "@/lib/plan/schema";
import { NOW, recordFor, sampleEnrichment, weddingBrief } from "../fixtures";
import { stubObjectUrls } from "../helpers/browser";
import { jsonError, mockFetch } from "../helpers/fetch";
import { renderWorkspace } from "../helpers/workspace";

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
