/**
 * Navigation and landing page for each desk on the web panel.
 *
 * Cashier, Accounts and the Manager work here as well as on the app.
 * Customers and the Store Manager are app-only: a customer never sees
 * this panel, and the store's work happens walking the aisles with a
 * phone, not sitting at a counter.
 *
 * Each entry carries the icon it shows and, where a desk has more than
 * a handful of screens, the group it belongs under. The manager has
 * nine; without grouping that is a list nobody reads to the bottom of.
 */
export const NAV = {
  cashier: [
    { href: '/cashier', label: 'Payment Queue', icon: 'queue' },
    { href: '/cashier/sale', label: 'New Sale', icon: 'box' },
    { href: '/cashier/receipts', label: 'Receipts', icon: 'receipt' },
    { href: '/cashier/customers', label: 'Customers', icon: 'people' },
    { href: '/cashier/cash-book', label: 'Cash Book', icon: 'cash' },
    { href: '/cashier/end-of-day', label: 'End of Day', icon: 'clock' },
    { href: '/cashier/expenses', label: 'Expenses', icon: 'cash' },
    { href: '/cashier/suppliers', label: 'Suppliers', icon: 'mail' },
  ],
  accounts: [
    { href: '/accounts', label: 'Verify Payments', icon: 'check' },
    { href: '/accounts/cash-book', label: 'Cash Book', icon: 'cash' },
    { href: '/accounts/reconciliation', label: 'Reconciliation', icon: 'scales' },
    { href: '/accounts/expenses', label: 'Expenses', icon: 'cash' },
    { href: '/accounts/reports', label: 'Reports', icon: 'chart' },
  ],
  manager: [
    { href: '/manager', label: 'Dashboard', icon: 'home' },
    { href: '/manager/orders', label: 'All Orders', icon: 'queue' },

    { group: 'The shop' },
    { href: '/manager/products', label: 'Products', icon: 'box' },
    { href: '/manager/customers', label: 'Customers', icon: 'people' },
    { href: '/manager/staff', label: 'Staff', icon: 'user' },
    { href: '/manager/expenses', label: 'Expenses', icon: 'cash' },
    { href: '/manager/suppliers', label: 'Suppliers', icon: 'mail' },

    { group: 'Records' },
    { href: '/manager/reports', label: 'Reports', icon: 'chart' },
    { href: '/manager/monthly', label: 'Monthly Report', icon: 'receipt' },
    { href: '/manager/audit', label: 'Audit Trail', icon: 'clock' },
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
