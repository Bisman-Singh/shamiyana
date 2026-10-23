import { EVENT_TYPES } from "@/lib/plan/constants";
import { TASK_IDS, TASKS } from "@/lib/plan/task-templates";

describe("TASKS", () => {
  it("keeps task ids unique across every event type", () => {
    expect(new Set(TASK_IDS).size).toBe(TASK_IDS.length);
  });

  it("lists tasks from the furthest ahead down to the last day", () => {
    for (const type of EVENT_TYPES) {
      const leads = TASKS[type].map((task) => task.leadDays);
      expect(leads).toEqual([...leads].sort((first, second) => second - first));
    }
  });
});
