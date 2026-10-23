import { csvCell, toCsv } from "@/lib/export/csv";

describe("CSV", () => {
  it.each([
    ['=HYPERLINK("x")', '"\'=HYPERLINK(""x"")"'],
    ["+91 98", "'+91 98"],
    ["-5", "'-5"],
    ["@SUM(A1)", "'@SUM(A1)"],
    ["\tcmd", "'\tcmd"],
    ["plain", "plain"],
    ["a,b", '"a,b"'],
    ["line\nbreak", '"line\nbreak"'],
    ["मेहंदी", "मेहंदी"],
  ])("makes %j safe as %s", (input, output) => {
    expect(csvCell(input)).toBe(output);
  });

  it("writes numbers plainly and blanks non-finite ones", () => {
    expect(csvCell(-1500)).toBe("-1500");
    expect(csvCell(Number.NaN)).toBe("");
  });

  it("starts with a BOM and uses CRLF rows", () => {
    expect(
      toCsv([
        ["Category", "Amount"],
        ["Venue", 3_60_000],
      ]),
    ).toBe("﻿Category,Amount\r\nVenue,360000\r\n");
  });
});
