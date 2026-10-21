"use client";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

/**
 * One polite live region for the whole app, present from the first paint.
 * Screen readers announce a region reliably only when it already exists and
 * its text changes; regions mounted together with their text are often
 * missed. Errors still use role="alert" where they appear.
 */

type Announce = (message: string) => void;

const AnnouncerContext = createContext<Announce>(() => undefined);

export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const announce = useCallback((next: string) => {
    // Clearing first makes a repeated message count as a change.
    setMessage("");
    requestAnimationFrame(() => {
      setMessage(next);
    });
  }, []);
  return (
    <AnnouncerContext value={announce}>
      {children}
      <p className="visually-hidden" role="status" aria-live="polite" data-testid="announcer">
        {message}
      </p>
    </AnnouncerContext>
  );
}

export function useAnnounce(): Announce {
  return use(AnnouncerContext);
}

/** Moves focus to an element once, after it mounts, when asked to. */
export function useFocusOnMount<T extends HTMLElement>(when: boolean): RefObject<T | null> {
  const ref = useRef<T>(null);
  // Read once: later renders must not pull focus back.
  const focusNowRef = useRef(when);
  useEffect(() => {
    if (focusNowRef.current) ref.current?.focus();
  }, []);
  return ref;
}
