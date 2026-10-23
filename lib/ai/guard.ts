import type { Locale } from "@/lib/plan/constants";

/**
 * A deterministic screen for text that talks to the assistant instead of
 * about the event. The system prompt already says fenced text is data, but a
 * prompt is a request, not a boundary; these checks are plain patterns, so
 * nothing in the text can argue them out of a decision.
 */

/** A non-capturing group of alternatives, so each pattern below reads as its words. */
function alternation(...words: string[]): string {
  return `(?:${words.join("|")})`;
}

const ADDRESSED = alternation(
  "all",
  "any",
  "every",
  "the",
  "your",
  "my",
  "these",
  "those",
  "previous",
);
const EARLIER = alternation("prior", "above", "earlier", "preceding", "original", "system");
const RULES = alternation("instructions?", "prompts?", "rules?", "guidelines?", "directions?");
const HINDI_RULES = alternation("निर्देश", "नियम", "आदेश", "हिदायत");

/** Phrases aimed at the assistant's instructions, in English, Hindi and romanised Hindi. */
const INJECTION_PATTERNS: readonly RegExp[] = [
  new RegExp(
    String.raw`\b${alternation("ignore", "forget", "disregard", "override", "bypass")}(?:\s+${alternation(ADDRESSED, EARLIER)}){1,4}\s+${RULES}\b`,
    "i",
  ),
  new RegExp(
    String.raw`\b${alternation("reveal", "print", "show", "repeat", "output", "tell")}(?:\s+me)?\s+${alternation("your", "the")}\s+${alternation("system", "hidden", "initial", "original")}\s+${RULES}`,
    "i",
  ),
  /\bsystem\s+prompt\b|\bjailbreak|\bdeveloper\s+mode\b|\bDAN\s+mode\b/i,
  /\b(?:you are now|from now on,? you (?:are|will))\b/i,
  /\b(?:act|behave)\s+as\s+(?:an?\s+)?(?:unrestricted|unfiltered|different|new)\s+(?:ai|assistant|model|chatbot)\b/i,
  /\b(?:instructions?|rules?|prompts?)\s+(?:ko\s+)?(?:ignore|bhool|bhul)\b/i,
  new RegExp(
    String.raw`${alternation("पिछले", "पहले", "ऊपर", "सारे", "सभी", "अपने")}(?:\s+${alternation("के", "सारे", "सभी")})?\s+${HINDI_RULES}(?:ों)?\s+(?:को\s+)?${alternation("भूल", "अनदेखा", "नज़रअंदाज़", "नजरअंदाज", "छोड़")}`,
  ),
  /सिस्टम\s+(?:प्रॉम्प्ट|प्रोम्प्ट|निर्देश)/,
  new RegExp(
    String.raw`${alternation("अपने", "अपना", "तुम्हारे", "आपके")}\s+${alternation(HINDI_RULES, "प्रॉम्प्ट", "प्रोम्प्ट")}\s+${alternation("बताओ", "बताइए", "बताएँ", "दिखाओ", "दिखाइए", "लिखो")}`,
  ),
];

/** Invisible format characters could split a keyword, so they are ignored while checking. */
const FORMAT_CHARACTERS = /\p{Cf}/gu;

/**
 * Whether the text tries to change the assistant's instructions rather than
 * describe the event. NFC matches the patterns, which are written in NFC, so a
 * precomposed nukta letter such as ज़ is still recognised.
 */
export function isInjectionAttempt(text: string): boolean {
  const plain = text.normalize("NFC").replace(FORMAT_CHARACTERS, "").replace(/\s+/g, " ");
  return INJECTION_PATTERNS.some((pattern) => pattern.test(plain));
}

const SENTENCE_END = /(?<=[.!?।\n])/u;

/** The text without its sentences that address the assistant; the rest still reaches the model. */
export function dropInjections(text: string): string {
  if (!isInjectionAttempt(text)) return text;
  return text
    .split(SENTENCE_END)
    .filter((sentence) => !isInjectionAttempt(sentence))
    .join("")
    .trim();
}

/** The refine reply when the message tries to re-instruct the assistant; no model is called. */
export const SCREENED_REPLY: Record<Locale, string> = {
  en: "I can only help with this plan. Ask about the budget, guests, date, tasks or ideas.",
  hi: "यहाँ सिर्फ़ इसी आयोजन की योजना पर बात हो सकती है। बजट, मेहमान, तारीख, काम या आइडिया के बारे में पूछिए।",
};
