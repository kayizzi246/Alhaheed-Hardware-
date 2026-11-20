/**
 * Navigation and landing page for each desk on the web panel.
 *
 * Cashier, Accounts and the Manager work here as well as on the app.
 * Customers and the Store Manager are app-only: a customer never sees
 * this panel, and the store's work happens walking the aisles with a
 * phone, not sitting at a counter.
 */
export const NAV = {
  cashier: [
    { href: '/cashier', label: 'Payment Queue' },
    { href: '/cashier/receipts', label: 'Receipts' },
    { href: '/cashier/cash-book', label: 'Cash Book' },
    { href: '/cashier/end-of-day', label: 'End of Day' },
    { href: '/notifications', label: 'Alerts', badge: 'alerts' },
  ],
  accounts: [
    { href: '/accounts', label: 'Verify Payments' },
    { href: '/accounts/cash-book', label: 'Cash Book' },
    { href: '/accounts/reconciliation', label: 'Reconciliation' },
    { href: '/accounts/reports', label: 'Reports' },
    { href: '/notifications', label: 'Alerts', badge: 'alerts' },
  ],
  manager: [
    { href: '/manager', label: 'Dashboard' },
    { href: '/manager/orders', label: 'All Orders' },
    { href: '/manager/products', label: 'Products' },
    { href: '/manager/staff', label: 'Staff' },
    { href: '/manager/customers', label: 'Customers' },
    { href: '/manager/reports', label: 'Reports' },
    { href: '/manager/audit', label: 'Audit Trail' },
    { href: '/notifications', label: 'Alerts', badge: 'alerts' },
  ],
};

/** Where each desk lands after signing in. Also the list of who may sign in. */
export const HOME = {
  cashier: '/cashier',
  accounts: '/accounts',
  manager: '/manager',
};

export const DESK_LABEL = {
  cashier: 'Cashier Desk',
  accounts: 'Accounts Desk',
  manager: 'Manager',
};

/** Every role that may open the web panel. */
export const WEB_ROLES = Object.keys(HOME);
