"use client";

import { useId, useState, type SubmitEvent } from "react";
import { format } from "@/lib/i18n/format";
import { DIETS, GUEST_GROUPS, LIMITS, type Diet, type GuestGroup } from "@/lib/plan/constants";
import { parseNewGuest } from "@/lib/plan/guests";
import { newId, upsertGuest } from "@/lib/plan/record";
import type { Guest } from "@/lib/plan/schema";
import { useLocale } from "@/components/locale-provider";
import { useAnnounce } from "@/components/ui/announcer";
import { SelectField, TextField } from "@/components/ui/field";
import { focusAfterRender } from "@/components/ui/focus";
import type { Update } from "@/components/planner/types";

interface AddGuestFormProps {
  update: Update;
  full: boolean;
}

/** Adds one household at a time; a field that needs fixing says so and takes focus. */
export function AddGuestForm({ update, full }: Readonly<AddGuestFormProps>) {
  const { dict } = useLocale();
  const baseId = useId();
  const [name, setName] = useState("");
  const [group, setGroup] = useState<GuestGroup>("family");
  const [party, setParty] = useState("1");
  const [diet, setDiet] = useState<Diet>("veg");
  const [invalid, setInvalid] = useState<readonly ("name" | "party")[]>([]);
  const announce = useAnnounce();

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseNewGuest(name, party);
    setInvalid(parsed.ok ? [] : parsed.invalid);
    if (!parsed.ok) {
      focusAfterRender(`${baseId}-${parsed.invalid.includes("name") ? "name" : "party"}`);
      return;
    }
    const guest: Guest = { id: newId(), ...parsed.guest, group, rsvp: "pending", diet };
    update((record, now) => upsertGuest(record, guest, now));
    announce(format(dict.guests.added, { name: guest.name }));
    setName("");
    setParty("1");
    focusAfterRender(`${baseId}-name`);
  }

  if (full) return <p className="hint">{dict.guests.limit}</p>;
  return (
    <form className="add-guest" onSubmit={submit} noValidate aria-labelledby={`${baseId}-h`}>
      <h3 id={`${baseId}-h`}>{dict.guests.addHeading}</h3>
      <div className="form-row">
        <TextField
          id={`${baseId}-name`}
          label={dict.guests.name}
          value={name}
          maxLength={LIMITS.guestNameMax}
          autoComplete="off"
          error={invalid.includes("name") ? dict.guests.nameError : undefined}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
        <SelectField<GuestGroup>
          id={`${baseId}-group`}
          label={dict.guests.group}
          value={group}
          options={GUEST_GROUPS.map((value) => ({ value, label: dict.guests.groups[value] }))}
          onValueChange={setGroup}
        />
        <TextField
          id={`${baseId}-party`}
          label={dict.guests.party}
          type="number"
          inputMode="numeric"
          min={1}
          max={LIMITS.partyMax}
          value={party}
          error={
            invalid.includes("party")
              ? format(dict.guests.partyError, { max: LIMITS.partyMax })
              : undefined
          }
          onChange={(event) => {
            setParty(event.target.value);
          }}
        />
        <SelectField<Diet>
          id={`${baseId}-diet`}
          label={dict.guests.diet}
          value={diet}
          options={DIETS.map((value) => ({ value, label: dict.guests.diets[value] }))}
          onValueChange={setDiet}
        />
        <button type="submit" className="btn">
          {dict.guests.add}
        </button>
      </div>
    </form>
  );
}
