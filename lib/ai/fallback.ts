/**
 * Model fallback for streams. A stream cannot switch models halfway through
 * an answer, but it can before the answer starts: each attempt is read until
 * it produces content or fails, and the first one that produces content is
 * returned, replayed from its first part. When every attempt fails first,
 * the caller gets null and can still answer with a proper error status.
 */

export interface Probe<T> {
  isContent: (part: T) => boolean;
  isError: (part: T) => boolean;
}

async function open<T>(
  stream: ReadableStream<T>,
  probe: Probe<T>,
): Promise<ReadableStream<T> | null> {
  const reader = stream.getReader();
  const buffered: T[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return null;
    if (probe.isError(value)) {
      await reader.cancel();
      return null;
    }
    buffered.push(value);
    if (probe.isContent(value)) break;
  }
  return new ReadableStream<T>({
    start(controller) {
      for (const part of buffered) controller.enqueue(part);
    },
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) controller.close();
      else controller.enqueue(value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

export interface Attempt<T> {
  id: string;
  run: () => T;
}

/** The first model whose stream yields a chunk in time; a model that fails before then hands over to the next. */
export async function firstWorking<T>(
  attempts: readonly Attempt<ReadableStream<T>>[],
  probe: Probe<T>,
  onFail: (id: string) => void = () => undefined,
): Promise<{ id: string; stream: ReadableStream<T> } | null> {
  for (const attempt of attempts) {
    const stream = await Promise.resolve()
      .then(() => open(attempt.run(), probe))
      .catch(() => null);
    if (stream) return { id: attempt.id, stream };
    onFail(attempt.id);
  }
  return null;
}

/** Tries each async attempt in order and returns the first success. */
export async function firstSuccess<T>(
  attempts: readonly Attempt<Promise<T>>[],
  onFail: (id: string) => void = () => undefined,
): Promise<{ id: string; value: T } | null> {
  for (const attempt of attempts) {
    try {
      return { id: attempt.id, value: await attempt.run() };
    } catch {
      onFail(attempt.id);
    }
  }
  return null;
}
