"use client";

import { format, formatNumber } from "@/lib/i18n/format";
import { DIETS, LIMITS, RSVP_STATUSES } from "@/lib/plan/constants";
import { updateBrief } from "@/lib/plan/record";
import { useLocale } from "@/components/locale-provider";
import { useAnnounce } from "@/components/ui/announcer";
import { focusOpenPanel } from "@/components/ui/focus";
import { Notice } from "@/components/ui/notice";
import type { PanelProps } from "@/components/planner/types";

/** Head counts by reply and food, and an offer to use the list's count when it differs from the plan's. */
export function GuestTallies({ view, update }: Readonly<PanelProps>) {
  const { dict, locale } = useLocale();
  const { record, guests: tally } = view;
  const announce = useAnnounce();
  const count = (value: number) => formatNumber(value, locale);
  const mismatch = tally.expected > 0 && tally.expected !== record.brief.guests;
  return (
    <>
      <dl className="ledger ledger-compact">
        <div>
          <dt>{dict.guests.invited}</dt>
          <dd>{count(tally.invited)}</dd>
        </div>
        {RSVP_STATUSES.map((status) => (
          <div key={status}>
            <dt>{dict.guests.rsvps[status]}</dt>
            <dd>{count(tally.byRsvp[status])}</dd>
          </div>
        ))}
        <div>
          <dt>{dict.guests.expected}</dt>
          <dd>{count(tally.expected)}</dd>
        </div>
      </dl>
      {tally.expected > 0 ? (
        <p className="hint">
          {dict.guests.foodSplit}:{" "}
          {DIETS.filter((diet) => tally.diets[diet] > 0)
            .map((diet) => `${dict.guests.diets[diet]} ${count(tally.diets[diet])}`)
            .join(", ")}
        </p>
      ) : null}
      {/* the region is always there, so a mismatch that appears is announced */}
      <div role="status">
        {mismatch ? (
          <Notice
            action={
              <button
                type="button"
                className="btn btn-small"
                onClick={() => {
                  const guests = Math.min(LIMITS.guestsMax, tally.expected);
                  update((current, now) => updateBrief(current, { ...current.brief, guests }, now));
                  announce(format(dict.guests.countUsed, { n: count(guests) }));
                  focusOpenPanel();
                }}
              >
                {format(dict.guests.useCount, { n: count(tally.expected) })}
              </button>
            }
          >
            {format(dict.guests.mismatch, {
              plan: count(record.brief.guests),
              list: count(tally.expected),
            })}
          </Notice>
        ) : null}
      </div>
    </>
  );
}
