"use client";

import { toCsv } from "@/lib/export/csv";
import { fileName, mapsSearchUrl } from "@/lib/export/links";
import { checklistRows } from "@/lib/export/sheets";
import { downloadText } from "@/lib/client/files";
import { format, formatMoney } from "@/lib/i18n/format";
import { LIMITS, VENDOR_STATUSES, type VendorStatus } from "@/lib/plan/constants";
import { readAmount } from "@/lib/plan/draft";
import { setVendor } from "@/lib/plan/record";
import type { VendorProgress } from "@/lib/plan/schema";
import { vendorTally, type VendorCard } from "@/lib/plan/vendors";
import { useLocale } from "../locale-provider";
import { SelectField, TextArea, TextField } from "../ui/field";
import type { PlanView, Update } from "./types";

function rupees(text: string): number {
  return Math.min(LIMITS.budgetMax, readAmount(text) ?? 0);
}

function Questions({ title, items }: { title: string; items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <>
      <h3 className="subhead">{title}</h3>
      <ul className="plain-list">
        {items.map((q) => (
          <li key={q}>{q}</li>
        ))}
      </ul>
    </>
  );
}

function Card({ card, city, update }: { card: VendorCard; city: string; update: Update }) {
  const { dict, locale } = useLocale();
  const v = dict.vendors;
  const name = dict.categories[card.category];
  const id = `vendor-${card.category}`;
  const save = (patch: Partial<VendorProgress>) => {
    update((r, now) => setVendor(r, card.category, { ...card.progress, ...patch }, now));
  };
  const questions = v.questions[card.category];

  return (
    <li className="vendor">
      <details>
        <summary>
          <span className="vendor-name">{name}</span>
          <span className="tag">{v.statuses[card.progress.status]}</span>
          <span className="hint">
            {format(v.planned, { amount: formatMoney(card.planned, locale) })}
          </span>
        </summary>
        <div className="vendor-body">
          <div className="form-row">
            <SelectField<VendorStatus>
              id={`${id}-status`}
              label={format(v.statusLabel, { category: name })}
              value={card.progress.status}
              options={VENDOR_STATUSES.map((s) => ({ value: s, label: v.statuses[s] }))}
              onChange={(e) => {
                save({ status: e.target.value as VendorStatus });
              }}
            />
            <TextField
              id={`${id}-quote`}
              label={v.agreed}
              inputMode="numeric"
              value={card.progress.quote === 0 ? "" : String(card.progress.quote)}
              onChange={(e) => {
                save({ quote: rupees(e.target.value) });
              }}
            />
            <TextField
              id={`${id}-paid`}
              label={v.paid}
              inputMode="numeric"
              value={card.progress.paid === 0 ? "" : String(card.progress.paid)}
              onChange={(e) => {
                save({ paid: rupees(e.target.value) });
              }}
            />
          </div>
          <TextArea
            id={`${id}-note`}
            label={v.note}
            hint={v.noteHint}
            rows={2}
            maxLength={200}
            value={card.progress.note}
            onChange={(e) => {
              save({ note: e.target.value.slice(0, 200) });
            }}
          />
          <Questions title={v.ask} items={questions} />
          <Questions title={v.aiAsk} items={card.aiQuestions} />
          <a
            className="btn btn-small btn-quiet"
            href={mapsSearchUrl(card.search, city)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {format(v.find, { phrase: card.search, city })}{" "}
            <span className="visually-hidden">{dict.common.opensNewTab}</span>
          </a>
        </div>
      </details>
    </li>
  );
}

export function VendorsPanel({ view, update }: { view: PlanView; update: Update }) {
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
            downloadText(
              fileName(record.brief.title, "checklist.csv"),
              "text/csv;charset=utf-8",
              toCsv(checklistRows(view.vendors, dict)),
            );
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
          <Card key={card.category} card={card} city={record.brief.city} update={update} />
        ))}
      </ul>
    </div>
  );
}
