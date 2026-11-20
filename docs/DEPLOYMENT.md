# Deployment

## Environment variables

### Backend (`backend/.env`)

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `4000` | |
| `NODE_ENV` | `development` | Set to `production` to hide error details |
| `JWT_SECRET` | dev value | **Must be changed.** A long random string |
| `JWT_EXPIRES_IN` | `12h` | One working day |
| `DB_FILE` | `./data/alhadeed.db` | Put this on a persistent disk |
| `CORS_ORIGINS` | localhost list | Comma-separated; set to your real web domain |
| `OTP_DEV_MODE` | `true` | **Set to `false` in production** — otherwise every code is `123456` |
| `SHOP_NAME`, `CURRENCY` | Al Hadeed Hardware, UGX | Shown on receipts |

### Web (`web/.env.local`)

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | The public API URL, e.g. `https://api.alhadeed.ug` |

### Mobile (`mobile/.env`)

| Variable | Notes |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | The public API URL. For LAN testing use your computer's IP, not `localhost` |

---

## Before going live

1. **Set `JWT_SECRET`** to a long random value. Anyone who knows it can forge a
   manager token.
2. **Set `OTP_DEV_MODE=false`** and connect an SMS gateway — see below. Left on,
   anyone can sign in as any customer with `123456`.
3. **Change every seeded staff password.** The demo passwords are in this repo.
4. **Serve over HTTPS.** Tokens travel in the `Authorization` header.
5. **Lock `CORS_ORIGINS`** to the real web panel domain.
6. **Back up the database file** on a schedule — it holds the cash book.

### Connecting an SMS gateway

The OTP is generated in `POST /api/auth/otp/request` in
[backend/src/routes/auth.js](../backend/src/routes/auth.js). The code is already
stored and expiring correctly; the only missing piece is the send. Replace the
comment marked `// In production this is where the SMS gateway is called` with
your provider's call, and stop returning `devCode`.

---

## Hosting

The concept paper proposes Vercel, Cloudflare and Namecheap.

| Piece | Where | Notes |
| --- | --- | --- |
| Web panel | Vercel | `cd web && vercel`. Set `NEXT_PUBLIC_API_URL`. |
| API | A host with a persistent disk (Railway, Render, Fly.io, or a VPS) | **Not Vercel** — the API holds a SQLite file and long-lived WebSocket connections, neither of which suits serverless functions. |
| Mobile | `eas build` for the Play Store and App Store | |
| Domain / CDN | Namecheap + Cloudflare | Proxy the web panel; the API needs WebSocket support enabled. |

Run the API behind a process manager (`pm2`, or a systemd unit) so it restarts on
reboot. `npm start` in `backend/` is the entry point.

---

## Moving to MySQL or Supabase

This build uses SQLite through Node's built-in `node:sqlite`, so there is no
native build step and no external service. For multiple shops, or if you want
Supabase's hosted real-time and backups, swap the database:

1. **Translate `schema.sql`.** `INTEGER PRIMARY KEY AUTOINCREMENT` becomes
   `SERIAL` / `AUTO_INCREMENT`, `datetime('now')` becomes `NOW()`, and
   `date(col)` becomes the equivalent date cast.
2. **Rewrite [backend/src/db/index.js](../backend/src/db/index.js)** — just the
   five functions `all`, `get`, `run`, `tx` and `nextCounter`. Everything else in
   the codebase goes through them.
3. **Convert placeholders** if you move to Postgres: `?` becomes `$1, $2, …`.
   One helper in the same module can do this for every query.
4. **Make the query functions async** and add `await` at the call sites. The
   service layer is already written as small, transaction-wrapped units, so this
   is mechanical.
5. **Keep `counters`.** Order and receipt numbers are drawn inside the same
   transaction as the insert, which is what makes them collision-free. A
   database sequence works equally well.

Nothing in the routes, the web panel or the mobile app changes.

---

## Phase 2

Not built in this MVP, and where each would go:

### Online payment in-app (Pesapal — mobile money and card)
The customer would pay before the cashier stage. Add a `payment_intents` table
and a Pesapal IPN webhook route; on a confirmed callback, create the `payments`
row exactly as the cashier does and move the order straight to `paid` (or to
`payment_verified`, if a gateway confirmation counts as verification for your
accountant). The order flow and all four desk screens stay as they are — one
more way in at step 2.

### Delivery tracking
`orders` already carries `fulfilment` and `delivery_address`, and the store
records a delivery status on release. Add a `deliveries` table (driver, vehicle,
dispatched/arrived timestamps, optionally GPS points) and a sixth step to the
customer's progress list.

### EFRIS e-receipts
URA's EFRIS needs invoice data submitted at the point of sale. The natural hook
is just after `verifyPayment()` succeeds: the payment is confirmed and the
receipt number already exists. Store the EFRIS invoice number and QR payload on
the `payments` row and render it on the receipt.
