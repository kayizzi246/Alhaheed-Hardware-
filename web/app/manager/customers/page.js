'use client';

import Customers from '@/components/Customers';

/** The same list the cashier sees, with the same way to add someone. */
export default function ManagerCustomers() {
  // Its long-standing address, so this screen keeps working on a site
  // whose plugin has not been updated yet. The cashier's is new.
  return <Customers canAdd from="/api/manager/customers" />;
}
