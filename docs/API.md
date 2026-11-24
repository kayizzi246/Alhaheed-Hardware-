# API Reference

Base URL: `http://localhost:4000`
All endpoints return JSON. All but `/api/health` and the `/api/auth/*` sign-in
routes require `Authorization: Bearer <token>`.

Errors come back as `{ "error": "A sentence the user can read" }` with a status
of 400 (bad input), 401 (not signed in), 403 (wrong role or not yours),
404 (missing) or 409 (conflicts with the current state).

---

## Auth — `/api/auth`

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| POST | `/register` | public | Register an individual or company customer |
| POST | `/otp/request` | public | Send a login code to a phone |
| POST | `/otp/verify` | public | Exchange the code for a token |
| POST | `/staff/login` | public | Staff sign-in with password |
| GET | `/me` | any | The signed-in profile |
| POST | `/change-password` | any | Change a staff password |

```http
POST /api/auth/register
{ "accountType": "company", "fullName": "John Okello",
  "phone": "+256770222001", "companyName": "Kampala Construction Ltd",
  "tin": "1000234567" }

→ 201 { "user": { ... }, "token": "ey..." }
```

```http
POST /api/auth/login         { "identifier": "email or phone", "password": "…" }   customers and staff
POST /api/auth/otp/request   { "phone": "+256770111001" }
→ { "sent": true, "devCode": "123456" }     // devCode only when OTP_DEV_MODE=true

POST /api/auth/otp/verify    { "phone": "+256770111001", "code": "123456" }
→ { "user": { ... }, "token": "ey..." }
```

---

## Products — `/api/products`

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| GET | `/` | any | Catalogue. Filters: `search`, `category`, `minPrice`, `maxPrice`, `inStock=1` |
| GET | `/categories` | any | Categories with product counts |
| GET | `/:id` | any | One product |
| POST | `/` | manager | Add a product |
| PATCH | `/:id` | manager | Edit; a price change is written to history |
| DELETE | `/:id` | manager | Retire (sets `active = 0`) |
| POST | `/categories` | manager | Add a category |

---

## Orders — `/api/orders`

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| POST | `/` | customer | Place an order |
| GET | `/mine` | customer | My orders. `?scope=company` for a company owner |
| GET | `/` | staff | Order register. Filters: `status`, `stage`, `from`, `to`, `q` |
| GET | `/queue/:stage` | staff | One desk's queue (`cashier`, `accounts`, `store`) |
| GET | `/:id` | owner or staff | One order with items, payment and events |
| GET | `/by-no/:orderNo` | owner or staff | Look up by order number |
| GET | `/:id/track` | owner or staff | Order plus the five-step progress list |
| POST | `/:id/cancel` | customer (before payment) or manager | Cancel |

```http
POST /api/orders
{ "items": [ { "productId": 1, "quantity": 40 } ],
  "fulfilment": "delivery", "deliveryAddress": "Site B, Namugongo Road" }

→ 201 { "order": { "order_no": "AH-10427", "status": "pending_payment",
                   "total": 1360000, "items": [...], "events": [...] } }
```

---

## Cashier — `/api/cashier`  *(cashier, manager)*

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/queue` | Orders waiting for payment, plus today's till totals |
| POST | `/orders/:id/payment` | Record a payment and forward to Accounts |
| GET | `/receipts` | Receipts for a date. `?mine=1` for just this cashier |
| GET | `/receipts/:receiptNo` | A printable receipt |
| GET | `/end-of-day` | This cashier's hand-over summary |
| GET | `/check-ref?ref=&order=` | Has this transaction ID already paid for another order? |

```http
POST /api/cashier/orders/12/payment
{ "method": "mobile_money", "amountPaid": 2485000, "transactionRef": "MP2611190934" }

