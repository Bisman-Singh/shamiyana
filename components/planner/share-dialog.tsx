"use client";

import { useEffect, useId, useRef, useState } from "react";
import { encodeShare, shareUrl } from "@/lib/export/share";
import type { PlanRecord } from "@/lib/plan/schema";
import { useLocale } from "../locale-provider";
import { useAnnounce } from "../ui/announcer";
import { Notice } from "../ui/notice";

const MAX_LINK = 30_000;

/** A modal with the share link. The native dialog traps focus and closes on Escape. */
export function ShareDialog({ record, onClose }: { record: PlanRecord; onClose: () => void }) {
  const { dict } = useLocale();
  const s = dict.share;
  const baseId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [link, setLink] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);
  const announce = useAnnounce();
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    dialogRef.current?.showModal();
    let live = true;
    encodeShare(record).then(
      (encoded) => {
        if (live) setLink(shareUrl(window.location.origin, encoded));
      },
      () => {
        if (live) setBroken(true);
      },
    );
    return () => {
      live = false;
    };
  }, [record]);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
      announce(s.copied);
    } catch {
      setStatus("failed");
    }
  }

  const tooLong = link !== null && link.length > MAX_LINK;
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <dialog ref={dialogRef} className="dialog" aria-labelledby={`${baseId}-h`} onClose={onClose}>
      <h2 id={`${baseId}-h`}>{s.heading}</h2>
      <p>{s.intro}</p>
      {link === null && !broken ? <p>{dict.common.loading}</p> : null}
      {broken ? <Notice tone="error">{s.failed}</Notice> : null}
      {tooLong ? <Notice tone="error">{s.tooLong}</Notice> : null}
      {link !== null && !tooLong ? (
        <>
          <label htmlFor={`${baseId}-link`}>{s.label}</label>
          <input
            id={`${baseId}-link`}
            readOnly
            value={link}
            onFocus={(e) => {
              e.target.select();
            }}
          />
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={() => void copy(link)}>
              {s.copy}
            </button>
            {canShare ? (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  navigator.share({ title: record.brief.title, url: link }).catch(() => undefined);
                }}
              >
                {s.native}
              </button>
            ) : null}
          </div>
          {status === "copied" ? <Notice tone="success">{s.copied}</Notice> : null}
          {status === "failed" ? <Notice tone="error">{s.copyFailed}</Notice> : null}
        </>
      ) : null}
      <form method="dialog">
        <button type="submit" className="btn btn-quiet">
          {dict.common.close}
        </button>
      </form>
    </dialog>
  );
}
