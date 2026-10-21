import type { Dictionary } from "@/lib/i18n/en";
import type { TaskArea } from "@/lib/plan/constants";
import type { TimelineItem } from "@/lib/plan/timeline";

/** A template task's translated title, or the AI or user's own text. */
export function taskTitle(item: Pick<TimelineItem, "id" | "title">, dict: Dictionary): string {
  return item.title ?? (dict.tasks as Record<string, string>)[item.id] ?? item.id;
}

export function areaName(area: TaskArea, dict: Dictionary): string {
  return area === "planning" ? dict.areas.planning : dict.categories[area];
}
