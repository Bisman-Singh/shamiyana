"use client";

import { useEffect } from "react";

/** Names the browser tab, and gives the page its own title back on unmount. */
export function usePageTitle(title: string): void {
  useEffect(() => {
    const before = document.title;
    document.title = title;
    return () => {
      document.title = before;
    };
  }, [title]);
}
