export const money = (n) => `UGX ${Number(n || 0).toLocaleString('en-UG')}`;

export const shortMoney = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `UGX ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `UGX ${(v / 1_000).toFixed(0)}K`;
  return `UGX ${v}`;
};

const parse = (iso) =>
  iso ? new Date(iso.replace(' ', 'T') + (iso.endsWith('Z') ? '' : 'Z')) : null;

export const time = (iso) =>
  parse(iso)?.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) || '';

export const dateTime = (iso) =>
  parse(iso)?.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }) || '';

export const methodLabel = (m) =>
  ({ cash: 'Cash', mobile_money: 'Mobile Money', card: 'Card' })[m] || m;

export const statusLabel = (s) =>
  ({
    pending_payment: 'Pending Payment',
    paid: 'Paid',
    payment_verified: 'Verifying',
    released: 'Completed',
    cancelled: 'Cancelled',
    rejected: 'Rejected',
    refunded: 'Refunded',
  })[s] || s;

export const statusTone = (s) =>
  ({
    pending_payment: 'pending',
    paid: 'blue',
    payment_verified: 'blue',
    released: 'green',
    cancelled: 'grey',
    rejected: 'red',
    refunded: 'grey',
  })[s] || 'grey';
