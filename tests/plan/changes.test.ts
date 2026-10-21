import { MAX_CHANGES, parseChanges } from "@/lib/plan/changes";
import type { CategoryId } from "@/lib/plan/constants";
import { TODAY } from "../fixtures";

const CATS: CategoryId[] = ["venue", "catering", "decor", "contingency"];
const parse = (raw: unknown) => parseChanges(raw, CATS, TODAY);

describe("parseChanges", () => {
  it("accepts each kind of well-formed change", () => {
    expect(
      parse([
        { op: "set_budget", amount: 2_00_000.4 },
        { op: "set_guests", count: 120 },
        { op: "set_date", date: "2026-12-01" },
        { op: "shift_category", category: "decor", factor: 1.234 },
        { op: "add_task", title: " Book  a generator ", area: "venue", weeksBefore: 2 },
        { op: "add_idea", area: "food", title: "Chaat counter", detail: "By the gate" },
      ]),
    ).toEqual([
      { op: "set_budget", amount: 2_00_000 },
      { op: "set_guests", count: 120 },
      { op: "set_date", date: "2026-12-01" },
      { op: "shift_category", category: "decor", factor: 1.23 },
      { op: "add_task", title: "Book a generator", area: "venue", weeksBefore: 2 },
      { op: "add_idea", area: "food", title: "Chaat counter", detail: "By the gate" },
    ]);
  });

  it("returns nothing for input that is not a list", () => {
    expect(parse({ op: "set_budget", amount: 1 })).toEqual([]);
    expect(parse(null)).toEqual([]);
  });

  it.each([
    ["a non-object entry", "set_budget"],
    ["an unknown op", { op: "delete_everything" }],
    ["a budget below the minimum", { op: "set_budget", amount: 10 }],
    ["a budget that is not a number", { op: "set_budget", amount: "lots" }],
    ["an infinite budget", { op: "set_budget", amount: Number.POSITIVE_INFINITY }],
    ["too many guests", { op: "set_guests", count: 1_00_000 }],
    ["a past date", { op: "set_date", date: "2026-10-20" }],
    ["a date too far ahead", { op: "set_date", date: "2031-01-01" }],
    ["a malformed date", { op: "set_date", date: "next Friday" }],
    ["a date that is not text", { op: "set_date", date: 20261201 }],
    ["a shift on contingency", { op: "shift_category", category: "contingency", factor: 1.2 }],
    [
      "a shift on a category the plan lacks",
      { op: "shift_category", category: "stay", factor: 1.2 },
    ],
    ["a shift on an unknown category", { op: "shift_category", category: "yachts", factor: 1.2 }],
    ["a shift without a number", { op: "shift_category", category: "decor", factor: "more" }],
    ["a shift with NaN", { op: "shift_category", category: "decor", factor: Number.NaN }],
    ["a task with no title", { op: "add_task", title: "  ", weeksBefore: 1 }],
    ["a task too far ahead", { op: "add_task", title: "x", weeksBefore: 99 }],
    ["an idea with no title", { op: "add_idea", title: "" }],
  ])("drops %s", (_label, entry) => {
    expect(parse([entry])).toEqual([]);
  });

  it("clamps a shift into 0.5–1.5 and defaults unknown areas", () => {
    expect(
      parse([
        { op: "shift_category", category: "venue", factor: 9 },
        { op: "shift_category", category: "catering", factor: 0.1 },
        { op: "add_task", title: "Call the tent house", area: "spaceships", weeksBefore: 1 },
        { op: "add_idea", area: "fireworks", title: "Diya walk" },
      ]),
    ).toEqual([
      { op: "shift_category", category: "venue", factor: 1.5 },
      { op: "shift_category", category: "catering", factor: 0.5 },
      { op: "add_task", title: "Call the tent house", area: "planning", weeksBefore: 1 },
      { op: "add_idea", area: "theme", title: "Diya walk", detail: "" },
    ]);
  });

  it("keeps the first of each single-valued change but every added item", () => {
    const changes = parse([
      { op: "set_budget", amount: 1_00_000 },
      { op: "set_budget", amount: 2_00_000 },
      { op: "shift_category", category: "decor", factor: 1.2 },
      { op: "shift_category", category: "decor", factor: 0.8 },
      { op: "add_idea", title: "One" },
      { op: "add_idea", title: "Two" },
    ]);
    expect(changes.map((c) => c.op)).toEqual([
      "set_budget",
      "shift_category",
      "add_idea",
      "add_idea",
    ]);
  });

  it(`stops at ${MAX_CHANGES} changes`, () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ op: "add_idea", title: `Idea ${i}` }));
    expect(parse(many)).toHaveLength(MAX_CHANGES);
  });
});
