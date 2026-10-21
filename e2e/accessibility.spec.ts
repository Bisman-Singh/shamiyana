import { expect, test } from "@playwright/test";
import { expectNoAxeViolations, mockAi, startSamplePlan } from "./helpers";

const TABS = ["Overview", "Budget", "Timeline", "Vendors", "Guests", "Ideas"];

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test("the brief form passes WCAG 2.2 AA", async ({ page }) => {
      await page.goto("/");
      await expectNoAxeViolations(page);
      await page.getByRole("button", { name: "Make my plan" }).click();
      await expect(page.getByRole("alert").filter({ hasText: "Please fix" })).toBeVisible();
      await expectNoAxeViolations(page);
    });

    test("every plan tab passes WCAG 2.2 AA", async ({ page }) => {
      // Six full axe scans, colour contrast included.
      test.setTimeout(90_000);
      await mockAi(page);
      await startSamplePlan(page);
      await expect(page.getByRole("tabpanel").getByText("Marigold courtyard")).toBeVisible();
      for (const tab of TABS) {
        await page.getByRole("tab", { name: tab }).click();
        await expectNoAxeViolations(page);
      }
    });

    test("policy and error pages pass WCAG 2.2 AA", async ({ page }) => {
      for (const path of ["/privacy", "/terms", "/no-such-page"]) {
        await page.goto(path);
        await expectNoAxeViolations(page);
      }
    });
  });
}

test("Hindi pages pass WCAG 2.2 AA and declare their language", async ({ page, context }) => {
  await context.addCookies([{ name: "lang", value: "hi", url: "http://localhost:3200" }]);
  await mockAi(page);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: /जयपुर में शादी/ }).click();
  await page.getByRole("button", { name: "मेरी योजना बनाएँ" }).click();
  await page.getByRole("tab", { name: "बजट" }).click();
  await expectNoAxeViolations(page);
});

test("the whole flow works from the keyboard alone", async ({ page }) => {
  await mockAi(page);
  await page.goto("/");
  const tabTo = async (name: string | RegExp, role: "button" | "tab" = "button") => {
    const target = page.getByRole(role, { name });
    for (
      let i = 0;
      i < 80 && !(await target.evaluate((el) => el === document.activeElement));
      i += 1
    ) {
      await page.keyboard.press("Tab");
    }
    await expect(target).toBeFocused();
  };
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await tabTo(/80th birthday/);
  await page.keyboard.press("Enter");
  await tabTo("Make my plan");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Dadi turns 80" })).toBeFocused();
  await tabTo("Overview", "tab");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Budget" })).toBeFocused();
  await expect(page.getByRole("tab", { name: "Budget" })).toHaveAttribute("aria-selected", "true");
  await tabTo("Edit details");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Edit event details" })).toBeFocused();
});

test("motion stops for people who ask for less", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/plan", () => undefined);
  await startSamplePlan(page);
  const pulse = page.locator(".pulse");
  await expect(pulse).toBeVisible();
  expect(await pulse.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
});
