"use client";

import { useId, useState, useRef, type RefObject, type SubmitEvent } from "react";
import { langOf } from "@/lib/i18n/lang";
import type { Turn as ChatTurn } from "@/lib/ai/prompts";
import { requestRefine } from "@/lib/client/api";
import type { Dictionary } from "@/lib/i18n/en";
import { format, formatDate, formatMoney, plural } from "@/lib/i18n/format";
import { previewShifts, type ShiftPreview } from "@/lib/plan/budget";
import { fitChanges, type Change } from "@/lib/plan/changes";
import { wholeWeeks } from "@/lib/plan/dates";
import { LIMITS, type Locale } from "@/lib/plan/constants";
import { applyChanges, newId } from "@/lib/plan/record";
import { cleanText } from "@/lib/shared/plain-text";
import { factsOf } from "@/lib/plan/schema";
import { useLocale } from "../locale-provider";
import { useAnnounce } from "../ui/announcer";
import { Notice } from "../ui/notice";
import type { PanelProps, PlanView, Update } from "./types";
import { useRequestSignal } from "./use-request-signal";

/** A turn on screen: the model's view of it plus a key for the list. */
interface Turn extends ChatTurn {
  id: string;
}

interface Proposal {
  items: { key: string; change: Change; picked: boolean }[];
}

/** Plain words for a proposed change, so the user knows exactly what they approve. */
export function describeChange(
  change: Change,
  dict: Dictionary,
  locale: Locale,
  preview: ShiftPreview,
): string {
  const c = dict.refine.changes;
  switch (change.op) {
    case "set_budget":
      return format(c.set_budget, { amount: formatMoney(change.amount, locale) });
    case "set_guests":
      return format(c.set_guests, { n: change.count });
    case "set_date":
      return format(c.set_date, { date: formatDate(change.date, locale) });
    case "shift_category": {
      const { before, after } = preview(change.category, change.factor);
      return format(change.factor >= 1 ? c.shift_more : c.shift_less, {
        category: dict.categories[change.category],
        before: formatMoney(before, locale),
        after: formatMoney(after, locale),
      });
    }
    case "add_task":
      return format(c.add_task, { title: change.title, weeks: change.weeksBefore });
    case "add_idea":
      return format(c.add_idea, { title: change.title });
  }
}

interface ChatLogProps {
  turns: readonly Turn[];
}

function ChatLog({ turns }: Readonly<ChatLogProps>) {
  const { dict, locale } = useLocale();
  if (turns.length === 0) return null;
  return (
    <ol className="chat">
      {turns.map((turn) => (
        <li key={turn.id} className={`chat-turn chat-${turn.role}`}>
          <span className="chat-who">
            {turn.role === "user" ? dict.refine.you : dict.refine.assistant}
          </span>
          <p lang={langOf(turn.text, locale)}>{turn.text}</p>
        </li>
      ))}
    </ol>
  );
}

interface ProposalFormProps {
  proposal: Proposal;
  preview: ShiftPreview;
  onChange: (next: Proposal) => void;
  onApply: () => void;
  onDiscard: () => void;
}

function ProposalForm({
  proposal,
  preview,
  onChange,
  onApply,
  onDiscard,
}: Readonly<ProposalFormProps>) {
  const { dict, locale } = useLocale();
  const r = dict.refine;
  return (
    <fieldset className="proposal">
      <legend>{r.proposed}</legend>
      {proposal.items.map((item) => (
        <label key={item.key} className="choice">
          <input
            type="checkbox"
            checked={item.picked}
            onChange={(e) => {
              onChange({
                items: proposal.items.map((i) =>
                  i.key === item.key ? { ...i, picked: e.target.checked } : i,
                ),
              });
            }}
          />
          <span>{describeChange(item.change, dict, locale, preview)}</span>
        </label>
      ))}
      <div className="actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!proposal.items.some((i) => i.picked)}
          onClick={onApply}
        >
          {r.apply}
        </button>
        <button type="button" className="btn" onClick={onDiscard}>
          {r.discard}
        </button>
      </div>
    </fieldset>
  );
}

interface ChatFormProps {
  /** The id of the hint that explains what the box is for. */
  hintId: string;
  message: string;
  pending: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onSend: (event: SubmitEvent<HTMLFormElement>) => void;
}

