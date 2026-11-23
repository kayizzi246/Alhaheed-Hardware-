'use client';

import Customers from '@/components/Customers';

/**
 * The cashier's customer list: is the person at the counter already
 * known, and if not, add them.
 */
export default function CashierCustomers() {
  return <Customers canAdd />;
}
