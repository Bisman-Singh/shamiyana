"use client";

import { useId, useState, type SubmitEvent } from "react";
import { guestRows } from "@/lib/export/sheets";
import type { Dictionary } from "@/lib/i18n/en";
import { downloadCsv } from "@/lib/client/files";
import { format, formatNumber } from "@/lib/i18n/format";
import {
  DIETS,
  GUEST_GROUPS,
  LIMITS,
  RSVP_STATUSES,
  type Diet,
  type GuestGroup,
  type RsvpStatus,
} from "@/lib/plan/constants";
import { oneOf } from "@/lib/shared/untrusted";
import { newId, removeGuest, updateBrief, upsertGuest } from "@/lib/plan/record";
import { guestSchema, type Guest } from "@/lib/plan/schema";
import { useLocale } from "../locale-provider";
import { useAnnounce } from "../ui/announcer";
import { SelectField, TextField } from "../ui/field";
import { focusAfterRender, focusOpenPanel } from "../ui/focus";
import type { PanelProps, Update } from "./types";

interface AddGuestProps {
  update: Update;
  full: boolean;
}

interface GuestErrors {
  name?: string;
  party?: string;
}

/** A new household needs a name and a party size from 1 to the limit; nothing is clamped quietly. */
function checkGuest(name: string, party: string, dict: Dictionary) {
  const g = dict.guests;
  const named = guestSchema.shape.name.safeParse(name);
  const size = /^\d{1,3}$/.test(party.trim()) ? Number(party) : 0;
  const errors: GuestErrors = {
    name: named.success ? undefined : g.nameError,
    party:
      size >= 1 && size <= LIMITS.partyMax
        ? undefined
        : format(g.partyError, { max: LIMITS.partyMax }),
  };
  const guest = named.success && !errors.party ? { name: named.data, party: size } : null;
  return { errors, guest };
}

function AddGuest({ update, full }: Readonly<AddGuestProps>) {
  const { dict } = useLocale();
  const g = dict.guests;
  const baseId = useId();
  const [name, setName] = useState("");
  const [group, setGroup] = useState<GuestGroup>("family");
  const [party, setParty] = useState("1");
  const [diet, setDiet] = useState<Diet>("veg");
  const [errors, setErrors] = useState<GuestErrors>({});
  const announce = useAnnounce();

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const checked = checkGuest(name, party, dict);
    setErrors(checked.errors);
    if (!checked.guest) {
      focusAfterRender(`${baseId}-${checked.errors.name ? "name" : "party"}`);
      return;
    }
    const guest: Guest = { id: newId(), ...checked.guest, group, rsvp: "pending", diet };
    update((r, now) => upsertGuest(r, guest, now));
    announce(format(g.added, { name: guest.name }));
    setName("");
    setParty("1");
    focusAfterRender(`${baseId}-name`);
  }

  if (full) return <p className="hint">{g.limit}</p>;
  return (
    <form className="add-guest" onSubmit={submit} noValidate aria-labelledby={`${baseId}-h`}>
      <h3 id={`${baseId}-h`}>{g.addHeading}</h3>
      <div className="form-row">
        <TextField
          id={`${baseId}-name`}
          label={g.name}
          value={name}
          maxLength={LIMITS.guestNameMax}
          autoComplete="off"
          error={errors.name}
          onChange={(e) => {
            setName(e.target.value);
          }}
        />
        <SelectField<GuestGroup>
          id={`${baseId}-group`}
          label={g.group}
          value={group}
          options={GUEST_GROUPS.map((v) => ({ value: v, label: g.groups[v] }))}
          onValueChange={setGroup}
        />
        <TextField
          id={`${baseId}-party`}
          label={g.party}
          type="number"
          inputMode="numeric"
          min={1}
          max={LIMITS.partyMax}
          value={party}
          error={errors.party}
          onChange={(e) => {
            setParty(e.target.value);
          }}
        />
        <SelectField<Diet>
          id={`${baseId}-diet`}
          label={g.diet}
          value={diet}
          options={DIETS.map((v) => ({ value: v, label: g.diets[v] }))}
          onValueChange={setDiet}
        />
        <button type="submit" className="btn">
          {g.add}
        </button>
      </div>
    </form>
  );
}

