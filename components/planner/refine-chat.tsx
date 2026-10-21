"use client";

import { useId, useState, type SubmitEvent } from "react";
import { requestRefine } from "@/lib/client/api";
import type { Dictionary } from "@/lib/i18n/en";
import { format, formatDate, formatMoney, plural } from "@/lib/i18n/format";
import type { Change } from "@/lib/plan/changes";
import { LIMITS, type Locale } from "@/lib/plan/constants";
import { applyChanges, newId } from "@/lib/plan/record";
import { cleanText } from "@/lib/plan/text";
import { factsOf } from "@/lib/plan/schema";
import { useLocale } from "../locale-provider";
import { Notice } from "../ui/notice";
import type { PlanView, Update } from "./types";

interface Turn {
  id: string;
  role: "user" | "assistant";
  text: string;
}

interface Proposal {
  items: { key: string; change: Change; picked: boolean }[];
}

/** Plain words for a proposed change, so the user knows exactly what they approve. */
export function describeChange(change: Change, dict: Dictionary, locale: Locale): string {
  const c = dict.refine.changes;
  switch (change.op) {
    case "set_budget":
      return format(c.set_budget, { amount: formatMoney(change.amount, locale) });
    case "set_guests":
      return format(c.set_guests, { n: change.count });
    case "set_date":
      return format(c.set_date, { date: formatDate(change.date, locale) });
    case "shift_category":
      return format(change.factor >= 1 ? c.shift_more : c.shift_less, {
        category: dict.categories[change.category],
        pct: Math.round(Math.abs(change.factor - 1) * 100),
      });
    case "add_task":
      return format(c.add_task, { title: change.title, weeks: change.weeksBefore });
    case "add_idea":
      return format(c.add_idea, { title: change.title });
  }
}

function ChatLog({ turns }: { turns: readonly Turn[] }) {
  const { dict } = useLocale();
  if (turns.length === 0) return null;
  return (
    <ol className="chat" aria-live="polite">
      {turns.map((turn) => (
        <li key={turn.id} className={`chat-turn chat-${turn.role}`}>
          <span className="chat-who">
            {turn.role === "user" ? dict.refine.you : dict.refine.assistant}
          </span>
          <p>{turn.text}</p>
        </li>
      ))}
    </ol>
  );
}

function ProposalForm({
  proposal,
  onChange,
  onApply,
  onDiscard,
}: {
  proposal: Proposal;
  onChange: (next: Proposal) => void;
  onApply: () => void;
  onDiscard: () => void;
}) {
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
          <span>{describeChange(item.change, dict, locale)}</span>
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

function ChatForm({
  message,
  pending,
  onChange,
  onSend,
}: {
  message: string;
  pending: boolean;
  onChange: (value: string) => void;
  onSend: (event: SubmitEvent<HTMLFormElement>) => void;
}) {
  const { dict } = useLocale();
  const r = dict.refine;
  const inputId = useId();
  return (
    <form onSubmit={onSend} className="chat-form">
      <label htmlFor={inputId}>{r.label}</label>
      <div className="form-row">
        <input
          id={inputId}
          value={message}
          maxLength={LIMITS.chatMessageMax}
          autoComplete="off"
          onChange={(e) => {
            onChange(e.target.value);
          }}
        />
        <button type="submit" className="btn" disabled={pending || cleanText(message) === ""}>
          {pending ? r.thinking : r.send}
        </button>
      </div>
    </form>
  );
}

export function RefineChat({ view, update }: { view: PlanView; update: Update }) {
  const { dict, locale } = useLocale();
  const r = dict.refine;
  const baseId = useId();
  const [message, setMessage] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [applied, setApplied] = useState<string | null>(null);

  async function send(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = cleanText(message);
    if (text === "" || pending) return;
    setPending(true);
    setError(null);
    setApplied(null);
    const { record } = view;
    const history = turns.slice(-6).map(({ role, text: said }) => ({ role, text: said }));
    const body = {
      facts: factsOf(record.brief),
      factors: record.factors,
      locale,
      today: view.today,
      history,
      message: text,
    };
    const result = await requestRefine(
      body,
      view.budget.rows.map((row) => row.category),
      view.today,
    );
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
      ].slice(-12),
    );
    const items = result.data.changes.map((change) => ({ key: newId(), change, picked: false }));
    setProposal(items.length > 0 ? { items } : null);
  }

  function apply(current: Proposal) {
    const chosen = current.items.filter((i) => i.picked).map((i) => i.change);
    const note = plural(locale, r.applied, chosen.length);
    update((rec, now) => applyChanges(rec, chosen, newId, now), note);
    setApplied(note);
    setProposal(null);
  }

  return (
    <section aria-labelledby={`${baseId}-h`} className="refine">
      <h3 id={`${baseId}-h`}>{r.heading}</h3>
      <p className="hint">{r.intro}</p>
      <ChatLog turns={turns} />
      {proposal ? (
        <ProposalForm
          proposal={proposal}
          onChange={setProposal}
          onApply={() => {
            apply(proposal);
          }}
          onDiscard={() => {
            setProposal(null);
          }}
        />
      ) : null}
      {applied ? <Notice tone="success">{applied}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <ChatForm
        message={message}
        pending={pending}
        onChange={setMessage}
        onSend={(e) => void send(e)}
      />
    </section>
  );
}
