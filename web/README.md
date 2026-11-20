# Web App — Cashier & Accounts panel

Next.js 15 (App Router). The two counter desks in the browser; each desk sees
only its own side.

> **Cashier and Accounts only**, as the concept paper's Platform Access table
> specifies. Customers, the Store Manager and the Manager all work in the
> mobile app and have no web side here — no pages, no sign-in, no nav. The
> only login is the staff login, and an account that is not a cashier or
> accounts is turned away.

## Run

```bash
npm install
npm run dev     # http://localhost:3000
```

The API must be running on `NEXT_PUBLIC_API_URL` (default `http://localhost:4000`).

## Pages

### Sign in
| Route | What it does |
| --- | --- |
| `/` | Staff sign in — phone or email, plus password |

### Cashier
| Route | What it does |
| --- | --- |
| `/cashier` | Live payment queue, receive payment, recent receipts |
| `/cashier/receipts` | Receipts issued, with a printable receipt |
| `/cashier/cash-book` | The cash book, read-only |
| `/cashier/end-of-day` | Till hand-over summary |

### Accounts
| Route | What it does |
| --- | --- |
| `/accounts` | Verify or reject payments, today's cash book |
| `/accounts/cash-book` | Cash book with manual entries |
| `/accounts/reconciliation` | Collected vs verified vs the cash book |
| `/accounts/reports` | Sales, best sellers, stock; Excel and PDF export |

## How it fits together

- **`components/Shell.js`** is the chrome for every side: sidebar, live
  connection dot, cart and unread badges, and the role guard. Each section's
  `layout.js` passes `allow={[...roles]}`; anyone else is redirected to their own
  home page. The API enforces the same rules server side, so the guard is
  convenience, not security.
- **`lib/roles.js`** holds the navigation and landing page for each role — one
  place to change what a side can reach.
- **`lib/cart.js`** keeps the customer's cart in `localStorage`, so a refresh
  does not lose it. Staff pages get a safe empty cart.
- **`lib/socket.js`** opens one authenticated Socket.IO connection per tab.
  Queues, the dashboard and order tracking all refresh on `order:new`,
  `order:updated` and `notification`, so nothing needs a manual reload.
