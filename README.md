# Al Hadeed Hardware — Ordering & Cash Booking System

A digital ordering and cash booking system for Al Hadeed Hardware, Kampala.
Customers browse the product list and place orders in the mobile app; each order
then moves electronically through the shop's desks — **Cashier → Accounts → Store
Manager** — so payment is received, verified and goods released without paper
slips or queues.

Built to the MVP scope in the concept paper (Annex 1).



**Signing in:** who can use what, the test accounts, and how to make the
real ones on the live shop — see [LOGINS.md](LOGINS.md).

**Backups and security:** what to back up, how, and the handful of things
that actually get a shop broken into — see
[BACKUP-AND-SECURITY.md](BACKUP-AND-SECURITY.md).

---

## What is in this repository

| Folder | What it is | Who uses it |
| --- | --- | --- |
| [backend/](backend/) | Node.js + Express API, PostgreSQL, Socket.IO real-time, SMS | All sides |
| [web/](web/) | Next.js web app, role-based | All five sides |
| [mobile/](mobile/) | React Native (Expo) app, role-based login | Customer, Cashier, Accounts, Store Manager, Manager |
| [docs/](docs/) | Order flow, API reference, data model, deployment | — |

### Platform access

| User / Side | Mobile App | Web |
| --- | --- | --- |
| Customer | Yes | No — app only |
| Cashier | Yes | Yes |
| Accounts | Yes | Yes |
| Store Manager | Yes | No — app only |
| Manager | Yes | Yes |

**The back end is the WordPress plugin** in [wordpress/](wordpress/). The
phone app and the web panel both talk to it, so there is one database and
one set of rules. It runs on hosting the shop already pays for: always on,
nothing that sleeps, no database that expires.

```
   FlutterFlow app -+
   Next.js panel  --+--> WordPress plugin --> WooCommerce + MySQL
   wp-admin desks --+        (REST API)
```

The Node API in [backend/](backend/) is the original build. It still works
and its tests still pass, but it is no longer the thing to deploy — kept
until the WordPress deployment has been proven on the live site.

---

## Quick start

Requires **Node.js 20 or newer**. No database to install: with no
`DATABASE_URL` set the API runs **PGlite** — PostgreSQL compiled to
WebAssembly, inside the Node process — storing to `backend/data/pg`.
Production points `DATABASE_URL` at a hosted Postgres; it is the same
engine either way.

```bash
npm install          # installs backend and web
npm run db:reset     # creates the database and loads demo data
npm run dev          # API on :4000, web panel on :3000
```

Then open <http://localhost:3000> and sign in as any of the five roles.

For the mobile app:

```bash
cd mobile
npm install
npm start            # scan the QR code with Expo Go
```

> Testing on a real phone: set `EXPO_PUBLIC_API_URL` to your computer's LAN
> address (for example `http://192.168.1.14:4000`). On a phone, `localhost` means
> the phone itself.

---

## Demo logins

Created by `npm run db:reset`.

**Staff** — phone or email, plus password:

| Role | Email | Password | Access |
| --- | --- | --- | --- |
| Cashier | `cashier@alhadeed.ug` | `cashier123` | App + Web |
| Accounts | `accounts@alhadeed.ug` | `accounts123` | App + Web |
| Store Manager | `store@alhadeed.ug` | `store123` | App + Web |
| Manager | `manager@alhadeed.ug` | `manager123` | App + Web |

**Customers** — phone number plus a 6-digit code. In development the code is
always `123456` (set `OTP_DEV_MODE=false` to switch to real random codes and
wire up an SMS gateway).

| Phone | Who | Account |
| --- | --- | --- |
| `+256770111001` | Mukasa Joseph | Individual |
| `+256770111002` | Nakato Grace | Individual |
| `+256770222001` | John Okello | Company owner, Kampala Construction Ltd |
| `+256770222002` | Sarah Namuli | Company staff — Cashier, limit UGX 5,000,000 |
| `+256770222003` | Peter Ssali | Company staff — Buyer, limit UGX 1,000,000 |
| `+256770222004` | Moses Kigozi | Company staff — Site Supervisor, limit UGX 2,000,000 |

---

## The order flow

| # | Stage | What happens | Status after |
| --- | --- | --- | --- |
| 1 | Customer (app) | Selects products, confirms quantities, submits. An order number is generated against the customer / company account. | `pending_payment` |
| 2 | Cashier | Order appears instantly on the cashier screen. Payment is received (cash, mobile money or card), recorded, and a receipt issued. | `paid` |
| 3 | Accounts | Payment is confirmed against the till / mobile money statement and approved for release. | `payment_verified` |
| 4 | Store Manager | Items are picked, packed, stock is updated and the goods released. | `released` |
| 5 | Manager | Monitors every stage, handles cancellations and refunds, views reports. | — |

The customer gets a notification at every status change. For company accounts,
both the staff member who ordered and the company owner see the order and its
status.

A rejected payment goes back to the cashier (`rejected`), not forward.

See [docs/ORDER_FLOW.md](docs/ORDER_FLOW.md) for the full state machine.

---

## What is built (Phase 1)

- Customer registration and login — phone (OTP) and email; individual or company
- Company accounts with their own staff users, spending limits per staff member,
  and an owner view of every order placed under the company
- Role-based staff access — separate logins for Cashier, Accounts, Store Manager
  and Manager; each sees only their own side
- Real-time order hand-off between desks (Socket.IO)
- Alerts and notifications at each status change
- Product search and filters by name, category and price
- Digital receipts in the app and a printable receipt at the cashier desk
- Automatic stock reduction on release, with low-stock alerts
- Full audit trail — who handled each order and when
- Reports as a formatted Excel workbook or PDF, for the manager only
- Cash book with running balance, and daily reconciliation

**Phase 2 (not built):** in-app mobile money / card payment via Pesapal,
delivery tracking and EFRIS e-receipts. See
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#phase-2).

---

## Technology

| Component | Used here | Concept paper |
| --- | --- | --- |
| Mobile app | React Native (Expo), React Navigation | React Native ✓ |
| Web panel | Next.js 15, React 19 | Next.js, React ✓ |
| Back-end | Node.js, Express | Node.js, Express ✓ |
| Database | PostgreSQL via `pg`; PGlite in development | Supabase / MySQL — Postgres ✓ |
| Real-time | Socket.IO | Real-time order hand-off ✓ |
| Auth | JWT, bcrypt, role-based guards | Secure logins, role-based access ✓ |
| Testing | `node:test` end-to-end suite | Automated testing ✓ |

**On the database:** PostgreSQL. In production it is an ordinary Postgres
server — the Render blueprint creates one alongside the API — and any other
would do: the connection string is the only thing that changes. Locally
there is nothing to install or start: with `DATABASE_URL` unset the API runs
**PGlite**, which is PostgreSQL itself compiled to WebAssembly, in process,
writing to `backend/data/pg`. The test suite uses it too, so what passes the
tests runs on the same engine as the shop. Every query goes through
[backend/src/db/index.js](backend/src/db/index.js).

---

## Tests

```bash
npm test
```

14 end-to-end tests covering the full order flow, role isolation, company
spending limits, stock rules, payment rejection, notifications and reporting.

---

## Documentation

- [docs/ORDER_FLOW.md](docs/ORDER_FLOW.md) — stages, statuses and the rules at each desk
- [docs/API.md](docs/API.md) — every endpoint, with request and response shapes
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md) — tables, columns and relationships
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — going live, hosting, and Phase 2
