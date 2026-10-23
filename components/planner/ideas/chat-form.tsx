"use client";

import { useId, type RefObject, type SubmitEvent } from "react";
import { LIMITS } from "@/lib/plan/constants";
import { cleanText } from "@/lib/shared/plain-text";
import { useLocale } from "@/components/locale-provider";

interface ChatFormProps {
  /** The id of the hint that explains what the box is for. */
  hintId: string;
  message: string;
  pending: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onSend: (event: SubmitEvent<HTMLFormElement>) => void;
}

/** The message box and Send; Send stays focusable while a reply is pending and says so. */
export function ChatForm({
  hintId,
  message,
  pending,
  inputRef,
  onChange,
  onSend,
}: Readonly<ChatFormProps>) {
  const { dict } = useLocale();
  const inputId = useId();
  return (
    <form onSubmit={onSend} className="chat-form">
      <label htmlFor={inputId}>{dict.refine.label}</label>
      <div className="form-row">
        <input
          ref={inputRef}
          id={inputId}
          aria-describedby={hintId}
          value={message}
          maxLength={LIMITS.chatMessageMax}
          autoComplete="off"
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
        <button
          type="submit"
          className="btn"
          aria-disabled={pending || cleanText(message) === "" || undefined}
        >
          {pending ? dict.refine.thinking : dict.refine.send}
        </button>
      </div>
    </form>
  );
}
