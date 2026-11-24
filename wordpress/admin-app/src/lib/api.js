/**
 * Talking to the plugin.
 *
 * Inside wp-admin the person is already signed in, so there is no
 * token: the cookie carries the session and the REST nonce proves the
 * request came from our page. WordPress hands both to us through
 * `window.AH_BOOT`, printed by the plugin.
 *
 * Errors come back as `{ error: "in plain words" }` and are thrown with
 * that wording, because the server's sentence is better than anything
 * this layer could invent.
 */
const boot = window.AH_BOOT || {};

export const CONFIG = {
  root: boot.root || '/wp-json/alhadeed/v1',
  nonce: boot.nonce || '',
  user: boot.user || { name: '', desk: 'cashier', canSee: [] },
  shop: boot.shop || { name: 'Al Hadeed Hardware', currency: 'UGX' },
  desks: boot.desks || {},
  links: boot.links || {},
};

export async function api(path, { method = 'GET', body, signal } = {}) {
  const res = await fetch(CONFIG.root + path, {
    method,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-WP-Nonce': CONFIG.nonce,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  let data = null;
  try { data = await res.json(); } catch { /* an empty body is fine */ }

  if (!res.ok) {
    throw new Error((data && (data.error || data.message)) || `Request failed (${res.status})`);
  }
  return data;
}

/**
 * Send a file. Separate from api() because multipart must be left to
 * the browser, which adds the boundary marker — set Content-Type by
 * hand and the server cannot read the body.
 */
export async function upload(path, formData) {
  const res = await fetch(CONFIG.root + path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'X-WP-Nonce': CONFIG.nonce },
    body: formData,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) throw new Error((data && (data.error || data.message)) || `Upload failed (${res.status})`);
  return data;
}

/** A picture behind the desk's session, as an object URL the caller must revoke. */
export async function blobUrl(path) {
  const res = await fetch(CONFIG.root + path, {
    credentials: 'same-origin',
    headers: { 'X-WP-Nonce': CONFIG.nonce },
  });
  if (!res.ok) throw new Error(res.status === 404 ? 'The picture is missing.' : 'The picture could not be loaded.');
  return URL.createObjectURL(await res.blob());
}

export const money = (n) =>
  `${CONFIG.shop.currency} ${Number(n || 0).toLocaleString('en-US')}`;

export const shortMoney = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `${CONFIG.shop.currency} ${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`;
  if (v >= 1_000) return `${CONFIG.shop.currency} ${Math.round(v / 1_000)}K`;
  return `${CONFIG.shop.currency} ${v}`;
};

/** "14:31" from the API's "2026-11-21 14:31:02". */
export const at = (stamp) => (stamp && stamp.length >= 16 ? stamp.slice(11, 16) : '');

export const dayMonth = (stamp) => {
  if (!stamp || stamp.length < 10) return '';
  const d = new Date(stamp.replace(' ', 'T'));
  return Number.isNaN(d.getTime())
    ? stamp.slice(0, 10)
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

export const methodLabel = (m) =>
  ({ cash: 'Cash', mobile_money: 'Mobile Money', mtn_momo: 'MTN Mobile Money', airtel_money: 'Airtel Money', bank: 'Bank transfer', cheque: 'Cheque', card: 'Card' }[m] || m || '');
