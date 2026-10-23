import { readAmount, readRupees } from "@/lib/plan/amounts";

describe("readAmount", () => {
  it("reads amounts typed the Indian way", () => {
    expect(readAmount("₹18,00,000")).toBe(1_800_000);
    expect(readAmount("18 00 000")).toBe(1_800_000);
    expect(readAmount("")).toBeNull();
    expect(readAmount("abc")).toBeNull();
    expect(readAmount("1234567890123")).toBeNull();
  });
});

describe("readRupees", () => {
  it("reads a typed amount, and nothing typed yet as zero", () => {
    expect(readRupees("₹4,80,000")).toBe(4_80_000);
    expect(readRupees("50 000")).toBe(50_000);
    expect(readRupees("")).toBe(0);
    expect(readRupees("₹ ")).toBe(0);
  });

  it("refuses words, decimals and more than the largest budget", () => {
    expect(readRupees("3 lakh")).toBeNull();
    expect(readRupees("4800.50")).toBeNull();
    expect(readRupees("-500")).toBeNull();
    expect(readRupees("999999999999")).toBeNull();
    expect(readRupees("500000000")).toBe(500_000_000);
  });
});
