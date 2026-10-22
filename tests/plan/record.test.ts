import { factsOf } from "@/lib/plan/schema";
import { fitChanges } from "@/lib/plan/changes";
import { LIMITS } from "@/lib/plan/constants";
import { wholeWeeks } from "@/lib/plan/dates";
import { fitTasks } from "@/lib/plan/enrichment";
import {
  addTask,
  applyChanges,
  newId,
  removeGuest,
  removeIdea,
  removeTask,
  restoreHiddenTasks,
  saveIdea,
  setFactor,
  setVendor,
  stableId,
  toggleTask,
  upsertGuest,
  withEnrichment,
} from "@/lib/plan/record";
import { planRecordSchema, type Guest } from "@/lib/plan/schema";
import { NOW, birthdayBrief, recordFor, sampleEnrichment, weddingBrief } from "../fixtures";

const LATER = "2026-10-22T08:00:00.000Z";
const FOR = { facts: factsOf(weddingBrief), locale: "en" as const };
const guest: Guest = {
  id: "g1",
  name: "Chachaji",
  group: "family",
  party: 3,
  rsvp: "yes",
  diet: "veg",
};

describe("fitting AI tasks to the date", () => {
  it("counts whole weeks and never below zero", () => {
    expect(wholeWeeks("2026-10-21", "2027-02-14")).toBe(16);
    expect(wholeWeeks("2026-10-21", "2026-10-27")).toBe(0);
    expect(wholeWeeks("2026-10-21", "2026-10-01")).toBe(0);
  });

  it("caps AI and proposed tasks at the weeks left and leaves the rest alone", () => {
    const e = {
      ...sampleEnrichment,
      tasks: [
        { title: "Far", area: "planning" as const, weeksBefore: 30 },
        { title: "Near", area: "planning" as const, weeksBefore: 2 },
      ],
    };
    expect(fitTasks(e, 16).tasks.map((t) => t.weeksBefore)).toEqual([16, 2]);
    expect(fitTasks(e, 16).ideas).toBe(e.ideas);
    const changes = fitChanges(
      [
        { op: "add_task", title: "Far", area: "planning", weeksBefore: 30 },
        { op: "set_guests", count: 120 },
      ],
      4,
    );
    expect(changes).toEqual([
      { op: "add_task", title: "Far", area: "planning", weeksBefore: 4 },
      { op: "set_guests", count: 120 },
    ]);
  });
});

