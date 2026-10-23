/**
 * Catches a model that rewords a checklist item instead of adding a new task.
 * Titles are reduced to their content words, cut to five letters so that
 * "photographer" meets "photos" and "invites" meets "invitations", with
 * planning verbs and words every task shares left out. A task counts as a
 * rewording when it shares at least two content words with a checklist item
 * and those cover two thirds of both titles, so a task that brings words of
 * its own, like crowd management near the food stalls, is new. One shared word is never
 * enough: "Arrange a cake tasting" is a new task next to "Order the cake", and
 * "Design and order the invitations" differs from "Send the invitations" only
 * in the verbs this leaves out.
 */

const IGNORED = new Set(
  [
    // grammar
    "a an the and or for with of to in on at by from into out up as if so is are be it its",
    "this that all every each any your their our some more less after before who what how",
    // planning verbs
    "book hire reserve arrange order get fix plan set send buy make confirm finalise finalize",
    "lock choose check ask collect do give put recruit apply walk place pack hand design visit",
    "form prepare organise organize ensure schedule coordinate secure create share add keep",
    "sort decide select call contact inform brief rent hold run start update agree talk",
    // words nearly every task carries
    "guest guests event events wedding function functions party day final list",
  ]
    .join(" ")
    .split(" "),
);

export function contentWords(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((word) => word.length >= 2 && !IGNORED.has(word))
      .map((word) => word.slice(0, 5)),
  );
}

export function isRewording(task: string, item: string): boolean {
  const taskWords = contentWords(task);
  const itemWords = contentWords(item);
  const shared = [...taskWords].filter((word) => itemWords.has(word)).length;
  return shared >= 2 && shared * 3 >= Math.max(taskWords.size, itemWords.size) * 2;
}

export interface Rewording {
  task: string;
  item: string;
}

export function rewordings(tasks: readonly string[], checklist: readonly string[]): Rewording[] {
  return tasks.flatMap((task) =>
    checklist.filter((item) => isRewording(task, item)).map((item) => ({ task, item })),
  );
}
