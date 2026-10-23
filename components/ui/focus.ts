import { useEffect, useRef, type RefObject } from "react";

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

/**
 * Focuses a field once the next frame is drawn, so it already carries the
 * error and aria-invalid that the same event set, and a screen reader reads
 * them with the label.
 */
export function focusAfterRender(id: string): void {
  requestAnimationFrame(() => {
    document.getElementById(id)?.focus();
  });
}

/**
 * For when the focused control goes away, such as a row put back by Undo or a
 * button whose job is done: focus moves to the open panel, not the page.
 */
export function focusOpenPanel(): void {
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden])')?.focus();
  });
}

/** A dismissed notice takes the focus with it, so focus goes to the page's heading. */
export function focusHeading(): void {
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>("h1")?.focus();
  });
}
