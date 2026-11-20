/**
 * Navigation and landing page for the two desks on the web panel.
 *
 * Per the concept paper's Platform Access table, the web panel is for the
 * Cashier and Accounts desks only. Customers, the Store Manager and the
 * Manager all work in the mobile app, so none of them has a web side here.
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
};

/** Where each desk lands after signing in. Also the list of who may sign in. */
export const HOME = {
  cashier: '/cashier',
  accounts: '/accounts',
};

export const DESK_LABEL = {
  cashier: 'Cashier Desk',
  accounts: 'Accounts Desk',
};

/** Every role that may open the web panel. */
export const WEB_ROLES = Object.keys(HOME);
