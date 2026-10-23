"use client";

import { mapsSearchUrl } from "@/lib/export/links";
import { format } from "@/lib/i18n/format";
import { langOf } from "@/lib/i18n/lang";
import { LIMITS, VENDOR_STATUSES } from "@/lib/plan/constants";
import { setVendor } from "@/lib/plan/record";
import type { VendorProgress } from "@/lib/plan/schema";
import type { VendorCard } from "@/lib/plan/vendors";
import { useLocale, useMoney } from "@/components/locale-provider";
import type { Update } from "@/components/planner/types";
import { SelectField } from "@/components/ui/select-field";
import { Template } from "@/components/ui/template";
import { TextArea } from "@/components/ui/text-area";
import { VendorAmountField } from "./vendor-amount-field";

interface QuestionsProps {
  title: string;
  vendor: string;
  items: readonly string[];
}

/** A list of questions; its heading names the vendor too, since every card repeats it. */
function Questions({ title, vendor, items }: Readonly<QuestionsProps>) {
  const { locale } = useLocale();
  if (items.length === 0) return null;
  return (
    <>
      <h3 className="subhead">
        {title}
        <span className="visually-hidden">, {vendor}</span>
      </h3>
      <ul className="plain-list">
        {items.map((question) => (
          <li key={question} lang={langOf(question, locale)}>
            {question}
          </li>
        ))}
      </ul>
    </>
  );
}

/** A field label that also names the vendor for screen readers, since every card repeats it. */
function VendorLabel({ text, vendor }: Readonly<{ text: string; vendor: string }>) {
  return (
    <>
      {text}
      <span className="visually-hidden">, {vendor}</span>
    </>
  );
}

/** A Maps search for this kind of vendor in the event's city; the English phrase keeps its own lang. */
function MapsSearchLink({ phrase, city }: Readonly<{ phrase: string; city: string }>) {
  const { dict, locale } = useLocale();
  return (
    <a
      className="btn btn-small btn-quiet"
      href={mapsSearchUrl(phrase, city)}
      target="_blank"
      rel="noopener noreferrer"
    >
      <Template
        text={dict.vendors.find}
        values={{ phrase: <span lang={langOf(phrase, locale)}>{phrase}</span>, city }}
      />{" "}
      <span className="visually-hidden">{dict.common.opensNewTab}</span>
    </a>
  );
}

interface VendorEntryProps {
  card: VendorCard;
  city: string;
  update: Update;
}

/** One vendor: its status, agreed price, payments, notes, questions to ask and a Maps search. */
export function VendorEntry({ card, city, update }: Readonly<VendorEntryProps>) {
  const { dict } = useLocale();
  const money = useMoney();
  const name = dict.categories[card.category];
  const id = `vendor-${card.category}`;
  const save = (patch: Partial<VendorProgress>) => {
    update((record, now) => setVendor(record, card.category, { ...card.progress, ...patch }, now));
  };

  return (
    <li className="vendor">
      <details>
        <summary>
          <span className="vendor-name">{name}</span>
          <span className="tag">{dict.vendors.statuses[card.progress.status]}</span>
          <span className="hint">
            {format(dict.vendors.planned, { amount: money(card.planned) })}
          </span>
        </summary>
        <div className="vendor-body">
          <div className="form-row">
            <SelectField
              id={`${id}-status`}
              label={format(dict.vendors.statusLabel, { category: name })}
              value={card.progress.status}
              options={VENDOR_STATUSES.map((status) => ({
                value: status,
                label: dict.vendors.statuses[status],
              }))}
              onValueChange={(status) => {
                save({ status });
              }}
            />
            <VendorAmountField
              id={`${id}-quote`}
              label={<VendorLabel text={dict.vendors.agreed} vendor={name} />}
              value={card.progress.quote}
              onAmountChange={(quote) => {
                save({ quote });
              }}
            />
            <VendorAmountField
              id={`${id}-paid`}
              label={<VendorLabel text={dict.vendors.paid} vendor={name} />}
              value={card.progress.paid}
              onAmountChange={(paid) => {
                save({ paid });
              }}
            />
          </div>
          <TextArea
            id={`${id}-note`}
            label={<VendorLabel text={dict.vendors.note} vendor={name} />}
            hint={dict.vendors.noteHint}
            rows={2}
            maxLength={LIMITS.vendorNoteMax}
            value={card.progress.note}
            onChange={(event) => {
              save({ note: event.target.value.slice(0, LIMITS.vendorNoteMax) });
            }}
          />
          <Questions
            title={dict.vendors.ask}
            vendor={name}
            items={dict.vendors.questions[card.category]}
          />
          <Questions title={dict.vendors.aiAsk} vendor={name} items={card.aiQuestions} />
          <MapsSearchLink phrase={card.search} city={city} />
        </div>
      </details>
    </li>
  );
}
