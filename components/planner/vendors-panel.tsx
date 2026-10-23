"use client";

import { checklistRows } from "@/lib/export/sheets";
import { downloadCsv } from "@/lib/client/files";
import { format } from "@/lib/i18n/format";
import { vendorTally } from "@/lib/plan/vendors";
import { useLocale } from "../locale-provider";
import type { PanelProps } from "./types";
import { VendorEntry } from "./vendor-entry";

/** One card per vendor with status, price, payments, notes and questions to ask. */
export function VendorsPanel({ view, update }: Readonly<PanelProps>) {
  const { dict } = useLocale();
  const v = dict.vendors;
  const tally = vendorTally(view.vendors);
  const { record } = view;

  return (
    <div className="vendors">
      <div className="panel-head">
        <h2>{v.heading}</h2>
        <p className="hint">
          {format(v.summary, { booked: tally.booked + tally.paid, total: view.vendors.length })}
        </p>
        <button
          type="button"
          className="btn btn-quiet"
          onClick={() => {
            downloadCsv(record.brief.title, "checklist", checklistRows(view.vendors, dict));
          }}
        >
          {dict.downloads.checklist}
        </button>
      </div>
      <details className="steps">
        <summary>{v.steps}</summary>
        <ol>
          {v.stepList.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </details>
      <ul className="vendor-list">
        {view.vendors.map((card) => (
          <VendorEntry key={card.category} card={card} city={record.brief.city} update={update} />
        ))}
      </ul>
    </div>
  );
}
