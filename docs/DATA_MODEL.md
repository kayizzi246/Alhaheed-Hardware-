# Data Model

SQLite schema, defined in
[backend/src/db/schema.sql](../backend/src/db/schema.sql).

All money is stored as **whole Ugandan shillings in INTEGER columns** — never
floats. Timestamps are UTC text (`datetime('now')`).

## Tables

### `companies`
Company customers. One row per company account.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER PK | |
| `company_name` | TEXT | |
| `tin` | TEXT | Tax identification number |
| `contact_person`, `phone`, `email`, `address` | TEXT | |
| `status` | TEXT | `active` / `suspended` |
| `date_registered` | TEXT | |

### `users`
Everyone who can sign in — customers **and** staff.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER PK | |
| `full_name`, `phone`, `email` | TEXT | `phone` is unique |
| `password_hash` | TEXT | Staff only; customers use OTP |
| `role` | TEXT | `customer` / `cashier` / `accounts` / `store` / `manager` |
| `account_type` | TEXT | For customers: `individual` / `company_owner` / `company_staff` |
| `company_id` | INTEGER FK → companies | |
| `staff_role` | TEXT | The company's own label: Cashier, Buyer, Site Supervisor |
| `spending_limit` | INTEGER | Per-order cap for company staff; NULL means no limit |
| `status` | TEXT | `active` / `suspended` |
| `added_by` | INTEGER FK → users | Who created this account |

### `otp_codes`
Short-lived phone login codes. Consumed on use, expire after 5 minutes.

### `categories`, `products`
The catalogue. `products` carries `price`, `stock_available`, `reorder_level`
and `supplier`. Products are **retired** (`active = 0`), never deleted, so past
orders keep their references.

### `price_changes`
Every price edit by the manager: old price, new price, who, when.

### `orders`
| Column | Notes |
| --- | --- |
| `order_no` | Human-facing, e.g. `AH-10427`, drawn from `counters` |
| `customer_id` | The person who placed it |
| `company_id` | Set when ordering on a company's behalf |
| `status` | See [ORDER_FLOW.md](ORDER_FLOW.md) |
| `current_stage` | `cashier` / `accounts` / `store` / `done` |
| `subtotal`, `delivery_fee`, `total` | Whole shillings |
| `fulfilment` | `pickup` / `delivery` |
| `delivery_address`, `notes`, `cancel_reason` | |

### `order_items`
One row per line. `product_name`, `unit` and `unit_price` are **snapshots taken
at order time**, so a later price change cannot rewrite an old receipt.
`qty_released` records what the store actually handed over.

### `order_events` — the audit trail
Every hand-off: `stage`, `action`, `from_status`, `to_status`, `handled_by`,
`handler_name`, `notes`, `created_at`. Nothing is ever updated or deleted here.

### `payments`
| Column | Notes |
| --- | --- |
| `receipt_no` | e.g. `R-00843`, unique, from `counters` |
| `amount_due`, `amount_paid` | Difference is the customer's change |
| `method` | `cash` / `mobile_money` / `card` |
| `transaction_ref` | Required for mobile money and card |
| `cashier_id`, `cashier_name` | Who took it |
| `verified` | `0` pending, `1` verified, `-1` rejected |
| `verified_by`, `verifier_name`, `verified_at`, `verify_remarks` | Accounts' decision |

### `cash_book`
Cash in / cash out with a date. A verified payment writes a row automatically;
Accounts can also add manual entries (an opening float, transport, fuel). The
running balance is computed at read time from the opening balance plus the day's
rows.

### `refunds`
Requested by any desk, decided by the manager. An approved refund sets the order
to `refunded` and writes a cash-out row.

### `stock_movements`
Every change to stock: `goods_received`, `release` or `adjustment`, with signed
`quantity`, `stock_before`, `stock_after` and who handled it. Releases link back
to the order.

### `notifications`
Either addressed to one `user_id` or broadcast to a `role` (a desk queue alert).

### `counters`
`order` and `receipt` sequences, incremented inside the same transaction as the
insert so numbers never collide under concurrent use.

## Relationships

```
companies 1───∞ users ───∞ orders ───∞ order_items ───1 products
                            │  │                           │
                            │  └──∞ order_events           └──∞ stock_movements
                            └──∞ payments ──∞ cash_book
```

## Why integers for money

Floating point cannot represent decimal money exactly, and a shop's cash book
must balance to the shilling. Uganda's currency has no sub-unit in practice, so
every amount is a whole number of shillings. `toAmount()` in
[backend/src/utils/money.js](../backend/src/utils/money.js) rounds and rejects
anything that is not a clean non-negative integer.
