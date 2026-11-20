# The WordPress plugin — Al Hadeed Hardware

**This is the back end for the whole system.** The FlutterFlow phone app
and the Next.js web panel both talk to it, so there is one database and
one set of rules, not three.

```
   FlutterFlow app ─┐
   Next.js panel  ──┼──►  this plugin  ──►  WooCommerce + MySQL
   wp-admin desks ──┘       (REST API)
```

It runs on the WordPress hosting the shop already pays for: always on,
no sleeping, no database that expires in 30 days, no second bill.

---

## Who uses what

| | Mobile app | Web |
| --- | --- | --- |
| Customer | **Yes** | No |
| Cashier | Yes | Yes |
| Accounts | Yes | Yes |
| Store Manager | **Yes** | No |
| Manager | Yes | Yes |

"Web" is either the Next.js panel or the desk screens inside wp-admin —
both are this same plugin, seen from different places.

## How an order moves

```
CUSTOMER   orders in the mobile app              → pending
   ▼
CASHIER    takes the money, issues a receipt     → ah-paid
   ▼
ACCOUNTS   checks it against the till / MM       → ah-verified
   ▼
STORE      picks, packs, reduces stock, releases → completed
   ▼
MANAGER    watches all of it, refunds, reports
```

The customer is texted at every step. A rejected payment goes **back to
the cashier**, never forward, and the cash book entry is reversed rather
than deleted — the shop needs to see that it happened and was undone.

---

## Installing

1. **Plugins → Add New → Upload Plugin** → `al-hadeed-hardware.zip` →
   Install → Activate. WooCommerce must be active first.
2. **Settings → Permalinks** → pick anything other than Plain → Save.
   This switches on the `/api/...` address the apps use.
3. **Al Hadeed → Settings** → set the SMS gateway and, before taking
   real orders, **turn test mode off**.
4. Add staff under **Users → Add New**, giving each the right role:
   Cashier, Accounts, Store Manager or Shop Manager.
5. Products are ordinary WooCommerce products. The **SKU is the product
   code** the apps show (`AH-CEM-001`), and the `unit` attribute is what
   a hardware shop sells by — bag, length, tin. Set stock quantities so
   the app can refuse what is not on the shelf.

### Pointing the apps here

One line each, already set in this repository for `pearlfx.online`:

| | |
| --- | --- |
| Web panel | `web/.env.local` → `NEXT_PUBLIC_API_URL=https://pearlfx.online` |
| Phone app | all five files in `flutterflow/custom_code/widgets/` → `const String _apiBase = 'https://pearlfx.online';` |
| Expo app | `mobile/.env` → `EXPO_PUBLIC_API_URL=https://pearlfx.online` |

**Use `https://`, not `http://`.** The domain redirects http to https,
and a redirect can drop the body of a POST — so an order placed over
http would arrive empty. Phones also block plain http by default.

Check it: <https://pearlfx.online/api/health> should answer
`{"ok":true,...}`.

---

## The API

Same paths and same JSON as the Node API the apps were built against,
so neither client needed changing beyond its base URL. Reachable at
`/api/...` and at `/wp-json/alhadeed/v1/...` — the same code either way.

| | |
| --- | --- |
| `GET /api/health` | is it alive |
| `GET /api/products`, `/api/products/categories` | the catalogue, **public** |
| `POST /api/auth/staff/login` | phone or email + password |
| `POST /api/auth/otp/request`, `/api/auth/otp/verify` | phone + SMS code; the request says which desk the number belongs to |
| `GET /api/auth/me` | who am I |
| `POST /api/orders/guest` | order from the app with no account |
| `GET /api/orders/mine`, `/api/orders/{id}`, `/api/orders/{id}/track` | the customer's own orders |
| `POST /api/orders/{id}/cancel` | cancel |
| `GET /api/cashier/queue`, `POST /api/cashier/orders/{id}/payment` | the cashier desk |
| `GET /api/accounts/queue`, `POST /api/accounts/orders/{id}/verify` | the accounts desk |
| `GET /POST /api/accounts/cash-book` | the cash book |
| `GET /api/store/queue`, `POST /api/store/orders/{id}/release` | the store desk |
| `GET /api/manager/dashboard` | the manager's overview |

Errors come back as `{"error": "in plain words"}`, which is what both
clients already show the user.

### Signing in

A bearer token, exactly as before. It is a signed statement rather than
a stored session — HMAC-SHA256 over the payload with this WordPress
installation's own auth salt — so there is no session table to grow, and
changing the salts in `wp-config.php` signs everybody out at once.

If tokens are rejected on your host, Apache with CGI is probably eating
the `Authorization` header. Add to `.htaccess`:

```apache
RewriteEngine On
RewriteCond %{HTTP:Authorization} ^(.*)
RewriteRule .* - [E=HTTP_AUTHORIZATION:%1]
```

---

## What the plugin adds to the database

Three tables, because WooCommerce has no concept of them:

| | |
| --- | --- |
| `wp_ah_payments` | one receipt per payment, and whether Accounts has checked it |
| `wp_ah_cash_book` | cash in and out with a running balance |
| `wp_ah_events` | who moved an order, from which status to which, and when |

Plus `wp_ah_otp` for login codes. Orders, products and customers stay
where they belong: in WooCommerce.

Deactivating the plugin leaves all of it alone. Deactivating should not
throw away the shop's receipts.

---

## Verified

Run against real WordPress 6.x + WooCommerce + MySQL 8 in Docker:

```
catalogue, no sign-in      2 products, correct shape
app order (no account)     AH-14 · UGX 152,000 · customer created · SMS
cashier                    receipt R-00802 → paid
paying twice               409 "Order AH-14 is already Paid"
accounts                   verified → payment_verified
store                      released → released
stock                      cement 117 → 115 · iron 58 → 56  (on release)
cashier → manager page     403        no token → 401
customer tracking          all five steps ticked
manager dashboard          sales today UGX 338,000
cash book                  reversal recorded on rejection
audit trail                placed → payment_received → verified → released
SMS sign-in                role detected from the number; code works once
unknown number             400
mobile money with no ref   400
```

One bug that run caught: `ltrim($status, 'wc-')` strips any of `w`, `c`
and `-` from the left, so `completed` became `ompleted` and the tracking
screen showed nothing as done. It is a prefix check now.
