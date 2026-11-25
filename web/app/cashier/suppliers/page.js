import { redirect } from 'next/navigation';

/** Suppliers and stock are the manager's alone now. An old bookmark lands back on the desk. */
export default function Page() {
  redirect('/cashier');
}
