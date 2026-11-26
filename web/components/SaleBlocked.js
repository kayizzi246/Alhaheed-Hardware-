'use client';

import { useState } from 'react';
import { Button, Textarea } from '@/components/ui';

/**
 * A sale the stock rules stopped: selling more than the book holds, or
 * below the latest buy price. Says exactly what, and lets a manager
 * override with a reason, which is kept with the order. Anyone else is
 * told to fetch the manager.
 */
export default function SaleBlocked({ error, busy, onOverride, onCancel }) {
  const [reason, setReason] = useState('');
  const problems = (error?.data?.problems || []);
  const can = !!error?.data?.canOverride;

  return (
    <div className="space-y-3 rounded-sm border border-bad/25 bg-bad-bg px-3.5 py-3 text-[12.5px]">
      <p className="font-semibold text-bad">This sale needs the manager.</p>
      <ul className="space-y-1.5 text-ink">
        {problems.length ? problems.map((p, i) => (
          <li key={i}>
            <b>{p.name}</b>: {p.rule === 'negative_stock' ? 'not enough in stock' : 'below cost'}
            <span className="block text-[12px] text-ink-2">{p.detail}</span>
          </li>
        )) : <li>{error?.message}</li>}
      </ul>
      {can ? (
        <>
          <Textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why it is allowed. Kept with the order, under your name."
            aria-label="Reason for overriding"
          />
          <div className="flex flex-wrap justify-end gap-2">
            {onCancel && <Button variant="outline" size="sm" onClick={onCancel}>Change the sale</Button>}
            <Button size="sm" variant="danger" disabled={busy || reason.trim().length < 5} onClick={() => onOverride(reason.trim())}>
              {busy ? 'Saving…' : 'Override and sell'}
            </Button>
          </div>
        </>
      ) : (
        <p className="text-[12px] text-ink-2">Only the manager can override this. Change the sale, or ask the manager to sell it from their login.</p>
      )}
    </div>
  );
}
