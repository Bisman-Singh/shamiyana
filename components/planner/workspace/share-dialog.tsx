"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MAX_ENCODED, encodeShare, shareUrl } from "@/lib/export/share";
import type { PlanRecord } from "@/lib/plan/schema";
import { useLocale } from "@/components/locale-provider";
import { Notice } from "@/components/ui/notice";

interface ShareLinkProps {
  link: string;
  title: string;
}

/**
 * The link with Copy and, where the browser has one, its share sheet. Copy
 * takes focus when the link appears. The modal hides the page's live region,
 * so the dialog keeps its own status region for "Link copied."
 */
function ShareLink({ link, title }: Readonly<ShareLinkProps>) {
  const { dict } = useLocale();
  const id = useId();
  const copyRef = useRef<HTMLButtonElement>(null);
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    copyRef.current?.focus();
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <>
      <label htmlFor={id}>{dict.share.label}</label>
      <input
        id={id}
        readOnly
        value={link}
        onFocus={(event) => {
          event.target.select();
        }}
      />
      <div className="actions">
        <button ref={copyRef} type="button" className="btn btn-primary" onClick={() => void copy()}>
          {dict.share.copy}
        </button>
        {canShare ? (
          <button
            type="button"
            className="btn"
            onClick={() => {
              navigator.share({ title, url: link }).catch(() => undefined);
            }}
          >
            {dict.share.native}
          </button>
        ) : null}
      </div>
      <div role="status">
        {status === "copied" ? <Notice tone="success">{dict.share.copied}</Notice> : null}
      </div>
      {status === "failed" ? <Notice tone="error">{dict.share.copyFailed}</Notice> : null}
    </>
  );
}

interface ShareDialogProps {
  record: PlanRecord;
  onClose: () => void;
}

/** Where making the link has got to: still encoding, ready, failed, or too long for a link. */
type LinkState =
  | { phase: "encoding" }
  | { phase: "ready"; url: string }
  | { phase: "failed" }
  | { phase: "tooLong" };

/**
 * A modal with the share link. The native dialog makes the page behind it
 * inert and closes on Escape; its description is the privacy note.
 */
export function ShareDialog({ record, onClose }: Readonly<ShareDialogProps>) {
  const { dict } = useLocale();
  const baseId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [link, setLink] = useState<LinkState>({ phase: "encoding" });

  useEffect(() => {
    dialogRef.current?.showModal();
    let live = true;
    encodeShare(record).then(
      (encoded) => {
        if (!live) return;
        setLink(
          encoded.length > MAX_ENCODED
            ? { phase: "tooLong" }
            : { phase: "ready", url: shareUrl(window.location.origin, encoded) },
        );
      },
      () => {
        if (live) setLink({ phase: "failed" });
      },
    );
    return () => {
      live = false;
    };
  }, [record]);

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby={`${baseId}-h`}
      aria-describedby={`${baseId}-intro`}
      onClose={onClose}
    >
      <h2 id={`${baseId}-h`}>{dict.share.heading}</h2>
      <p id={`${baseId}-intro`}>{dict.share.intro}</p>
      {link.phase === "encoding" ? <p>{dict.common.loading}</p> : null}
      {link.phase === "failed" ? <Notice tone="error">{dict.share.failed}</Notice> : null}
      {link.phase === "tooLong" ? <Notice tone="error">{dict.share.tooLong}</Notice> : null}
      {link.phase === "ready" ? <ShareLink link={link.url} title={record.brief.title} /> : null}
      <form method="dialog">
        <button type="submit" className="btn btn-quiet">
          {dict.common.close}
        </button>
      </form>
    </dialog>
  );
}
