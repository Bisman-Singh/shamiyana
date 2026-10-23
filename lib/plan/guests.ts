import { LIMITS, type Diet, type GuestGroup, type RsvpStatus } from "./constants";
import { guestSchema, type Guest } from "./schema";

export interface GuestTally {
  parties: number;
  invited: number;
  byRsvp: Record<RsvpStatus, number>;
  /** People who said yes or maybe: the number to give the caterer. */
  expected: number;
  /** Diet split of the expected people. */
  diets: Record<Diet, number>;
  byGroup: Record<GuestGroup, number>;
}

/** Head counts from a guest list; every number counts people, not invitations. */
export function tallyGuests(guests: readonly Guest[]): GuestTally {
  const byRsvp: Record<RsvpStatus, number> = { pending: 0, yes: 0, maybe: 0, no: 0 };
  const diets: Record<Diet, number> = { veg: 0, nonveg: 0, jain: 0, vegan: 0 };
  const byGroup: Record<GuestGroup, number> = {
    family: 0,
    friends: 0,
    work: 0,
    neighbours: 0,
    other: 0,
  };
  for (const guest of guests) {
    byRsvp[guest.rsvp] += guest.party;
    byGroup[guest.group] += guest.party;
    if (guest.rsvp === "yes" || guest.rsvp === "maybe") diets[guest.diet] += guest.party;
  }
  return {
    parties: guests.length,
    invited: guests.reduce((total, guest) => total + guest.party, 0),
    byRsvp,
    expected: byRsvp.yes + byRsvp.maybe,
    diets,
    byGroup,
  };
}

/** A household as typed into the add form, before it gets an id, a group and a reply. */
export type NewGuest =
  { ok: true; guest: Pick<Guest, "name" | "party"> } | { ok: false; invalid: ("name" | "party")[] };

/** A new household needs a name and a party size from 1 to the limit; nothing is clamped quietly. */
export function parseNewGuest(name: string, party: string): NewGuest {
  const named = guestSchema.shape.name.safeParse(name);
  const size = /^\d{1,3}$/.test(party.trim()) ? Number(party) : 0;
  const sized = size >= 1 && size <= LIMITS.partyMax;
  if (named.success && sized) return { ok: true, guest: { name: named.data, party: size } };
  const invalid: ("name" | "party")[] = [];
  if (!named.success) invalid.push("name");
  if (!sized) invalid.push("party");
  return { ok: false, invalid };
}
