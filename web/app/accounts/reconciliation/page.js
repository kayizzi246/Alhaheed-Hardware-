'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { money, today, methodLabel, list } from '@/lib/format';
import {
  Alert, Card, CardBody, CardHead, CardTitle, Empty, Input, Loading,
  PageHead, Stat, Stats, Table, TableWrap, Td, Th, Tr,
} from '@/components/ui';
import { Icon } from '@/components/icons';

/** What was collected, against what the cash book shows. */
export default function ReconciliationPage() {
  const [date, setDate] = useState(today());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    api(`/api/accounts/reconciliation?date=${date}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [date]);

  const methods = list(data?.byMethod);
  const sum = (k) => methods.reduce((s, m) => s + (m[k] || 0), 0);
  const collected = sum('collected');
  const verified = sum('verified');
  const pending = sum('pending');

  return (
    <>
      <PageHead title="Reconciliation" sub="Payments taken against the cash book, for one day.">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="tnum w-[170px]"
        />
      </PageHead>

      <Alert>{error}</Alert>

      {!data && !error && <Loading>Reconciling…</Loading>}

      {data && (
        <>
          <Stats>
            <Stat label="Collected" value={money(collected)} icon={Icon.cash()} />
            <Stat label="Verified" value={money(verified)} tone="ok" icon={Icon.check()} />
            <Stat label="Still pending" value={money(pending)} icon={Icon.clock()} tone={pending ? 'warn' : 'ok'} />
            <Stat
              label="Cash book difference"
              value={money(Math.abs(data.difference))}
              tone={data.difference === 0 ? 'ok' : 'bad'}
              note={data.difference === 0 ? 'balanced' : 'needs a look'}
            />
          </Stats>

          <Card className="mb-4">
            <CardHead><CardTitle>By payment method</CardTitle></CardHead>
            {methods.length === 0 ? (
              <Empty title="No payments on this date">Pick another day.</Empty>
            ) : (
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>Method</Th><Th num>Receipts</Th><Th num>Collected</Th>
                      <Th num>Verified</Th><Th num>Pending</Th><Th num>Rejected</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {methods.map((m) => (
                      <Tr key={m.method}>
                        <Td className="font-medium text-ink">{methodLabel(m.method)}</Td>
                        <Td num>{m.count}</Td>
                        <Td num className="font-semibold text-ink">{money(m.collected)}</Td>
                        <Td num className="text-ok">{money(m.verified)}</Td>
                        <Td num>{money(m.pending)}</Td>
                        <Td num className={m.rejected ? 'text-bad' : 'text-ink-faint'}>{money(m.rejected)}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </Card>

          <Card>
            <CardHead><CardTitle>Against the cash book</CardTitle></CardHead>
            <TableWrap>
              <Table>
                <tbody>
                  <Tr><Td>Verified payments</Td><Td num>{money(verified)}</Td></Tr>
                  <Tr><Td>Cash book: cash in</Td><Td num>{money(data.cashBook.cash_in)}</Td></Tr>
                  <Tr><Td>Cash book: cash out</Td><Td num>{money(data.cashBook.cash_out)}</Td></Tr>
                  <tr className="bg-surface-2">
                    <Td className="font-bold text-ink">Difference</Td>
                    <Td num className={data.difference === 0 ? 'font-bold text-ok' : 'font-bold text-bad'}>
                      {money(data.difference)}
                    </Td>
                  </tr>
                </tbody>
              </Table>
            </TableWrap>

            {data.difference !== 0 && (
              <CardBody className="border-t border-line pt-4 text-[11.5px] leading-relaxed text-ink-muted">
                A difference here usually means a manual cash book entry, an opening balance
                or an expense, that is not tied to a customer payment. Check the cash book
                for the day.
              </CardBody>
            )}
          </Card>
        </>
      )}
    </>
  );
}
