"use client";

import { useEffect, useState } from "react";
import { localToday } from "@/lib/plan/dates";

/** Today's date on this device, rolling over at midnight while the page is open. */
export function useToday(): string {
  const [today, setToday] = useState(localToday);
  useEffect(() => {
    const timer = window.setInterval(() => {
      setToday(localToday());
    }, 60_000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);
  return today;
}
