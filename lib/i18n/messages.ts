/** A message by a key that may be missing, such as a task id from an older backup, or the fallback. */
export function messageOr(
  messages: Readonly<Record<string, string>>,
  key: string,
  fallback: string,
): string {
  return messages[key] ?? fallback;
}
