/**
 * Find the transaction ID in a payment message.
 *
 * The text comes from one of two places: read off a screenshot, or
 * pasted straight from the SMS. Either way it is a paragraph, and the
 * cashier wants one code out of it. Mobile money messages in Uganda
 * look roughly like:
 *
 *   MTN    "You have received UGX 50,000 from JOHN (2567...) on 23/11/2026.
 *           ... Financial Transaction Id: 12345678901."
 *   Airtel "TID: MP261123.1401.A77821. You have received UGX 50,000 from ..."
 *   Card   "... RRN: 432118765123  AUTH: 004512 ..."
 *
 * The label is looked for first ("Transaction ID", "TID", "RRN"), then
 * the shape of each network's IDs. Text read off a picture is damaged
 * in predictable ways — "Tran action ld" for "Transaction Id", 8 for B
 * — and what is known about each network's format is used to undo it.
 *
 * Whatever is found goes in the box, never straight to the server. The
 * cashier checks it against the picture, and Accounts checks it again.
 */

const LABELLED = [
  // "Financial Transaction Id: 1234", "Transaction ID 1234", "Trans ID: ..."
  // Tolerant of what the reader does to the label: it has been seen to
  // drop the s ("Tran action") and to read Id as ld or 1d.
  /(?:financial\s+)?tran\s*s?\s*(?:action|\.)?\s*(?:[il1|]d|ref(?:erence)?|no\.?|number|code)\s*[:#.\-]?\s*([A-Z0-9][A-Z0-9.\-]{5,30})/i,
  // "TID: MP261123.1401.A77821" — Airtel's own word for it
  /\bT\.?I\.?D\.?\s*[:#.\-]?\s*([A-Z0-9][A-Z0-9.\-]{5,30})/i,
  // Card slips
  /\bRRN\s*[:#.\-]?\s*([0-9]{6,20})/i,
  /\b(?:txn|trx)\s*(?:id|ref|no)?\s*[:#.\-]?\s*([A-Z0-9][A-Z0-9.\-]{5,30})/i,
  /\bref(?:erence)?\s*(?:no\.?|number|id)?\s*[:#.\-]\s*([A-Z0-9][A-Z0-9.\-]{5,30})/i,
];

// Airtel's unlabelled shape: two letters, date, time, code.
const AIRTEL_SHAPE = /\b([A-Z]{2}\d{6}\.\d{4}\.[A-Z0-9]{5,8})\b/i;

// A digit read where Airtel always prints a letter. B and 8 are the
// pair the reader confuses most; the rest are its other usual swaps.
const DIGIT_AS_LETTER = { 8: 'B', 0: 'D', 5: 'S', 6: 'G', 2: 'Z', 1: 'I', 4: 'A', 7: 'T' };

const toDigits = (x) => x.replace(/O/g, '0').replace(/[IL|]/g, '1');

/** Tidy what a regex caught, using what is known about each network's IDs. */
function clean(raw) {
  let s = String(raw || '').trim().replace(/[.,\-]+$/, '').toUpperCase();

  // Airtel: MP261123.1712.B40019 — two letters, date, time, then one
  // letter and five digits. The date and time cannot hold letters, and
  // the character after the second full stop cannot be a digit.
  const a = s.match(/^([A-Z0-9]{2})([0-9OIL|]{6})\.([0-9OIL|]{4})\.([A-Z0-9])([0-9OIL|]{5})$/);
  if (a) {
    const letter = /\d/.test(a[4]) ? DIGIT_AS_LETTER[a[4]] || a[4] : a[4];
    return `${a[1]}${toDigits(a[2])}.${toDigits(a[3])}.${letter}${toDigits(a[5])}`;
  }

  // MTN and card references are all digits, so a letter in one is the
  // reader confusing O with 0 or I/l with 1.
  if (!s.includes('.')) {
    const digits = (s.match(/\d/g) || []).length;
    if (s.length >= 6 && digits / s.length >= 0.75) s = toDigits(s);
  }
  return s;
}

/** A phone number is the longest digit run in most messages, and never the ID. */
const isPhone = (s) => /^(?:256|0)7\d{8}$/.test(s);

/** The amount the message says was received. The first figure, not the balance. */
function amountIn(text) {
  const m = text.match(/(?:UGX|USH|SHS?)\.?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i);
  if (!m) return null;
  const n = Math.round(Number(m[1].replace(/,/g, '')));
  return Number.isFinite(n) && n >= 100 ? n : null;
}

/**
 * @param {string} text Text from a screenshot or a pasted SMS.
 * @returns {{ ref: string|null, how: 'labelled'|'shape'|null, amount: number|null, network: string|null }}
 */
export function readPaymentText(text) {
  const flat = String(text || '').replace(/\r/g, '').replace(/\s*\n\s*/g, ' ');

  const network = /airtel/i.test(flat) || /\bTID\b/.test(flat) ? 'Airtel Money'
    : /\b(?:mtn|momo)\b/i.test(flat) || /financial\s+tran/i.test(flat) ? 'MTN MoMo'
      : null;
  const amount = amountIn(flat);

  for (const re of LABELLED) {
    const m = flat.match(re);
    if (m) {
      const ref = clean(m[1]);
      if (ref.length >= 6 && !isPhone(ref)) return { ref, how: 'labelled', amount, network };
    }
  }

  const shaped = flat.match(AIRTEL_SHAPE);
  if (shaped) return { ref: clean(shaped[1]), how: 'shape', amount, network };

  // No label survived. MTN's ID is a long run of digits on its own —
  // not a phone number, not an amount (those carry commas), not a date
  // (slashes). The longest is taken, marked as a guess.
  const runs = [...flat.matchAll(/(?<![\d,./])(\d{9,13})(?![\d,/])/g)]
    .map((m) => m[1])
    .filter((n) => !isPhone(n));
  if (runs.length) {
    const longest = runs.reduce((best, n) => (n.length >= best.length ? n : best), '');
    return { ref: longest, how: 'shape', amount, network };
  }

  return { ref: null, how: null, amount, network };
}

/** The same spelling the server stores, so the duplicate check sees what it will. */
export const normaliseRef = (s) => String(s || '').replace(/\s+/g, '').toUpperCase();
