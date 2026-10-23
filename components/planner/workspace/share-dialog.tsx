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
  const s = dict.share;
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
      <label htmlFor={id}>{s.label}</label>
      <input
        id={id}
        readOnly
        value={link}
        onFocus={(e) => {
          e.target.select();
        }}
      />
      <div className="actions">
        <button ref={copyRef} type="button" className="btn btn-primary" onClick={() => void copy()}>
          {s.copy}
        </button>
        {canShare ? (
          <button
            type="button"
            className="btn"
            onClick={() => {
              navigator.share({ title, url: link }).catch(() => undefined);
            }}
          >
            {s.native}
          </button>
        ) : null}
      </div>
      <div role="status">
        {status === "copied" ? <Notice tone="success">{s.copied}</Notice> : null}
      </div>
      {status === "failed" ? <Notice tone="error">{s.copyFailed}</Notice> : null}
    </>
  );
}

interface ShareDialogProps {
  record: PlanRecord;
  onClose: () => void;
}

/**
 * A modal with the share link. The native dialog makes the page behind it
 * inert and closes on Escape; its description is the privacy note.
 */
export function ShareDialog({ record, onClose }: Readonly<ShareDialogProps>) {
  const { dict } = useLocale();
  const s = dict.share;
  const baseId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [link, setLink] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);
  const [tooLong, setTooLong] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
    let live = true;
    encodeShare(record).then(
      (encoded) => {
        if (!live) return;
        if (encoded.length > MAX_ENCODED) setTooLong(true);
        else setLink(shareUrl(window.location.origin, encoded));
      },
      () => {
        if (live) setBroken(true);
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
      <h2 id={`${baseId}-h`}>{s.heading}</h2>
      <p id={`${baseId}-intro`}>{s.intro}</p>
      {link === null && !broken && !tooLong ? <p>{dict.common.loading}</p> : null}
      {broken ? <Notice tone="error">{s.failed}</Notice> : null}
      {tooLong ? <Notice tone="error">{s.tooLong}</Notice> : null}
      {link === null ? null : <ShareLink link={link} title={record.brief.title} />}
      <form method="dialog">
        <button type="submit" className="btn btn-quiet">
          {dict.common.close}
        </button>
      </form>
    </dialog>
  );
}
