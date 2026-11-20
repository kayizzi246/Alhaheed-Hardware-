import { config } from '../config.js';

/** 2485000 -> "UGX 2,485,000" */
export function formatMoney(amount) {
  return `${config.currency} ${Number(amount || 0).toLocaleString('en-UG')}`;
}

/** Guard against floats and negatives sneaking into money columns. */
export function toAmount(value, label = 'amount') {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid ${label}`);
  return n;
}
