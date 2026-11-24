'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, peek } from '@/lib/api';
import { dateTime, list } from '@/lib/format';
import {
  Alert, Card, Empty, Loading, PageHead, Select,
  Table, TableWrap, Td, Th, Tr, LoadFailed } from '@/components/ui';

const ACTION_LABEL = {
  placed: 'Order placed',
  payment_received: 'Payment taken',
  verified: 'Payment verified',
  rejected: 'Payment rejected',
  released: 'Goods released',
  cancelled: 'Order cancelled',
  refunded: 'Refunded',
  data_exported: 'Data exported',
  account_deleted: 'Customer deleted their account',
};

/**
 * Every move anybody made, newest first.
 *
 * This is the answer to "who did that, and when" — the question that
 * only gets asked when something has gone wrong, and the one a shop
 * cannot answer from memory.
 */
export default function ManagerAudit() {
  const [events, setEvents] = useState(() => {
    const r = peek('/api/manager/audit?limit=300');
    return r ? list(r.events) : null;
  });
  const [who, setWho] = useState('all');
  const [what, setWhat] = useState('all');
  const [error, setError] = useState('');

  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    api('/api/manager/audit?limit=300')
      .then((r) => { setEvents(list(r.events)); setError(''); })
      .catch((e) => setError(e.message));
  }, [attempt]);

  const people = useMemo(
    () => [...new Set((events || []).map((e) => e.handler_name).filter(Boolean))],
    [events]
  );
  const actions = useMemo(
    () => [...new Set((events || []).map((e) => e.action))],
    [events]
  );

  const shown = (events || []).filter(
    (e) => (who === 'all' || e.handler_name === who) && (what === 'all' || e.action === what)
  );

  return (
    <>
      <PageHead title="Audit trail" sub={`${shown.length} of the most recent 300 events`}>
        <Select value={who} onChange={(e) => setWho(e.target.value)} className="w-[180px]">
          <option value="all">Everyone</option>
          {people.map((p) => <option key={p} value={p}>{p}</option>)}
        </Select>
        <Select value={what} onChange={(e) => setWhat(e.target.value)} className="w-[180px]">
          <option value="all">Every action</option>
          {actions.map((a) => (
            <option key={a} value={a}>{ACTION_LABEL[a] || a}</option>
          ))}
        </Select>
      </PageHead>

      <Alert>{error}</Alert>

      <Card>
        {!events ? (
          error ? <LoadFailed onRetry={() => setAttempt((n) => n + 1)}>{error}</LoadFailed> : <Loading>Loading the trail…</Loading>
        ) : shown.length === 0 ? (
          <Empty title="Nothing recorded for that filter">
            Try a different person or action.
          </Empty>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>When</Th><Th>Order</Th><Th>Desk</Th>
                  <Th>What happened</Th><Th>Who</Th><Th>Notes</Th>
                </tr>
              </thead>
              <tbody>
                {shown.map((e) => (
                  <Tr key={e.id}>
                    <Td className="tnum whitespace-nowrap text-ink-muted">{dateTime(e.created_at)}</Td>
                    <Td className="tnum">
                      {e.order_no ? (
                        <Link
                          href={`/manager/orders/${e.order_id}`}
                          className="font-bold text-brand-dark underline-offset-2 hover:underline"
                        >
                          {e.order_no}
                        </Link>
                      ) : ''}
                    </Td>
                    <Td className="capitalize text-ink-muted">{e.stage}</Td>
                    <Td className="font-medium text-ink">
                      {ACTION_LABEL[e.action] || String(e.action).replace(/_/g, ' ')}
                    </Td>
                    <Td>{e.handler_name || ''}</Td>
                    <Td className="text-ink-muted">{e.notes || ''}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
