import type { Factors } from "@/lib/plan/schema";
import type { CategoryId, VendorStatus } from "./constants";
import { clampFactor } from "./factors";
import type { EventFacts, PlanRecord } from "./schema";
import { BASE_SHARES, variantFactors } from "./shares";
import { isSecured } from "./vendor-status";

export interface BudgetLine {
  category: CategoryId;
  /** Fraction of the total, 0 to 1. */
  share: number;
  amount: number;
}

/**
 * Splits `total` rupees by weight so the parts add up to the total exactly.
 *
 * Amounts are whole multiples of `unit`, ₹100 by default, so a line reads
 * ₹3,60,000 rather than ₹3,60,013. Units are shared out by largest
 * remainder; the few rupees below one unit go to contingency, or to the
 * largest line when the plan has none.
 */
export function allocate(
  total: number,
  weights: readonly (readonly [CategoryId, number])[],
  unit = 100,
): BudgetLine[] {
  const positive = weights.filter(([, w]) => w > 0);
  const sum = positive.reduce((acc, [, w]) => acc + w, 0);
  if (total <= 0) return [];

  const step = total >= unit * positive.length ? unit : 1;
  const units = Math.floor(total / step);
  const parts = positive.map(([category, w], order) => {
    const raw = (units * w) / sum;
    return { category, share: w / sum, base: Math.floor(raw), frac: raw - Math.floor(raw), order };
  });
  const left = units - parts.reduce((acc, part) => acc + part.base, 0);
  const bonus = new Set(
    [...parts]
      .sort((one, other) => other.frac - one.frac || one.order - other.order)
      .slice(0, left)
      .map((part) => part.order),
  );
  const lines = parts.map((part) => ({
    category: part.category,
    share: part.share,
    amount: (part.base + (bonus.has(part.order) ? 1 : 0)) * step,
  }));
  const [first, ...others] = lines;
  if (!first) return [];
  const rest = total - units * step;
  const sink =
    lines.find((line) => line.category === "contingency") ??
    others.reduce((max, l) => (l.amount > max.amount ? l : max), first);
  sink.amount += rest;
  return lines;
}

/** The plan's categories with their weights after event details and user shifts. */
export function weightsFor(facts: EventFacts, factors: Factors): (readonly [CategoryId, number])[] {
  const variant = variantFactors(facts);
  const shares = BASE_SHARES[facts.type];
  // Contingency keeps its share however the other lines are tilted.
  const reserve = shares.contingency;
  const raw = Object.entries(shares).map(([key, base]) => {
    const category = key as CategoryId;
    const user = factors[category];
    const weight = base * (variant[category] ?? 1) * (user === undefined ? 1 : clampFactor(user));
    return [category, weight] as const;
  });
  const rest = raw.reduce((acc, [c, w]) => (c === "contingency" ? acc : acc + w), 0);
  return raw.map(([category, weight]) => [
    category,
    category === "contingency" ? reserve : (weight / rest) * (1 - reserve),
  ]);
}

/** The budget split for an event, weighted by its details and the user's shifts, in round hundreds. */
export function planBudget(facts: EventFacts, factors: Factors): BudgetLine[] {
  return allocate(facts.budget, weightsFor(facts, factors));
}

/** A line's rupees now and with its shift set to `factor`. */
export type ShiftPreview = (
  category: CategoryId,
  factor: number,
) => { before: number; after: number };

/**
 * Shows a shift in rupees. A shift scales a line's share and the rest make
 * room, so ×1.2 is not exactly 20% more money; the user should see the money.
 */
export function previewShifts(facts: EventFacts, factors: Factors): ShiftPreview {
  const amount = (f: Factors, category: CategoryId) =>
    planBudget(facts, f).find((line) => line.category === category)?.amount ?? 0;
  return (category, factor) => ({
    before: amount(factors, category),
    after: amount({ ...factors, [category]: factor }, category),
  });
}

export interface BudgetRow extends BudgetLine {
  status: VendorStatus;
  quote: number;
  paid: number;
  /** Quote minus plan; positive means over. Zero until there is a quote. */
  variance: number;
}

export interface BudgetSummary {
  rows: BudgetRow[];
  total: number;
  /** Agreed amounts for vendors marked booked or paid. */
  committed: number;
  paid: number;
  /** Total minus committed; negative once bookings exceed the budget. */
  remaining: number;
  /** Catering line divided by the brief's guest count. */
  perGuestCatering: number | null;
  overCategories: CategoryId[];
}

/** Budget lines with vendor status, quotes and payments, and the totals the panel shows. */
export function summariseBudget(
  lines: readonly BudgetLine[],
  facts: EventFacts,
  vendors: PlanRecord["vendors"],
): BudgetSummary {
  const rows = lines.map((line) => {
    const progress = vendors[line.category];
    const quote = progress?.quote ?? 0;
    return {
      ...line,
      status: progress?.status ?? "todo",
      quote,
      paid: progress?.paid ?? 0,
      variance: quote > 0 ? quote - line.amount : 0,
    };
  });
  const committed = rows
    .filter((row) => isSecured(row.status))
    .reduce((acc, row) => acc + row.quote, 0);
  const catering = lines.find((line) => line.category === "catering");
  return {
    rows,
    total: facts.budget,
    committed,
    paid: rows.reduce((acc, r) => acc + r.paid, 0),
    remaining: facts.budget - committed,
    perGuestCatering: catering ? Math.round(catering.amount / facts.guests) : null,
    overCategories: rows.filter((row) => row.variance > 0).map((row) => row.category),
  };
}
