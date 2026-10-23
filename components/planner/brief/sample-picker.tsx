"use client";

import { useId } from "react";
import { EVENT_TYPES, type EventType } from "@/lib/plan/constants";
import { useLocale } from "@/components/locale-provider";

interface SamplePickerProps {
  onPick: (type: EventType) => void;
}

/** One button per event type that fills the form with a worked example. */
export function SamplePicker({ onPick }: Readonly<SamplePickerProps>) {
  const { dict } = useLocale();
  const headingId = useId();
  return (
    <div className="samples">
      <p id={headingId}>{dict.form.samplesLabel}</p>
      <ul className="inline-list" aria-labelledby={headingId}>
        {EVENT_TYPES.map((type) => (
          <li key={type}>
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => {
                onPick(type);
              }}
            >
              {dict.form.samples[type]}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
