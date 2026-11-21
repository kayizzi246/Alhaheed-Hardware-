'use client';
import { useEffect } from 'react';

export function Stat({ label, value, tone }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className={`value ${tone || ''}`}>{value}</div>
    </div>
  );
}

export function Card({ title, action, children }) {
  return (
    <section className="card">
      {(title || action) && (
        <div className="card-head">
          <span>{title}</span>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Chip({ status, children }) {
  const tone =
    { pending_payment: 'pending', paid: 'paid', payment_verified: 'verified',
      released: 'done', cancelled: 'grey', rejected: 'rejected', refunded: 'grey' }[status] || 'grey';
  return <span className={`chip ${tone}`}>{children}</span>;
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}

export function Alert({ kind = 'error', children, onDone }) {
  useEffect(() => {
    if (kind === 'ok' && onDone) {
      const t = setTimeout(onDone, 4000);
      return () => clearTimeout(t);
    }
  }, [kind, onDone]);
  if (!children) return null;
  return <div className={`alert ${kind}`}>{children}</div>;
}

/**
 * A modal.
 *
 * `open` defaults to true so the older call sites, which decide by
 * rendering it or not, keep working. Passing `open={false}` closes it —
 * without that, a page that sets its state to closed and leaves the
 * element rendered has a dialog that cannot be dismissed, which is
 * exactly what happened to the cancel-order box.
 */
export function Modal({ open = true, title, onClose, children, footer }) {
  useEffect(() => {
    if (!open) return;
    const esc = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open, onClose]);

  // The page behind must not scroll under an open dialog.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">{title}</div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
