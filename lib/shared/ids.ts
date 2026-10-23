/** A fresh random id for a new plan, task, guest or idea. */
export function newId(): string {
  return crypto.randomUUID();
}

/** A short id that stays the same for the same text, from a 32 bit FNV-1a hash. */
export function stableId(prefix: string, text: string): string {
  let hash = 0x811c9dc5;
  for (const unit of new TextEncoder().encode(text)) {
    hash ^= unit;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${prefix}-${hash.toString(36)}`;
}
