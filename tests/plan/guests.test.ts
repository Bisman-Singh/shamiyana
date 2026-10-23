import { tallyGuests } from "@/lib/plan/guests";
import type { Guest } from "@/lib/plan/schema";

describe("tallyGuests", () => {
  const guest = (patch: Partial<Guest>): Guest => ({
    id: "g",
    name: "Nani",
    group: "family",
    party: 1,
    rsvp: "pending",
    diet: "veg",
    ...patch,
  });

  it("counts people, not invitations", () => {
    const tally = tallyGuests([
      guest({ party: 4, rsvp: "yes" }),
      guest({ party: 2, rsvp: "maybe", diet: "jain", group: "neighbours" }),
      guest({ party: 3, rsvp: "no", diet: "nonveg", group: "work" }),
      guest({ party: 1, group: "friends" }),
    ]);
    expect(tally).toEqual({
      parties: 4,
      invited: 10,
      byRsvp: { pending: 1, yes: 4, maybe: 2, no: 3 },
      expected: 6,
      diets: { veg: 4, nonveg: 0, jain: 2, vegan: 0 },
      byGroup: { family: 4, friends: 1, work: 3, neighbours: 2, other: 0 },
    });
  });

  it("is all zeros for an empty list", () => {
    expect(tallyGuests([])).toMatchObject({ parties: 0, invited: 0, expected: 0 });
  });
});
