'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { money, today } from '@/lib/format';
import {
  Alert, Button, Card, CardHead, CardTitle, Input, Loading,
  PageHead, Stat, Stats, Table, TableWrap, Td, Tr,
} from '@/components/ui';
import { Icon } from '@/components/icons';
import { Field, Textarea } from '@/components/ui';

/** What this cashier took in today, for handing over the till. */
export default function EndOfDayPage() {
  const [date, setDate] = useState(today());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  // Today's cash stays hidden until the drawer is counted.
  const [closed, setClosed] = useState(null);
  const blind = date === today() && closed === false;

  useEffect(() => {
    setData(null);
    api(`/api/cashier/end-of-day?date=${date}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [date]);

  return (
    <>
      <PageHead title="End of day" sub="Count the cash, then hand over.">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="tnum w-[170px]"
        />
      </PageHead>

      <Alert>{error}</Alert>

      {!data && !error && <Loading>Adding up the day…</Loading>}

      {data && (
        <>
          <Stats>
            <Stat label="Receipts issued" value={data.receipts} icon={Icon.receipt()} />
            <Stat label="Total collected" value={blind ? 'After closing' : money(data.total)} lead icon={Icon.cash()} />
            <Stat label="Cash" value={blind ? 'Count first' : money(data.cash)} tone="ok" icon={Icon.cash()} />
            <Stat label="Mobile Money" value={money(data.mobile_money)} icon={Icon.phone()} />
          </Stats>

          <Card className="mb-4">
            <CardHead><CardTitle>Hand-over summary</CardTitle></CardHead>
            <TableWrap>
              <Table>
                <tbody>
                  <Tr><Td>Cashier</Td><Td num>{data.cashier}</Td></Tr>
                  <Tr><Td>Date</Td><Td num>{data.date}</Td></Tr>
                  <Tr>
                    <Td className="font-medium text-ink">Cash in the till</Td>
                    <Td num className="font-bold text-ink">{blind ? 'Shown after you count' : money(data.cash)}</Td>
                  </Tr>
                  <Tr><Td>Mobile Money</Td><Td num>{money(data.mobile_money)}</Td></Tr>
                  <Tr><Td>Card</Td><Td num>{money(data.card)}</Td></Tr>
                  <tr className="bg-surface-2">
                    <Td className="font-bold text-ink">Total</Td>
                    <Td num className="font-display text-[15px] font-extrabold text-ink">{blind ? '' : money(data.total)}</Td>
                  </tr>
                </tbody>
              </Table>
            </TableWrap>
          </Card>

          {date === today() && <CloseTill onState={setClosed} />}
        </>
      )}
    </>
  );
}

/**
 * Count the drawer and close the day. The figure the book expects is
 * shown only after the count is entered: seeing it first makes it too
 * easy to count to it. A close cannot be changed.
 */
function CloseTill({ onState }) {
  const [state, setState] = useState(null);
  const [counted, setCounted] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/api/cashier/close').then((r) => { setState(r); onState?.(!!r.close); }).catch((e) => setError(e.message));
  }, [onState]);

  async function close() {
    setBusy(true);
    setError('');
    try {
      const r = await api('/api/cashier/close', { method: 'POST', body: { counted: Number(counted), note } });
      setState({ ...state, close: r.close, expected: r.expected });
      onState?.(true);
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  if (!state) return null;
  const c = state.close;
  return (
    <Card>
      <CardHead><CardTitle>Count the cash</CardTitle></CardHead>
      <div className="space-y-4 p-4 sm:p-6">
        <Alert>{error}</Alert>
        {c ? (
          <div className={`rounded-sm border px-4 py-3 text-[14px] ${c.overShort < 0 ? 'border-bad/25 bg-bad-bg text-bad' : c.overShort > 0 ? 'border-warn/30 bg-warn-bg text-warn' : 'border-ok/25 bg-ok-bg text-ok'}`}>
            <b>Closed.</b> Counted {money(c.counted)} against {money(c.expected)} expected:{' '}
            {c.overShort === 0 ? 'exact.' : c.overShort < 0 ? `short by ${money(-c.overShort)}.` : `over by ${money(c.overShort)}.`}
            {c.note && <span className="block text-[13px] text-ink-2">&ldquo;{c.note}&rdquo;</span>}
          </div>
        ) : (
          <>
            <p className="text-[13.5px] text-ink-2">Count all the cash in the drawer. Type the total. You cannot change it later.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cash in the drawer (UGX)">
                <Input type="number" inputMode="numeric" min="0" value={counted} onChange={(e) => setCounted(e.target.value)} className="tnum text-lg font-semibold" />
              </Field>
              <Field label="Note" hint="Needed if the cash is not right.">
                <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
            </div>
            <Button disabled={busy || counted === ''} onClick={close}>{busy ? 'Saving…' : 'Save the count'}</Button>
          </>
        )}
      </div>
    </Card>
  );
}
