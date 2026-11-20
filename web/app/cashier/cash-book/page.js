'use client';
import CashBook from '@/components/CashBook';

/** The cashier sees the cash book read-only; Accounts owns the entries. */
export default function CashierCashBook() {
  return <CashBook readOnly title="Cash Book" />;
}