function Tallies({ view, update }: Readonly<PanelProps>) {
  const { dict, locale } = useLocale();
  const g = dict.guests;
  const { record, guests: tally } = view;
  const announce = useAnnounce();
  const n = (value: number) => formatNumber(value, locale);
  const mismatch = tally.expected > 0 && tally.expected !== record.brief.guests;
  return (
    <>
      <dl className="ledger ledger-compact">
        <div>
          <dt>{g.invited}</dt>
          <dd>{n(tally.invited)}</dd>
        </div>
        {RSVP_STATUSES.map((s) => (
          <div key={s}>
            <dt>{g.rsvps[s]}</dt>
            <dd>{n(tally.byRsvp[s])}</dd>
          </div>
        ))}
        <div>
          <dt>{g.expected}</dt>
          <dd>{n(tally.expected)}</dd>
        </div>
      </dl>
      {tally.expected > 0 ? (
        <p className="hint">
          {g.foodSplit}:{" "}
          {DIETS.filter((d) => tally.diets[d] > 0)
            .map((d) => `${g.diets[d]} ${n(tally.diets[d])}`)
            .join(", ")}
        </p>
      ) : null}
      {/* the region is always there, so a mismatch that appears is announced */}
      <div role="status">
        {mismatch ? (
          <div className="notice notice-info">
            <p>{format(g.mismatch, { plan: n(record.brief.guests), list: n(tally.expected) })}</p>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => {
                const guests = Math.min(LIMITS.guestsMax, tally.expected);
                update((r, now) => updateBrief(r, { ...r.brief, guests }, now));
                announce(format(g.countUsed, { n: n(guests) }));
                focusOpenPanel();
              }}
            >
              {format(g.useCount, { n: n(tally.expected) })}
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}

interface GuestRowProps {
  guest: Guest;
  update: Update;
}

function GuestRow({ guest, update }: Readonly<GuestRowProps>) {
  const { dict, locale } = useLocale();
  const g = dict.guests;
  return (
    <tr>
      <th scope="row">{guest.name}</th>
      <td>{g.groups[guest.group]}</td>
      <td className="num">{formatNumber(guest.party, locale)}</td>
      <td>{g.diets[guest.diet]}</td>
      <td>
        <select
          aria-label={format(g.rsvpLabel, { name: guest.name })}
          value={guest.rsvp}
          onChange={(e) => {
            const rsvp = oneOf(e.target.value, RSVP_STATUSES);
            if (rsvp) update((r, now) => upsertGuest(r, { ...guest, rsvp }, now));
          }}
        >
          {RSVP_STATUSES.map((s) => (
            <option key={s} value={s}>
              {g.rsvps[s]}
            </option>
          ))}
        </select>
      </td>
      <td>
        <button
          type="button"
          className="btn btn-small btn-quiet"
          aria-label={format(g.removeLabel, { name: guest.name })}
          onClick={() => {
            update(
              (r, now) => removeGuest(r, guest.id, now),
              format(g.removed, { name: guest.name }),
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

function GuestTable({ guests, update }: Readonly<GuestTableProps>) {
  const { dict } = useLocale();
  const g = dict.guests;
  const filterId = useId();
  const [filter, setFilter] = useState<RsvpStatus | "all">("all");
  const [limit, setLimit] = useState(PAGE);
  const matching = filter === "all" ? guests : guests.filter((x) => x.rsvp === filter);
  const shown = matching.slice(0, limit);
  const more = Math.min(PAGE, matching.length - shown.length);
  return (
    <>
      <SelectField<RsvpStatus | "all">
        id={filterId}
        label={g.filterLabel}
        value={filter}
        options={[
          { value: "all", label: g.all },
          ...RSVP_STATUSES.map((s) => ({ value: s, label: g.rsvps[s] })),
        ]}
        onValueChange={setFilter}
      />
      <div className="table-scroll">
        <table className="ledger-table">
          <caption className="visually-hidden">{g.tableCaption}</caption>
          <thead>
            <tr>
              <th scope="col">{g.name}</th>
              <th scope="col">{g.group}</th>
              <th scope="col" className="num">
                {g.party}
              </th>
              <th scope="col">{g.diet}</th>
              <th scope="col">{g.rsvp}</th>
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
            setLimit((n) => n + PAGE);
          }}
        >
          {format(g.showMore, { n: more })}
        </button>
      ) : null}
    </>
  );
}

/** Households, replies and food counts, with a CSV export. */
export function GuestsPanel({ view, update }: Readonly<PanelProps>) {
  const { dict } = useLocale();
  const g = dict.guests;
  const { record } = view;
  return (
    <div className="guests">
      <div className="panel-head">
        <h2>{g.heading}</h2>
        <button
          type="button"
          className="btn btn-quiet"
          disabled={record.guests.length === 0}
          onClick={() => {
            downloadCsv(record.brief.title, "guests", guestRows(record.guests, dict));
          }}
        >
          {g.csv}
        </button>
      </div>
      <p className="hint">{g.privacy}</p>
      <Tallies view={view} update={update} />
      <AddGuest update={update} full={record.guests.length >= LIMITS.guestListMax} />
      {record.guests.length === 0 ? (
        <p>{g.empty}</p>
      ) : (
        <GuestTable guests={record.guests} update={update} />
      )}
    </div>
  );
}