describe("record helpers", () => {
  it("creates a valid empty record", () => {
    const record = recordFor(weddingBrief);
    expect(planRecordSchema.parse(record)).toEqual(record);
    expect(record.createdAt).toBe(NOW);
  });

  it("makes random ids and stable content ids", () => {
    expect(newId()).toMatch(/^[0-9a-f-]{36}$/);
    expect(stableId("ai", "Book tent")).toBe(stableId("ai", "Book tent"));
    expect(stableId("ai", "Book tent")).not.toBe(stableId("ai", "Book tents"));
    expect(stableId("ai", "मेहंदी")).toMatch(/^ai-[0-9a-z]+$/);
  });

  it("toggles a task and touches the timestamp", () => {
    const once = toggleTask(recordFor(weddingBrief), "w_book_venue", LATER);
    expect(once.done).toEqual(["w_book_venue"]);
    expect(once.updatedAt).toBe(LATER);
    expect(toggleTask(once, "w_book_venue", LATER).done).toEqual([]);
  });

  it("adds custom tasks up to the limit", () => {
    let record = recordFor(weddingBrief);
    for (let i = 0; i < LIMITS.customTasksMax + 3; i += 1) {
      record = addTask(
        record,
        { title: `Task ${i}`, area: "planning", leadDays: 3 },
        `t${i}`,
        LATER,
      );
    }
    expect(record.tasks).toHaveLength(LIMITS.customTasksMax);
    expect(record.tasks[0]).toEqual({
      id: "t0",
      title: "Task 0",
      area: "planning",
      leadDays: 3,
      source: "custom",
    });
  });

  it("deletes custom tasks but only hides template tasks, clearing done either way", () => {
    let record = addTask(
      recordFor(weddingBrief),
      { title: "x", area: "venue", leadDays: 1 },
      "t1",
      LATER,
    );
    record = toggleTask(toggleTask(record, "t1", LATER), "w_roka", LATER);
    record = removeTask(record, "t1", LATER);
    expect(record.tasks).toEqual([]);
    record = removeTask(removeTask(record, "w_roka", LATER), "w_roka", LATER);
    expect(record.hidden).toEqual(["w_roka"]);
    expect(record.done).toEqual([]);
    expect(restoreHiddenTasks(record, LATER).hidden).toEqual([]);
  });

  it("stores an enrichment and turns its tasks into AI tasks", () => {
    const record = withEnrichment(recordFor(weddingBrief), sampleEnrichment, FOR, LATER);
    expect(record.enrichment).toEqual(sampleEnrichment);
    expect(record.enrichedFor).toEqual(FOR);
    expect(record.tasks).toEqual([
      {
        id: stableId("ai", "Book a tent backup for rain|venue|8"),
        title: "Book a tent backup for rain",
        area: "venue",
        leadDays: 56,
        source: "ai",
      },
    ]);
  });

  it("replaces unfinished AI tasks on a new enrichment, keeps finished and custom ones", () => {
    let record = withEnrichment(recordFor(weddingBrief), sampleEnrichment, FOR, LATER);
    const firstAi = record.tasks[0]?.id ?? "";
    record = addTask(record, { title: "Mine", area: "planning", leadDays: 2 }, "mine", LATER);
    const second = {
      ...sampleEnrichment,
      tasks: [
        { title: "Order diyas", area: "decor" as const, weeksBefore: 2 },
        { title: "Order diyas", area: "decor" as const, weeksBefore: 2 },
      ],
    };
    const replaced = withEnrichment(record, second, FOR, LATER);
    expect(replaced.tasks.map((t) => t.title)).toEqual(["Mine", "Order diyas"]);

    const kept = withEnrichment(
      toggleTask(record, firstAi, LATER),
      { ...sampleEnrichment },
      FOR,
      LATER,
    );
    expect(kept.tasks.map((t) => t.id)).toEqual([firstAi, "mine"]);
  });

  it("sets vendor progress and budget factors", () => {
    const progress = {
      status: "booked" as const,
      quote: 50_000,
      paid: 10_000,
      note: "Advance paid",
    };
    const record = setVendor(recordFor(birthdayBrief), "venue", progress, LATER);
    expect(record.vendors.venue).toEqual(progress);
    const shifted = setFactor(record, "decor", 1.3, LATER);
    expect(shifted.factors).toEqual({ decor: 1.3 });
    expect(setFactor(shifted, "decor", 1, LATER).factors).toEqual({});
    expect(setFactor(shifted, "decor", null, LATER).factors).toEqual({});
  });

  it("adds, edits and removes guests within the limit", () => {
    let record = upsertGuest(recordFor(weddingBrief), guest, LATER);
    record = upsertGuest(record, { ...guest, rsvp: "no" }, LATER);
    expect(record.guests).toEqual([{ ...guest, rsvp: "no" }]);
    expect(removeGuest(record, "g1", LATER).guests).toEqual([]);

    const full = recordFor(weddingBrief, {
      guests: Array.from({ length: LIMITS.guestListMax }, (_, i) => ({ ...guest, id: `g${i}` })),
    });
    expect(upsertGuest(full, { ...guest, id: "extra" }, LATER)).toBe(full);
    expect(upsertGuest(full, { ...guest, id: "g0", party: 9 }, LATER).guests[0]?.party).toBe(9);
  });

  it("saves ideas once and up to the limit", () => {
    const idea = { id: "i1", area: "decor" as const, title: "Diya wall", detail: "" };
    let record = saveIdea(recordFor(weddingBrief), idea, LATER);
    expect(saveIdea(record, { ...idea, id: "i2" }, LATER)).toBe(record);
    expect(removeIdea(record, "i1", LATER).ideas).toEqual([]);
    for (let i = 0; i < LIMITS.savedIdeasMax + 2; i += 1) {
      record = saveIdea(record, { ...idea, id: `n${i}`, title: `Idea ${i}` }, LATER);
    }
    expect(record.ideas).toHaveLength(LIMITS.savedIdeasMax);
  });

  it("applies approved changes in order", () => {
    let n = 0;
    const ids = () => `id${(n += 1)}`;
    const record = applyChanges(
      recordFor(weddingBrief),
      [
        { op: "set_budget", amount: 20_00_000 },
        { op: "set_guests", count: 300 },
        { op: "set_date", date: "2027-03-01" },
        { op: "shift_category", category: "decor", factor: 0.8 },
        { op: "add_task", title: "Book shuttle", area: "transport", weeksBefore: 3 },
        { op: "add_idea", area: "music", title: "Shehnai at entry", detail: "Live" },
      ],
      ids,
      LATER,
    );
    expect(record.brief).toMatchObject({ budget: 20_00_000, guests: 300, date: "2027-03-01" });
    expect(record.factors).toEqual({ decor: 0.8 });
    expect(record.tasks).toEqual([
      { id: "id5", title: "Book shuttle", area: "transport", leadDays: 21, source: "custom" },
    ]);
    expect(record.ideas).toEqual([
      { id: "id6", area: "music", title: "Shehnai at entry", detail: "Live" },
    ]);
    expect(planRecordSchema.safeParse(record).success).toBe(true);
  });
});
