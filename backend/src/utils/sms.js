/**
 * The SMS gateway.
 *
 * One `sendSms()` for the whole system, with the provider chosen by
 * environment variable so nothing in the application code knows or cares
 * which company is carrying the message.
 *
 * Providers:
 *   log            - writes to the server console. The default, and what
 *                    development uses: no account, no credit, no cost.
 *   africastalking - Africa's Talking, the usual choice in Uganda.
 *   generic        - any gateway that accepts a JSON POST. Set SMS_URL.
 *
 * A failure to send is never allowed to crash a request. The caller gets
 * `{ ok: false, error }` and decides; for a login code that means the
 * customer is told plainly that the code could not be sent, rather than
 * being left watching a spinner.
 */

import { config } from '../config.js';

/** Uganda: 0772123456 and 772123456 both mean +256772123456. */
export function normalisePhone(raw) {
  const digits = String(raw || '').replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('256')) return `+${digits}`;
  if (digits.startsWith('0')) return `+256${digits.slice(1)}`;
  if (digits.length === 9) return `+256${digits}`;
  return digits;
}

async function sendViaAfricasTalking(to, message) {
  const body = new URLSearchParams({
    username: config.sms.username,
    to,
    message,
    ...(config.sms.senderId ? { from: config.sms.senderId } : {}),
  });

  const res = await fetch(
    'https://api.africastalking.com/version1/messaging',
    {
      method: 'POST',
      headers: {
        apiKey: config.sms.apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
    }
  );

  const text = await res.text();
  if (!res.ok) throw new Error(`Africa's Talking returned ${res.status}: ${text}`);

  // The gateway answers 201 even when it refused the individual number,
  // so the per-recipient status is what actually has to be read.
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error(`Unreadable reply: ${text}`); }
  const recipients = parsed?.SMSMessageData?.Recipients ?? [];
  const first = recipients[0];
  if (!first) throw new Error(parsed?.SMSMessageData?.Message || 'The gateway accepted no recipients');
  if (!/success/i.test(first.status)) throw new Error(`${first.status} for ${first.number}`);
  return { id: first.messageId, cost: first.cost };
}

async function sendViaGeneric(to, message) {
  const res = await fetch(config.sms.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(config.sms.apiKey ? { Authorization: `Bearer ${config.sms.apiKey}` } : {}),
    },
    body: JSON.stringify({
      to,
      message,
      ...(config.sms.senderId ? { from: config.sms.senderId } : {}),
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`The gateway returned ${res.status}: ${text}`);
  return { id: null, cost: null };
}

/**
 * Send one message.
 *
 * Never throws. Returns `{ ok, provider, to, id?, cost?, error? }`.
 */
export async function sendSms(rawPhone, message) {
  const to = normalisePhone(rawPhone);
  const provider = config.sms.provider;

  if (provider === 'log') {
    // Deliberately loud: in development the code has to be findable, and
    // a silent no-op gateway is the kind of thing nobody notices until
    // it is in production.
    console.log(`\n  ── SMS (not sent — provider is "log") ──\n  to: ${to}\n  ${message}\n`);
    return { ok: true, provider, to, id: null, cost: null };
  }

  try {
    if (provider === 'africastalking') {
      if (!config.sms.apiKey || !config.sms.username) {
        throw new Error('SMS_API_KEY and SMS_USERNAME are not set');
      }
      const r = await sendViaAfricasTalking(to, message);
      return { ok: true, provider, to, ...r };
    }

    if (provider === 'generic') {
      if (!config.sms.url) throw new Error('SMS_URL is not set');
      const r = await sendViaGeneric(to, message);
      return { ok: true, provider, to, ...r };
    }

    throw new Error(`Unknown SMS_PROVIDER "${provider}"`);
  } catch (e) {
    console.error(`  SMS to ${to} failed: ${e.message}`);
    return { ok: false, provider, to, error: e.message };
  }
}

/** The login code, worded the same way every time it goes out. */
export const otpMessage = (code) =>
  `${code} is your ${config.shopName} code. It expires in 5 minutes. ` +
  `Do not share it with anyone.`;

/**
 * The confirmation that goes out the moment an order is placed.
 *
 * It carries the order number and the amount, because those are the two
 * things someone standing at the counter is asked for, and a text is
 * easier to find than an app screen.
 */
export const orderPlacedMessage = (order) => {
  const total = `${config.currency} ${Number(order.total || 0).toLocaleString('en-US')}`;
  const how = order.fulfilment === 'delivery'
    ? 'We will deliver once payment is confirmed.'
    : 'Collect at the shop once payment is confirmed.';
  return `${config.shopName}: order ${order.order_no} received, ${total}. ` +
    `Pay at the cashier and quote ${order.order_no}. ${how}`;
};
