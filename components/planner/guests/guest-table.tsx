"use client";

import { useId, useState } from "react";
import { format, formatNumber } from "@/lib/i18n/format";
import { RSVP_STATUSES, type RsvpStatus } from "@/lib/plan/constants";
import { removeGuest, upsertGuest } from "@/lib/plan/record";
import type { Guest } from "@/lib/plan/schema";
import { oneOf } from "@/lib/shared/untrusted";
import { useLocale } from "@/components/locale-provider";
import type { Update } from "@/components/planner/types";
import { SelectField } from "@/components/ui/select-field";

interface GuestRowProps {
  guest: Guest;
  update: Update;
}

/** One household with its reply, which can be changed in place, and Remove. */
function GuestRow({ guest, update }: Readonly<GuestRowProps>) {
  const { dict, locale } = useLocale();
  return (
    <tr>
      <th scope="row">{guest.name}</th>
      <td>{dict.guests.groups[guest.group]}</td>
      <td className="num">{formatNumber(guest.party, locale)}</td>
      <td>{dict.guests.diets[guest.diet]}</td>
      <td>
        <select
          aria-label={format(dict.guests.rsvpLabel, { name: guest.name })}
          value={guest.rsvp}
          onChange={(event) => {
            const rsvp = oneOf(event.target.value, RSVP_STATUSES);
            if (rsvp) update((record, now) => upsertGuest(record, { ...guest, rsvp }, now));
          }}
        >
          {RSVP_STATUSES.map((status) => (
            <option key={status} value={status}>
              {dict.guests.rsvps[status]}
            </option>
          ))}
        </select>
      </td>
      <td>
        <button
          type="button"
          className="btn btn-small btn-quiet"
          aria-label={format(dict.guests.removeLabel, { name: guest.name })}
          onClick={() => {
            update(
              (record, now) => removeGuest(record, guest.id, now),
              format(dict.guests.removed, { name: guest.name }),
            );
          }}
        >
          {dict.common.remove}
        </button>
      </td>
    </tr>
  );
}

/** Rows rendered at a time; a long list grows on request instead of all at once. */
const PAGE = 100;

interface GuestTableProps {
  guests: readonly Guest[];
  update: Update;
}

/** The guest list, filtered by reply and shown a page at a time. */
export function GuestTable({ guests, update }: Readonly<GuestTableProps>) {
  const { dict } = useLocale();
  const filterId = useId();
  const [filter, setFilter] = useState<RsvpStatus | "all">("all");
  const [limit, setLimit] = useState(PAGE);
  const matching = filter === "all" ? guests : guests.filter((guest) => guest.rsvp === filter);
  const shown = matching.slice(0, limit);
  const more = Math.min(PAGE, matching.length - shown.length);
  return (
    <>
      <SelectField<RsvpStatus | "all">
        id={filterId}
        label={dict.guests.filterLabel}
        value={filter}
        options={[
          { value: "all", label: dict.guests.all },
          ...RSVP_STATUSES.map((status) => ({ value: status, label: dict.guests.rsvps[status] })),
        ]}
        onValueChange={setFilter}
      />
      <div className="table-scroll">
        <table className="ledger-table">
          <caption className="visually-hidden">{dict.guests.tableCaption}</caption>
          <thead>
            <tr>
              <th scope="col">{dict.guests.name}</th>
              <th scope="col">{dict.guests.group}</th>
              <th scope="col" className="num">
                {dict.guests.party}
              </th>
              <th scope="col">{dict.guests.diet}</th>
              <th scope="col">{dict.guests.rsvp}</th>
              <th scope="col">
                <span className="visually-hidden">{dict.common.remove}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((guest) => (
              <GuestRow key={guest.id} guest={guest} update={update} />
            ))}
          </tbody>
        </table>
      </div>
      {more > 0 ? (
        <button
          type="button"
          className="btn btn-quiet"
          onClick={() => {
            setLimit((shownSoFar) => shownSoFar + PAGE);
          }}
        >
          {format(dict.guests.showMore, { n: more })}
        </button>
      ) : null}
    </>
  );
}
