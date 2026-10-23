import type { Dictionary } from "@/lib/i18n/en";
import { messageOr } from "@/lib/i18n/messages";
import type { TaskArea } from "@/lib/plan/constants";
import type { TimelineItem } from "@/lib/plan/timeline";

/** A template task's translated title, or the AI or user's own text. */
export function taskTitle(item: Pick<TimelineItem, "id" | "title">, dict: Dictionary): string {
  return item.title ?? messageOr(dict.tasks, item.id, item.id);
}

/** A task area's name: planning, or the vendor category it belongs to. */
export function areaName(area: TaskArea, dict: Dictionary): string {
  return area === "planning" ? dict.areas.planning : dict.categories[area];
}
