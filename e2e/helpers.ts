import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export const ENRICHMENT = {
  theme: { name: "Marigold courtyard", summary: "Warm Rajasthani colours with live folk music." },
  ideas: [
    { area: "decor", title: "Marigold canopy", detail: "Strings over the mandap.", cost: "medium" },
    { area: "food", title: "Live jalebi counter", detail: "Near the entrance.", cost: "low" },
  ],
  menu: [{ course: "Mains", dishes: ["Dal baati churma", "Gatte ki sabzi"] }],
  shifts: [{ category: "decor", factor: 1.2, reason: "Outdoor decor needs more flowers." }],
  tasks: [{ title: "Book a tent backup for rain", area: "venue", weeksBefore: 8 }],
  questions: [{ category: "catering", items: ["Is the dal baati made on site?"] }],
  risks: [{ risk: "February evenings get cold.", mitigation: "Keep patio heaters on standby." }],
};

/** Answers the AI routes in the browser, as the real server would with a key. */
export async function mockAi(page: Page): Promise<void> {
  await page.route("**/api/plan", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/plain; charset=utf-8",
      body: JSON.stringify(ENRICHMENT),
    }),
  );
  await page.route("**/api/refine", (route) =>
    route.fulfill({
      status: 200,
      json: {
        reply: "Brought it down and added a dhol.",
        changes: [{ op: "set_budget", amount: 1500000 }],
      },
    }),
  );
}

export async function startSamplePlan(page: Page, sample = /Wedding in Jaipur/): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: sample }).click();
  await page.getByRole("button", { name: "Make my plan" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

/** WCAG 2.2 AA checks, colour contrast included, on what is on screen now. */
export async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const found = results.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
  );
  expect(found).toEqual([]);
}
