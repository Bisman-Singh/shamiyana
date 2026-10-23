import {
  allocate,
  planBudget,
  previewShifts,
  summariseBudget,
  weightsFor,
} from "@/lib/plan/budget";
import type { CategoryId } from "@/lib/plan/constants";
import { BASE_SHARES } from "@/lib/plan/shares";
import { birthdayBrief, communityBrief, seeded, weddingBrief } from "../helpers/fixtures";

const sum = (xs: readonly { amount: number }[]) => xs.reduce((a, x) => a + x.amount, 0);

describe("allocate", () => {
  const weights: [CategoryId, number][] = [
    ["venue", 0.2],
    ["catering", 0.5],
    ["decor", 0.25],
    ["contingency", 0.05],
  ];

  it("adds up to the total exactly for any amount", () => {
    const rand = seeded(7);
    for (let i = 0; i < 500; i += 1) {
      const total = 5_000 + Math.floor(rand() * 50_00_00_000);
      const lines = allocate(total, weights);
      expect(sum(lines)).toBe(total);
      for (const line of lines) expect(line.amount).toBeGreaterThanOrEqual(0);
    }
  });

  it("uses round hundreds and sends the odd rupees to contingency", () => {
    const lines = allocate(1_00_037, weights);
    const byCat = Object.fromEntries(lines.map((l) => [l.category, l.amount]));
    expect(byCat).toEqual({ venue: 20_000, catering: 50_000, decor: 25_000, contingency: 5_037 });
  });

  it("gives the odd rupees to the largest line when there is no contingency", () => {
    const lines = allocate(10_050, [
      ["venue", 1],
      ["catering", 3],
    ]);
    expect(lines.map((l) => l.amount)).toEqual([2_500, 7_550]);
  });

  it("shares leftover units by largest remainder, ties to the earlier line", () => {
    const lines = allocate(1_000, [
      ["venue", 1],
      ["catering", 1],
      ["decor", 1],
    ]);
    expect(lines.map((l) => l.amount)).toEqual([400, 300, 300]);
  });

  it("falls back to single rupees when the total is too small for hundreds", () => {
    const lines = allocate(250, weights);
    expect(sum(lines)).toBe(250);
    expect(lines.find((l) => l.category === "catering")?.amount).toBe(125);
  });

  it("ignores zero weights and returns nothing for nothing", () => {
    expect(allocate(1_000, [["venue", 0]])).toEqual([]);
    expect(allocate(0, weights)).toEqual([]);
    expect(allocate(1_000, [])).toEqual([]);
    expect(
      allocate(1_000, [
        ["venue", 1],
        ["decor", 0],
      ]).map((l) => l.category),
    ).toEqual(["venue"]);
  });

  it("reports each line's share of the whole", () => {
    const lines = allocate(10_000, weights);
    expect(lines.reduce((a, l) => a + l.share, 0)).toBeCloseTo(1, 10);
  });
});

describe("weightsFor", () => {
  it("applies event details and clamps user shifts to 0.5–1.5", () => {
    const weights = new Map(weightsFor(weddingBrief, { decor: 9, venue: 0.1 }));
    const get = (c: CategoryId) => weights.get(c) ?? 0;
    expect(get("decor") / get("venue")).toBeCloseTo((0.12 * 1.12 * 1.5) / (0.18 * 0.5));
    expect(get("beauty") / get("venue")).toBeCloseTo((0.03 * 1.5) / (0.18 * 0.5));
  });

  it("keeps contingency at its share however the other lines are tilted", () => {
    for (const brief of [weddingBrief, birthdayBrief, communityBrief]) {
      const weights = weightsFor(brief, { venue: 1.5, catering: 1.5 });
      const total = weights.reduce((acc, [, w]) => acc + w, 0);
      expect(total).toBeCloseTo(1);
      expect(new Map(weights).get("contingency")).toBe(BASE_SHARES[brief.type].contingency);
    }
    const contingency = planBudget(weddingBrief, {}).find((l) => l.category === "contingency");
    expect(contingency?.amount).toBeGreaterThanOrEqual(0.08 * weddingBrief.budget);
  });
});

describe("previewShifts", () => {
  it("gives a line's rupees now and with a shift, and nothing for a line the plan lacks", () => {
    const preview = previewShifts(weddingBrief, { decor: 1.2 });
    const decor = planBudget(weddingBrief, { decor: 1.2 }).find((l) => l.category === "decor");
    const { before, after } = preview("decor", 1.5);
    expect(before).toBe(decor?.amount);
    expect(after).toBeGreaterThan(before);
    expect(preview("decor", 1).after).toBeLessThan(before);
    expect(preview("cake", 1.2)).toEqual({ before: 0, after: 0 });
  });
});

describe("planBudget", () => {
  it.each([weddingBrief, birthdayBrief, communityBrief])(
    "sums to the brief's budget ($type)",
    (brief) => {
      expect(sum(planBudget(brief, {}))).toBe(brief.budget);
    },
  );

  it("moves money towards a shifted category", () => {
    const before = planBudget(birthdayBrief, {}).find((l) => l.category === "decor")?.amount ?? 0;
    const after =
      planBudget(birthdayBrief, { decor: 1.5 }).find((l) => l.category === "decor")?.amount ?? 0;
    expect(after).toBeGreaterThan(before);
  });
});

describe("summariseBudget", () => {
  const lines = planBudget(birthdayBrief, {});
  const planned = (c: CategoryId) => lines.find((l) => l.category === c)?.amount ?? 0;

  it("starts with nothing committed and the whole budget remaining", () => {
    const summary = summariseBudget(lines, birthdayBrief, {});
    expect(summary).toMatchObject({
      committed: 0,
      paid: 0,
      remaining: 1_50_000,
      overCategories: [],
    });
    expect(summary.perGuestCatering).toBe(Math.round(planned("catering") / 60));
    expect(summary.rows.every((r) => r.status === "todo" && r.variance === 0)).toBe(true);
  });

  it("counts booked and paid quotes as committed and flags quotes over plan", () => {
    const summary = summariseBudget(lines, birthdayBrief, {
      venue: { status: "booked", quote: planned("venue") + 5_000, paid: 10_000, note: "" },
      cake: { status: "paid", quote: 4_000, paid: 4_000, note: "" },
      decor: { status: "shortlisted", quote: 99_999, paid: 0, note: "" },
    });
    expect(summary.committed).toBe(planned("venue") + 5_000 + 4_000);
    expect(summary.paid).toBe(14_000);
    expect(summary.remaining).toBe(1_50_000 - summary.committed);
    expect(summary.overCategories).toEqual(["venue", "decor"]);
  });

  it("has no per-guest figure without a catering line", () => {
    const noFood = lines.filter((l) => l.category !== "catering");
    expect(summariseBudget(noFood, birthdayBrief, {}).perGuestCatering).toBeNull();
  });
});