→ { "order": { "status": "paid", "payment": { "receipt_no": "R-00843", "has_proof": false, ... }, ... } }
```

The receipt number is on `order.payment`. There is no top-level
`receipt` — an earlier version of this page said there was, and the
panel read it, so every successful payment showed the cashier an error.

**With the screenshot.** Send the same fields as `multipart/form-data`
with the picture in a part named `proof` (JPEG, PNG or WebP, up to
8 MB, checked by its bytes). It is stored outside the public uploads and
served only through `GET /api/payments/:paymentId/proof` to cashier,
accounts and manager. If the payment is refused, the picture is deleted.

**One transaction, one order.** A transaction ID already used by a
payment Accounts has not rejected is refused with `409 ah_ref_used`.
IDs are compared without spaces and case, so `mp261123 1401` and
`MP2611231401` are the same.

---

## Payments — `/api/payments`  *(cashier, accounts, manager)*

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/:id/proof` | The screenshot attached to a payment (image bytes, never cached) |

The accounts queue carries `payment_id` and `has_proof` on each row.

---

## Accounts — `/api/accounts`  *(accounts, manager)*

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/queue` | Paid orders awaiting verification, plus today's totals |
| POST | `/orders/:id/verify` | `{ approve: true }` to release, `false` to send back |
| GET | `/cash-book` | A day's entries with a running balance |
| POST | `/cash-book` | Add a manual entry (expense, float) |
| GET | `/reconciliation` | Collected vs verified vs the cash book, by method |

---

## Store — `/api/store`  *(store, manager)*

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/queue` | Approved orders to pick, pack and release, plus low stock |
| POST | `/orders/:id/release` | Release goods; stock is reduced atomically |
| GET | `/stock` | Stock levels. `?low=1`, `?search=` |
| POST | `/stock/receive` | Goods received from a supplier |
| POST | `/stock/adjust` | Signed adjustment with a reason |
| GET | `/stock/movements` | Movement history. `?productId=`, `?from=`, `?to=` |

---

## Manager — `/api/manager`  *(manager only)*

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/dashboard` | Sales today, orders by stage, last 7 days, low stock, refunds |
| GET | `/staff` | All staff accounts |
| POST | `/staff` | Create a staff account with a role |
| PATCH | `/staff/:id` | Edit, change role, suspend or reactivate |
| GET | `/customers` | Customers with order counts and lifetime value |
| GET | `/companies` | Company accounts with staff and order counts |
| GET | `/refunds` | All refund requests |
| POST | `/refunds` | Raise a refund request |
| POST | `/refunds/:id/decide` | Approve or decline |
| GET | `/audit` | The audit trail across all orders |

---

## Company — `/api/company`  *(customer accounts)*

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| GET | `/` | any company user | The company profile |
| GET | `/staff` | owner | Staff, with order counts and spend |
| POST | `/staff` | owner | Add a staff member and set a spending limit |
| PATCH | `/staff/:id` | owner | Change role, limit, or suspend |
| DELETE | `/staff/:id` | owner | Stop them ordering (suspends; history is kept) |
| GET | `/orders` | owner | Every company order, with who ordered and when |

---

## Reports — `/api/reports`  *(manager, accounts)*

All take `?period=daily|weekly|monthly` or explicit `?from=&to=`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/sales` | Totals, by day and by payment method |
| GET | `/best-sellers` | Quantity sold and revenue per product |
| GET | `/orders-by-stage` | Count and value per status |
| GET | `/stock-movement` | Received, released and adjusted per product |
| GET | `/staff-activity` | Actions per staff member |
| GET | `/export/:report.csv` | CSV for Excel: `sales`, `orders`, `cash-book`, `stock` |

---

## Notifications — `/api/notifications`

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` | Own notifications plus the desk's broadcasts, with an unread count |
| POST | `/:id/read` | Mark one read |
| POST | `/read-all` | Mark all read |

---

## Real-time (Socket.IO)

Connect to the same origin with the JWT:

```js
io('http://localhost:4000', { auth: { token } });
```

| Event | Payload | Sent to |
| --- | --- | --- |
| `order:new` | the order | All desks |
| `order:updated` | the order | All desks, the customer, the company owner |
| `notification` | `{ id, title, body, orderId }` | The person or the desk |
