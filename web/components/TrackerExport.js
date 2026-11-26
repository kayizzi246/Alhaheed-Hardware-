'use client';

import { useState } from 'react';
import { Alert, Button, Field, Input, Modal } from '@/components/ui';

const iso = (d) => d.toISOString().slice(0, 10);

/**
 * The "ALH Tracker" Excel file: the same four sheets, columns and green
 * headings as the workbook the shop kept before this system.
 */
export function TrackerExport() {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const [from, setFrom] = useState(iso(new Date(Date.UTC(now.getFullYear(), 0, 1))));
  const [to, setTo] = useState(iso(now));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  async function go() {
    setBusy(true);
    setError('');
    setDone('');
    try {
      const { exportTracker } = await import('@/lib/exports');
      setDone(`Saved ${await exportTracker({ from, to })}`);
    } catch (e) {
      setError(/no route/i.test(e.message) ? 'This needs the new plugin. Upload the zip to the website first.' : e.message);
    }
    setBusy(false);
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Tracker file</Button>
      {open && (
        <Modal
          title="Download the tracker file"
          description="Purchase, Sell Detail, Balance Material Final and Code: the same sheets as ALH Tracker."
          onClose={() => setOpen(false)}
          footer={
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
              <Button disabled={busy || !from || !to || from > to} onClick={go}>{busy ? 'Making it…' : 'Download'}</Button>
            </>
          }
        >
          <div className="space-y-4">
            <Alert>{error}</Alert>
            {done && <Alert kind="ok">{done}</Alert>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="From">
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </Field>
              <Field label="To">
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </Field>
            </div>
            <p className="text-[12.5px] text-ink-muted">
              Purchases and sales are for these dates. The stock and price sheets are as they are today.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
