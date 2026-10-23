"use client";

import { createContext, use, useCallback, useState, type ReactNode } from "react";

/**
 * One polite live region for the whole app, present from the first paint.
 * Screen readers announce a region reliably only when it already exists and
 * its text changes; regions mounted together with their text are often
 * missed. Errors still use role="alert" where they appear.
 */

type Announce = (message: string) => void;

const AnnouncerContext = createContext<Announce>(() => undefined);

interface AnnouncerProviderProps {
  children: ReactNode;
}

/** Holds the one polite live region and lets any component speak through it. */
export function AnnouncerProvider({ children }: Readonly<AnnouncerProviderProps>) {
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

/** Says a message through the live region. */
export function useAnnounce(): Announce {
  return use(AnnouncerContext);
}
