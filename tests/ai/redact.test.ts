import { REDACTED, redact } from "@/lib/ai/redact";

describe("redact", () => {
  it.each([
    ["an email", "mail me at mama.ji+party@example.co.in please"],
    ["an Indian mobile", "call 98765 43210"],
    ["a mobile with country code", "call +91-9876543210"],
    ["a PAN", "PAN ABCDE1234F for invoices"],
    ["an Aadhaar-shaped number", "id 1234 5678 9012"],
    ["a long number", "account 001234567890123"],
    ["a mobile with a trunk zero", "call 098765 43210"],
    ["a dashed mobile", "call 987-654-3210"],
    ["a landline", "office 022 2345 6789"],
    ["a city landline", "call 0141-2345678"],
    ["a lowercase PAN", "pan abcde1234f"],
    ["a mobile in Devanagari digits", "फ़ोन ९८७६५४३२१०"],
  ])("removes %s", (_label, text) => {
    expect(redact(text)).toContain(REDACTED);
  });

  it("removes UPI IDs, which have no dot after the @", () => {
    expect(redact("Pay ramesh.k@oksbi or 9876543210@ybl, not ramesh@example.com")).toBe(
      "Pay [removed] or [removed], not [removed]",
    );
  });

  it.each([
    ["a card number", "card 4111 1111 1111 1111 expires soon", "card [removed] expires soon"],
    ["an Amex number", "amex 3782-822463-10005", "amex [removed]"],
    ["a GSTIN", "GSTIN 27AAPFU0939F1ZV on the bill", "GSTIN [removed] on the bill"],
    ["a voter ID", "voter ID ABC1234567", "voter ID [removed]"],
    ["a passport number", "passport K1234567 for the visa", "passport [removed] for the visa"],
  ])("removes all of %s", (_label, text, redacted) => {
    expect(redact(text)).toBe(redacted);
  });

  it("reads Indian-script digits as digits and keeps other numbers", () => {
    expect(redact("२५० मेहमान")).toBe("250 मेहमान");
    expect(redact("৪০ guests")).toBe("40 guests");
  });

  it("leaves dates, money and guest counts alone", () => {
    const text = "250 guests on 2027-02-14, budget 1800000, start 7:30 pm";
    expect(redact(text)).toBe(text);
  });
});
