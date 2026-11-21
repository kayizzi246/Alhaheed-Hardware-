'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { money, today } from '@/lib/format';
import {
  Alert, Button, Card, CardHead, CardTitle, Input, Loading,
  PageHead, Stat, Stats, Table, TableWrap, Td, Tr,
} from '@/components/ui';

/** What this cashier took in today, for handing over the till. */
export default function EndOfDayPage() {
  const [date, setDate] = useState(today());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    api(`/api/cashier/end-of-day?date=${date}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [date]);

  return (
    <>
      <PageHead title="End of day" sub="Count the drawer against this before you hand over.">
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
            <Stat label="Receipts issued" value={data.receipts} />
            <Stat label="Total collected" value={money(data.total)} lead />
            <Stat label="Cash" value={money(data.cash)} tone="ok" />
            <Stat label="Mobile Money" value={money(data.mobile_money)} />
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
                    <Td num className="font-bold text-ink">{money(data.cash)}</Td>
                  </Tr>
                  <Tr><Td>Mobile Money</Td><Td num>{money(data.mobile_money)}</Td></Tr>
                  <Tr><Td>Card</Td><Td num>{money(data.card)}</Td></Tr>
                  <tr className="bg-surface-2">
                    <Td className="font-bold text-ink">Total</Td>
                    <Td num className="font-display text-[15px] font-extrabold text-ink">{money(data.total)}</Td>
                  </tr>
                </tbody>
              </Table>
            </TableWrap>
          </Card>

          <Button className="print:hidden" onClick={() => window.print()}>
            Print hand-over sheet
          </Button>
        </>
      )}
    </>
  );
}
