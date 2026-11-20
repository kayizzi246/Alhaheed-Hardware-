export const money = (n) => `UGX ${Number(n || 0).toLocaleString('en-UG')}`;

export const shortMoney = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `UGX ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `UGX ${(v / 1_000).toFixed(0)}K`;
  return `UGX ${v}`;
};

export const time = (iso) => {
  if (!iso) return '';
  const d = new Date(iso.replace(' ', 'T') + (iso.endsWith('Z') ? '' : 'Z'));
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

export const dateTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso.replace(' ', 'T') + (iso.endsWith('Z') ? '' : 'Z'));
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export const today = () => new Date().toISOString().slice(0, 10);

export const methodLabel = (m) =>
  ({ cash: 'Cash', mobile_money: 'Mobile Money', card: 'Card' })[m] || m;

export const statusLabel = (s) =>
  ({
    pending_payment: 'Pending',
    paid: 'Paid',
    payment_verified: 'Verified',
    released: 'Completed',
    cancelled: 'Cancelled',
    rejected: 'Rejected',
    refunded: 'Refunded',
  })[s] || s;
