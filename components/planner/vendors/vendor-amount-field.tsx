"use client";

import { useState, type ReactNode } from "react";
import { readRupees } from "@/lib/plan/amounts";
import { useLocale } from "@/components/locale-provider";
import { TextField } from "@/components/ui/text-field";

interface VendorAmountFieldProps {
  id: string;
  label: ReactNode;
  value: number;
  /** Gets each amount as soon as the text reads as one. */
  onAmountChange: (rupees: number) => void;
}

const asText = (rupees: number) => (rupees === 0 ? "" : String(rupees));

/**
 * A rupee amount that keeps exactly what is typed. It saves once the text
 * reads as an amount, and otherwise says what to fix rather than saving a
 * wrong number or clearing the field.
 */
export function VendorAmountField({
  id,
  label,
  value,
  onAmountChange,
}: Readonly<VendorAmountFieldProps>) {
  const { dict } = useLocale();
  const [text, setText] = useState(() => asText(value));
  const [lastValue, setLastValue] = useState(value);
  // a change made elsewhere, such as Undo, replaces the typed text
  if (value !== lastValue) {
    setLastValue(value);
    if (readRupees(text) !== value) setText(asText(value));
  }
  return (
    <TextField
      id={id}
      label={label}
      inputMode="numeric"
      value={text}
      error={readRupees(text) === null ? dict.vendors.amountError : undefined}
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        const amount = readRupees(next);
        if (amount !== null) onAmountChange(amount);
      }}
    />
  );
}
