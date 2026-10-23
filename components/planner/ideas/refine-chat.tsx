"use client";

import { useId } from "react";
import { langOf } from "@/lib/i18n/lang";
import { useLocale } from "@/components/locale-provider";
import type { PanelProps } from "@/components/planner/types";
import { Notice } from "@/components/ui/notice";
import { ChatForm } from "./chat-form";
import { ProposalForm } from "./proposal-form";
import { useRefineChat, type ShownTurn } from "./use-refine-chat";

interface ChatLogProps {
  turns: readonly ShownTurn[];
}

/** The conversation so far, each turn in the language it was written in. */
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

/** Plan changes asked for in plain words, proposed as tickable changes. */
export function RefineChat({ view, update }: Readonly<PanelProps>) {
  const { dict } = useLocale();
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
      <h3 id={`${baseId}-h`}>{dict.refine.heading}</h3>
      <p className="hint" id={`${baseId}-hint`}>
        {dict.refine.intro}
      </p>
      <ChatLog turns={turns} />
      {proposal ? (
        <ProposalForm
          proposal={proposal}
          preview={view.preview}
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
      {quiet ? <p className="hint">{dict.refine.noChanges}</p> : null}
      {error ? <Notice tone="error">{dict.ai.errors[error]}</Notice> : null}
      <ChatForm
        hintId={`${baseId}-hint`}
        message={message}
        pending={pending}
        inputRef={inputRef}
        onChange={setMessage}
        onSend={(event) => void send(event)}
      />
    </section>
  );
}
