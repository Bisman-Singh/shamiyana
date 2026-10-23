import {
  addDays,
  compactDate,
  daysBetween,
  fromDayNumber,
  isIsoDate,
  localToday,
  saturdayOnOrBefore,
  toDayNumber,
  wholeWeeks,
} from "@/lib/plan/dates";

describe("ISO dates", () => {
  it("accepts real calendar days, including a leap day", () => {
    expect(isIsoDate("2026-10-21")).toBe(true);
    expect(isIsoDate("2028-02-29")).toBe(true);
  });

  it.each([
    "2026-02-29",
    "2026-13-01",
    "2026-04-31",
    "2026-1-01",
    "21-10-2026",
    "",
    "2026-10-21T00:00",
  ])("rejects %j", (value) => {
    expect(isIsoDate(value)).toBe(false);
    expect(toDayNumber(value)).toBeNull();
  });

  it("round-trips through day numbers", () => {
    expect(toDayNumber("1970-01-01")).toBe(0);
    expect(fromDayNumber(toDayNumber("2027-02-14") ?? Number.NaN)).toBe("2027-02-14");
  });

  it("adds days across month, year and leap boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
    expect(addDays("2027-02-14", -240)).toBe("2026-06-19");
  });

  it("counts days in both directions", () => {
    expect(daysBetween("2026-10-21", "2027-02-14")).toBe(116);
    expect(daysBetween("2027-02-14", "2026-10-21")).toBe(-116);
  });

  it("refuses arithmetic on a malformed date", () => {
    expect(() => addDays("2026-02-30", 1)).toThrow(RangeError);
  });

  it("reads today in local time from a clock", () => {
    expect(localToday(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(localToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("formats compact dates for calendars", () => {
    expect(compactDate("2027-02-14")).toBe("20270214");
  });
});

describe("wholeWeeks", () => {
  it("counts whole weeks and never below zero", () => {
    expect(wholeWeeks("2026-10-21", "2027-02-14")).toBe(16);
    expect(wholeWeeks("2026-10-21", "2026-10-27")).toBe(0);
    expect(wholeWeeks("2026-10-21", "2026-10-01")).toBe(0);
  });
});

describe("saturdayOnOrBefore", () => {
  it("finds the Saturday on or before a date", () => {
    expect(saturdayOnOrBefore("2026-10-31")).toBe("2026-10-31");
    expect(saturdayOnOrBefore("2026-11-02")).toBe("2026-10-31");
    expect(saturdayOnOrBefore("2026-11-06")).toBe("2026-10-31");
  });
});
