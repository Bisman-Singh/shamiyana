import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { mockAi, mockVision, startSamplePlan } from "./helpers";

test(
  "a plan is built at once, filled in by AI and kept after a reload",
  { tag: "@webkit" },
  async ({ page }) => {
    await mockAi(page);
    await startSamplePlan(page);
    await expect(page.getByText(/days to go/)).toBeVisible();
    await expect(page.getByRole("tabpanel").getByText("Marigold courtyard")).toBeVisible();

    await page.getByRole("tab", { name: "Budget" }).click();
    const total = page.getByRole("tabpanel").locator("tfoot td").first();
    await expect(total).toHaveText("₹18,00,000");
    await page.getByRole("tabpanel").getByRole("button", { name: "Apply" }).click();
    await expect(
      page.getByRole("tabpanel").getByRole("button", { name: "Applied" }),
    ).toBeDisabled();

    await page.getByRole("tab", { name: "Timeline" }).click();
    await expect(
      page.getByRole("tabpanel").getByText("Book a tent backup for rain", { exact: true }),
    ).toBeVisible();
    await page.getByRole("checkbox", { name: "Done: Visit and book the main venue" }).check();

    await page.reload();
    await page.getByRole("tab", { name: "Timeline" }).click();
    await expect(
      page.getByRole("checkbox", { name: "Done: Visit and book the main venue" }),
    ).toBeChecked();
  },
);

test("guests, vendors and the refine chat update the plan", async ({ page }) => {
  await mockAi(page);
  await startSamplePlan(page);

  await page.getByRole("tab", { name: "Guests" }).click();
  const guests = page.getByRole("tabpanel");
  await guests.getByLabel("Name or household").fill("Mausi's family");
  await guests.getByLabel("People").fill("5");
  await guests.getByRole("button", { name: "Add" }).click();
  await guests.getByLabel("Reply from Mausi's family").selectOption("yes");
  await expect(guests.getByRole("button", { name: "Use 5 as the guest count" })).toBeVisible();

  await page.getByRole("tab", { name: "Vendors" }).click();
  const vendors = page.getByRole("tabpanel");
  await vendors.locator("summary", { hasText: "Food and catering" }).click();
  await vendors.getByLabel("Status for Food and catering").selectOption("booked");
  await vendors.locator("#vendor-catering-quote").fill("600000");
  await page.getByRole("tab", { name: "Budget" }).click();
  await expect(page.getByRole("tabpanel").getByText(/over plan/)).toBeVisible();

  await page.getByRole("tab", { name: "Ideas" }).click();
  const ideas = page.getByRole("tabpanel");
  await ideas.getByLabel("Your message").fill("Bring it down to 15 lakh");
  await ideas.getByRole("button", { name: "Send" }).click();
  await expect(ideas.getByText("Brought it down and added a dhol.")).toBeVisible();
  await ideas.getByRole("checkbox", { name: "Set the budget to ₹15,00,000" }).check();
  await ideas.getByRole("button", { name: "Apply selected" }).click();
  await expect(page.getByText("₹15,00,000").first()).toBeVisible();
});

test("the calendar download is a valid iCalendar file", async ({ page }) => {
  await mockAi(page);
  await startSamplePlan(page);
  await page.getByRole("tab", { name: "Timeline" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Calendar (.ics)" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("winter-wedding-in-jaipur.ics");
  const text = await readFile(await download.path(), "utf8");
  expect(text.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
  expect(text).toContain("SUMMARY:Winter wedding in Jaipur");
});

test(
  "a share link opens a copy in another browser without the guest list",
  { tag: "@webkit" },
  async ({ page, browser }) => {
    await mockAi(page);
    await startSamplePlan(page, /Diwali mela/);
    await page.getByRole("tab", { name: "Guests" }).click();
    await page.getByLabel("Name or household").fill("Bua ji");
    await page.getByRole("tabpanel").getByRole("button", { name: "Add" }).click();
    await page.getByRole("button", { name: "Share" }).click();
    const link = await page.getByLabel("Share link").inputValue();
    expect(link).toMatch(/\/#plan=[A-Za-z0-9_-]+$/);

    const other = await browser.newContext();
    const friend = await other.newPage();
    await friend.route("**/api/plan", (route) =>
      route.fulfill({ status: 503, json: { error: "ai_unavailable" } }),
    );
    await friend.goto(link);
    await friend.getByRole("button", { name: "Add to my plans" }).click();
    await expect(friend.getByRole("heading", { level: 1 })).toHaveText("Block C Diwali mela");
    await friend.getByRole("tab", { name: "Guests" }).click();
    await expect(friend.getByText(/No guests yet/)).toBeVisible();
    await other.close();
  },
);

test("switching to Hindi translates the page from the server", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "पेज हिंदी में देखें" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("उत्सव की योजना बनाएँ");
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await page.getByRole("button", { name: "View this page in English" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Plan a celebration");
});

test("without an AI key the server says so and the plan still works", async ({ page }) => {
  await startSamplePlan(page, /80th birthday/);
  await expect(page.getByText(/AI ideas are switched off on this server/)).toBeVisible();
  await page.getByRole("tab", { name: "Timeline" }).click();
  await expect(page.getByRole("tabpanel").getByRole("checkbox").first()).toBeVisible();
});

test("nothing scrolls sideways on a phone", { tag: ["@phone", "@webkit"] }, async ({ page }) => {
  await mockAi(page);
  await startSamplePlan(page);
  for (const tab of ["Overview", "Budget", "Timeline", "Vendors", "Guests", "Ideas"]) {
    await page.getByRole("tab", { name: tab }).click();
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  }
});

test(
  "a photo is shrunk in the browser, sent once and turned into ideas to save",
  { tag: "@webkit" },
  async ({ page }) => {
    await mockAi(page);
    const sent = await mockVision(page);
    await startSamplePlan(page);
    await page.getByRole("tab", { name: "Ideas" }).click();
    const panel = page.getByRole("tabpanel");
    await panel.getByLabel("Choose a photo").setInputFiles("e2e/fixtures/venue.jpg");
    await expect(panel.getByRole("img", { name: "The photo you chose" })).toBeVisible();
    await panel.getByRole("button", { name: "Get ideas from this photo" }).click();
    await expect(panel.locator(".idea-title").filter({ hasText: "Lantern path" })).toBeVisible();
    await expect(panel.getByRole("img", { name: "Venue: Open lawn at dusk" })).toBeVisible();
    await panel.getByRole("button", { name: /^Save idea Lantern path/ }).click();
    await expect(panel.getByRole("button", { name: /^Saved Lantern path/ })).toBeVisible();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.type).toContain("multipart/form-data");
    expect(sent[0]?.bytes).toBeGreaterThan(0);
    expect(sent[0]?.bytes).toBeLessThan(4 * 1024 * 1024);
  },
);
