import { buildTimeline, parseNewTask, phaseOf } from "@/lib/plan/timeline";
import {
  TODAY,
  birthdayBrief,
  communityBrief,
  recordFor,
  weddingBrief,
} from "@/tests/helpers/fixtures";

describe("phaseOf", () => {
  it.each([
    [400, "six_months"],
    [180, "six_months"],
    [179, "three_months"],
    [90, "three_months"],
    [30, "one_month"],
    [14, "two_weeks"],
    [13, "final_days"],
    [1, "final_days"],
    [0, "event_day"],
  ])("puts a %i-day lead in %s", (lead, phase) => {
    expect(phaseOf(lead)).toBe(phase);
  });
});

describe("buildTimeline", () => {
  it("back-schedules from the event date", () => {
    const timeline = buildTimeline(recordFor(weddingBrief), TODAY);
    const venue = timeline.items.find((i) => i.id === "w_book_venue");
    expect(venue).toMatchObject({
      due: "2026-06-19",
      late: true,
      done: false,
      source: "template",
      title: null,
    });
    expect(timeline.daysToGo).toBe(116);
  });

  it("includes tasks for the chosen functions only", () => {
    const ids = buildTimeline(recordFor(weddingBrief), TODAY).items.map((i) => i.id);
    expect(ids).toEqual(
      expect.arrayContaining(["w_book_mehndi", "w_choreo", "w_haldi_supplies", "w_block_rooms"]),
    );
    expect(ids).not.toContain("w_roka");
    expect(ids).not.toContain("w_book_reception");
  });

  it("adds variant tasks for birthdays and community events", () => {
    const birthday = buildTimeline(recordFor(birthdayBrief), TODAY).items.map((i) => i.id);
    expect(birthday).toContain("b_memory_book");
    expect(birthday).not.toContain("b_kid_safety");
    const mela = buildTimeline(recordFor(communityBrief), TODAY).items.map((i) => i.id);
    expect(mela).toContain("c_puja");
    expect(mela).not.toContain("c_prizes");
  });

  it("orders by lead time and keeps template order on ties", () => {
    const items = buildTimeline(recordFor(birthdayBrief), TODAY).items;
    const leads = items.map((i) => i.leadDays);
    expect(leads).toEqual([...leads].sort((a, b) => b - a));
    expect(items.slice(1, 3).map((i) => i.id)).toEqual(["b_book_venue", "b_memory_book"]);
  });

  it("marks done, hides removed and counts what is late", () => {
    const record = recordFor(communityBrief, {
      done: ["c_committee"],
      hidden: ["c_budget_sponsors"],
      tasks: [
        { id: "t1", title: "Hire a generator", area: "venue", leadDays: 3, source: "custom" },
      ],
    });
    const timeline = buildTimeline(record, TODAY);
    const ids = timeline.items.map((i) => i.id);
    expect(ids).not.toContain("c_budget_sponsors");
    expect(timeline.items.find((i) => i.id === "c_committee")).toMatchObject({
      done: true,
      late: false,
    });
    expect(timeline.items.find((i) => i.id === "t1")).toMatchObject({
      title: "Hire a generator",
      late: false,
    });
    expect(timeline.doneCount).toBe(1);
    expect(timeline.lateCount).toBe(
      timeline.items.filter((i) => !i.done && i.leadDays > 17).length,
    );
  });

  it("has nothing late when there is plenty of time", () => {
    const timeline = buildTimeline(recordFor({ ...weddingBrief, date: "2028-01-01" }), TODAY);
    expect(timeline.lateCount).toBe(0);
  });
});

describe("parseNewTask", () => {
  const today = "2026-11-01";
  const event = "2026-12-01";

  it("takes a trimmed title and counts the days it runs before the event", () => {
    expect(parseNewTask("  Hire chairs ", "2026-11-21", today, event)).toEqual({
      ok: true,
      task: { title: "Hire chairs", leadDays: 10 },
    });
  });

  it("names every field to fix: an empty title, and a date missing, past or after the event", () => {
    expect(parseNewTask("", "", today, event)).toEqual({ ok: false, invalid: ["title", "date"] });
    expect(parseNewTask(" ", "2026-11-21", today, event)).toEqual({
      ok: false,
      invalid: ["title"],
    });
    expect(parseNewTask("Chairs", "2026-10-31", today, event)).toEqual({
      ok: false,
      invalid: ["date"],
    });
    expect(parseNewTask("Chairs", "2026-12-02", today, event)).toEqual({
      ok: false,
      invalid: ["date"],
    });
  });
});
