"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

export interface Tab<T extends string> {
  id: T;
  label: string;
  panel: ReactNode;
}

const KEY_MOVES: Record<string, (index: number, count: number) => number> = {
  ArrowRight: (i, n) => (i + 1) % n,
  ArrowLeft: (i, n) => (i - 1 + n) % n,
  Home: () => 0,
  End: (_, n) => n - 1,
};

/** The tab index a key press moves to, or null for keys tabs don't handle. */
export function nextTabIndex(key: string, index: number, count: number): number | null {
  const move = KEY_MOVES[key];
  return move ? move(index, count) : null;
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

interface TabsProps<T extends string> {
  label: string;
  tabs: readonly Tab<T>[];
  selected: T;
  onSelect: (id: T) => void;
}

/**
 * The WAI-ARIA tabs pattern with automatic activation: arrow keys, Home and
 * End move between tabs, Tab moves into the panel. Inactive panels stay
 * mounted but hidden, so their state survives a switch and print can show
 * them all.
 */
export function Tabs<T extends string>({
  label,
  tabs,
  selected,
  onSelect,
}: Readonly<TabsProps<T>>) {
  const baseId = useId();
  const tabsRef = useRef(new Map<T, HTMLButtonElement>());

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.altKey || event.metaKey || event.ctrlKey) return;
    const target = nextTabIndex(event.key, index, tabs.length);
    const next = target === null ? undefined : tabs[target];
    if (!next) return;
    event.preventDefault();
    onSelect(next.id);
    tabsRef.current.get(next.id)?.focus();
  }

  return (
    <div className="tabs">
      <div role="tablist" aria-label={label} className="tablist">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(node) => {
              if (node) tabsRef.current.set(tab.id, node);
              else tabsRef.current.delete(tab.id);
            }}
            type="button"
            role="tab"
            id={`${baseId}-tab-${tab.id}`}
            aria-selected={tab.id === selected}
            aria-controls={`${baseId}-panel-${tab.id}`}
            tabIndex={tab.id === selected ? 0 : -1}
            className="tab"
            onKeyDown={(event) => {
              onKeyDown(event, index);
            }}
            onClick={() => {
              onSelect(tab.id);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <section
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={tab.id !== selected}
          tabIndex={0}
          className="panel"
        >
          {tab.panel}
        </section>
      ))}
    </div>
  );
}
