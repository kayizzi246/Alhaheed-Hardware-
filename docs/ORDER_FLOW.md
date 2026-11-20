# Order Flow

How an order moves through Al Hadeed Hardware, and the rules enforced at each desk.

## Statuses

| Status | Meaning | Desk that owns it |
| --- | --- | --- |
| `pending_payment` | Placed by the customer, not yet paid | Cashier |
| `paid` | Cashier took payment and issued a receipt | Accounts |
| `payment_verified` | Accounts confirmed the money is in | Store |
| `released` | Goods handed over, stock reduced | — (complete) |
| `rejected` | Accounts could not verify the payment | Cashier (goes back) |
| `cancelled` | Cancelled by the customer or the manager | — |
| `refunded` | Manager approved a refund | — |

## The happy path

```
  Customer app          Cashier            Accounts            Store Manager
       │                   │                   │                    │
  place order ────▶ pending_payment            │                    │
       │           receive payment ───▶      paid                   │
       │                   │           verify payment ───▶ payment_verified
       │                   │                   │            release goods
       │                   │                   │                    │
       ◀───────── notification at every step ──┴──────────▶    released
```

Every transition writes a row to `order_events` (the audit trail) and pushes a
Socket.IO event so the next desk sees the order without refreshing.

## Rules enforced by the API

These are not just UI conveniences — the server rejects anything that breaks them.

### Placing an order (`POST /api/orders`)
- The cart cannot be empty.
- Every product must be active, and the quantity must not exceed
  `stock_available` (`409 Conflict` otherwise).
- A delivery order must carry a delivery address.
- If a **company staff** member has a `spending_limit`, an order above it is
  refused with `403` — the limit is checked against the order total, server side.
- Prices and product names are **snapshotted** onto `order_items`, so a later
  price change never rewrites history.

### Receiving payment (`POST /api/cashier/orders/:id/payment`)
- Only from `pending_payment` or `rejected`. Anything else is `409`.
- `amountPaid` must be at least the order total — change is reported back, never
  a short payment.
- Mobile money and card payments require a `transactionRef`; cash does not.
- A unique receipt number is drawn from the `counters` table, so two cashiers
  working at once can never issue the same number.

### Verifying (`POST /api/accounts/orders/:id/verify`)
- Only from `paid`.
- On approval: the payment is marked verified and a `cash_book` row is written,
  so the day's cash book and the verified payments always agree.
- On rejection: the order returns to the **cashier** with the remarks, and the
  customer is notified. It does not move forward.

### Releasing (`POST /api/store/orders/:id/release`)
- Only from `payment_verified` — goods can never leave before Accounts has
  confirmed the money.
- Stock is re-checked inside the transaction; if someone else sold the last bag
  of cement in the meantime, the release fails rather than going negative.
- Each item writes a `stock_movements` row with `stock_before` and `stock_after`.
- Any product that falls to or below its reorder level alerts the Store and the
  Manager.

### Cancelling (`POST /api/orders/:id/cancel`)
- A customer may cancel only while the order is still `pending_payment`.
- Once money has been taken, only the **manager** can cancel.
- A released, cancelled or refunded order cannot be cancelled again.

## Who can see what

| Role | Sees |
| --- | --- |
| Customer (individual) | Only their own orders |
| Company staff | Only the orders they placed |
| Company owner | Every order placed under the company account, with who ordered and when |
| Cashier / Accounts / Store | The order register (their queue, plus lookup) |
| Manager | Everything, plus staff, products, refunds, reports and the audit trail |

Enforced in `assertCanView()` in
[backend/src/services/orders.js](../backend/src/services/orders.js) and by the
`requireRole` middleware on every route.

## Real-time events

| Event | Sent to | When |
| --- | --- | --- |
| `order:new` | All desks | A customer places an order |
| `order:updated` | All desks, the customer, the company owner | Any status change |
| `notification` | The person or the desk | Alerts and queue notices |

Rooms are `user:<id>`, `role:<role>` and `company:<id>`; a socket joins its own
rooms from the JWT on connect.
