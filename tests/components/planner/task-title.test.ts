import { getDictionary } from "@/lib/i18n";
import { taskTitle } from "@/components/planner/task-title";

describe("taskTitle", () => {
  it("falls back to a task's id when it has no title or translation", () => {
    const dict = getDictionary("en");
    expect(taskTitle({ id: "unknown_task", title: null }, dict)).toBe("unknown_task");
    expect(taskTitle({ id: "w_book_venue", title: null }, dict)).toBe(
      "Visit and book the main venue",
    );
  });
});