function ChatForm({
  hintId,
  message,
  pending,
  inputRef,
  onChange,
  onSend,
}: Readonly<ChatFormProps>) {
  const { dict } = useLocale();
  const r = dict.refine;
  const inputId = useId();
  return (
    <form onSubmit={onSend} className="chat-form">
      <label htmlFor={inputId}>{r.label}</label>
      <div className="form-row">
        <input
          ref={inputRef}
          id={inputId}
          aria-describedby={hintId}
          value={message}
          maxLength={LIMITS.chatMessageMax}
          autoComplete="off"
          onChange={(e) => {
            onChange(e.target.value);
          }}
        />
        <button
          type="submit"
          className="btn"
          aria-disabled={pending || cleanText(message) === "" || undefined}
        >
          {pending ? r.thinking : r.send}
        </button>
      </div>
    </form>
  );
}

/** What the refine route needs: the event facts, never its title or guest list, and the last few turns. */
function refineBody(view: PlanView, locale: Locale, turns: readonly Turn[], message: string) {
  return {
    facts: factsOf(view.record.brief),
    factors: view.record.factors,
    locale,
    today: view.today,
    history: turns.slice(-LIMITS.chatHistoryMax).map(({ role, text }) => ({ role, text })),
    message,
  };
}

/** Turns kept on screen; the model sees only the last few. */
const TURNS_KEPT = 12;

/**
 * The chat's state: the conversation, the request in flight and the changes
 * the assistant proposed. Nothing is applied until the user ticks it.
 */
function useRefineChat(view: PlanView, update: Update) {
  const { dict, locale } = useLocale();
  const r = dict.refine;
  const [message, setMessage] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [quiet, setQuiet] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const announce = useAnnounce();
  const requests = useRequestSignal();

  async function send(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = cleanText(message);
    if (text === "" || pending) return;
    setPending(true);
    setError(null);
    setQuiet(false);
    const signal = requests.next();
    const result = await requestRefine(
      refineBody(view, locale, turns, text),
      view.budget.rows.map((row) => row.category),
      view.today,
      signal,
    );
    if (signal.aborted) return;
    setPending(false);
    if (!result.ok) {
      setError(dict.ai.errors[result.error]);
      return;
    }
    setMessage("");
    setTurns((t) =>
      [
        ...t,
        { id: newId(), role: "user" as const, text },
        { id: newId(), role: "assistant" as const, text: result.data.reply },
      ].slice(-TURNS_KEPT),
    );
    const weeks = wholeWeeks(view.today, view.record.brief.date);
    const items = fitChanges(result.data.changes, weeks).map((change) => ({
      key: newId(),
      change,
      picked: false,
    }));
    setProposal(items.length > 0 ? { items } : null);
    setQuiet(items.length === 0);
    announce(items.length > 0 ? result.data.reply : `${result.data.reply} ${r.noChanges}`);
  }

  function apply(current: Proposal) {
    const chosen = current.items.filter((i) => i.picked).map((i) => i.change);
    const note = plural(locale, r.applied, chosen.length);
    update((rec, now) => applyChanges(rec, chosen, newId, now), note);
    setProposal(null);
  }

  return {
    message,
    setMessage,
    turns,
    pending,
    error,
    proposal,
    setProposal,
    quiet,
    inputRef,
    send,
    apply,
  };
}

/** Plan changes asked for in plain words, proposed as tickable changes. */
export function RefineChat({ view, update }: Readonly<PanelProps>) {
  const { dict } = useLocale();
  const r = dict.refine;
  const baseId = useId();
  const {
    message,
    setMessage,
    turns,
    pending,
    error,
    proposal,
    setProposal,
    quiet,
    inputRef,
    send,
    apply,
  } = useRefineChat(view, update);

  return (
    <section aria-labelledby={`${baseId}-h`} className="refine">
      <h3 id={`${baseId}-h`}>{r.heading}</h3>
      <p className="hint" id={`${baseId}-hint`}>
        {r.intro}
      </p>
      <ChatLog turns={turns} />
      {proposal ? (
        <ProposalForm
          proposal={proposal}
          preview={previewShifts(factsOf(view.record.brief), view.record.factors)}
          onChange={setProposal}
          onApply={() => {
            apply(proposal);
          }}
          onDiscard={() => {
            setProposal(null);
            inputRef.current?.focus();
          }}
        />
      ) : null}
      {quiet ? <p className="hint">{r.noChanges}</p> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <ChatForm
        hintId={`${baseId}-hint`}
        message={message}
        pending={pending}
        inputRef={inputRef}
        onChange={setMessage}
        onSend={(e) => void send(e)}
      />
    </section>
  );
}
