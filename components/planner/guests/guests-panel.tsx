"use client";

import { downloadCsv } from "@/lib/client/files";
import { guestRows } from "@/lib/export/sheets";
import { LIMITS } from "@/lib/plan/constants";
import { useLocale } from "@/components/locale-provider";
import type { PanelProps } from "@/components/planner/types";
import { AddGuestForm } from "./add-guest-form";
import { GuestTable } from "./guest-table";
import { GuestTallies } from "./guest-tallies";

/** Households, replies and food counts, with a CSV export. */
export function GuestsPanel({ view, update }: Readonly<PanelProps>) {
  const { dict } = useLocale();
  const { record } = view;
  return (
    <div className="guests">
      <div className="panel-head">
        <h2>{dict.guests.heading}</h2>
        <button
          type="button"
          className="btn btn-quiet"
          disabled={record.guests.length === 0}
          onClick={() => {
            downloadCsv(record.brief.title, "guests", guestRows(record.guests, dict));
          }}
        >
          {dict.guests.csv}
        </button>
      </div>
      <p className="hint">{dict.guests.privacy}</p>
      <GuestTallies view={view} update={update} />
      <AddGuestForm update={update} full={record.guests.length >= LIMITS.guestListMax} />
      {record.guests.length === 0 ? (
        <p>{dict.guests.empty}</p>
      ) : (
        <GuestTable guests={record.guests} update={update} />
      )}
    </div>
  );
}
