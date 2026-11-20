# FlutterFlow — Al Hadeed Hardware app

The app as FlutterFlow **custom widgets**: five screens, and everything
else as a bottom sheet.

Customers are app-only (the concept paper's Platform Access table, and the
web panel has no customer side at all). The Cashier and Accounts desks are
on the web panel; the Manager has a screen here too, because a manager's
phone number signs them straight into it.

---

## The customer's path

This is the whole flow, and the screens exist to serve it:

1. **Open the app → the product list.** No sign-in, no account, nothing
   asked. The catalogue is public.
2. **Tap a product → a sheet** with the price, what is in stock and a
   quantity stepper. Primary button: **Proceed to order**. (Secondary:
   *Add and keep shopping*, for a builder's run of several items.)
3. **A sheet asks for the phone number.** That is the only identification
   there is — no code to wait for.
4. **The final page**: the order read back, the name, how the goods
   travel, and where they are going.
   - *We deliver it* — the shop's truck, free of charge. Needs an address.
   - *My own delivery man collects it* — their boda or truck takes it from
     the counter.
   - *I will collect it myself.*
5. **Place order → an SMS** goes to that number with the order number and
   the amount.
6. **The order is in Orders**, tracked live through Cashier → Accounts →
   Store.

No money moves in the app. Payment is at the cashier's desk, so nothing in
the wording promises a purchase — it is *order*, never *buy*.

### The phone number is the account

A number that has ordered before is recognised and the order joins that
history; a new number gets a customer record created for it. `0772123456`,
`772123456` and `+256772123456` are all the same number.

A **manager's** number opens the manager side instead of the shop. A
cashier, accounts or store number is told which desk it belongs to and
where that desk lives.

---

## The five screens

| # | File | Widget class | What it is |
| --- | --- | --- | --- |
| 1 | [al_hadeed_shop.dart](custom_code/widgets/al_hadeed_shop.dart) | `AlHadeedShop` | Product list — search, category filters, proceed to order |
| 2 | [al_hadeed_cart.dart](custom_code/widgets/al_hadeed_cart.dart) | `AlHadeedCart` | The final page — order, name, delivery choice, location |
| 3 | [al_hadeed_orders.dart](custom_code/widgets/al_hadeed_orders.dart) | `AlHadeedOrders` | Order history and live five-step tracking |
| 4 | [al_hadeed_company.dart](custom_code/widgets/al_hadeed_company.dart) | `AlHadeedCompany` | Company owner: staff, limits, every company order |
| 5 | [al_hadeed_manager.dart](custom_code/widgets/al_hadeed_manager.dart) | `AlHadeedManager` | Manager: sales, stages, refunds, low stock |

Screen 4 is two screens in one, chosen by who is signed in: a **company
owner** gets the staff register; anyone else gets their account.

Screen 5 is not on the bottom bar — a manager's number lands there at
sign-in, and no customer ever sees it.

## Everything else is a sheet

| Sheet | Lives in | Opens from |
| --- | --- | --- |
| Product detail + quantity | shop | tapping a product |
| Sign in — phone, then the SMS code | shop | the avatar, for seeing past orders |
| That is another desk | shop | a cashier/accounts/store number signing in |
| Account & sign out | shop, company, manager | the avatar |
| Phone number | cart | reaching the final page |
| Order placed — SMS sent, what happens next | cart | a successful order |
| Clear this order? | cart | the bin in the header |
| Order tracking — progress, items, cancel | orders | tapping an order |
| The receipt | orders | "View receipt", once paid |
| Add / edit staff — role, limit, suspend, remove | company | "Add staff", or a staff member |
| What is at this desk | manager | tapping a stage |
| Decide a refund | manager | a refund request |

`_ConfirmSheet` is the single "are you sure", so every destructive answer
looks and reads the same way.

---

## Putting them into FlutterFlow

1. **Custom Code → Widgets → Add**, one per file. Name the widget exactly
   as the class is named (`AlHadeedShop`, and so on) and paste the whole
   file over the generated stub, including the import header at the top.
2. In each widget's settings switch **Width and Height** on. The
   constructors already accept `width` and `height`; without this,
   FlutterFlow saves with *Parameter "width" not found*.
3. **Custom Code → Dependencies**, add:

   ```yaml
   http: ^1.2.0
   shared_preferences: ^2.2.0
   ```

4. Point the app's entry page at `AlHadeedShop` — the in-app bottom bar
   moves between the first four, and sign-in routes a manager to the fifth.

### The one line to change when you deploy

`_apiBase`, at the top of **all five** files:

```dart
const String _apiBase = 'http://localhost:4000';
```

On a real phone `localhost` means the phone itself, so while testing use
the computer's LAN address — `http://192.168.1.14:4000`. The API must be
running: `npm run dev` from the repository root.

---

## Why each file repeats the same ~980 lines

FlutterFlow generates `custom_code/widgets/index.dart` as a list of

```dart
export 'al_hadeed_shop.dart' show AlHadeedShop;
```

lines, so **a widget class is the only thing that crosses from one custom
widget file to another**. A shared private helper is not visible from the
next file and the build fails with `The function '_txt' isn't defined`.

So all five files carry the same core — tokens, type scale, `_Glass`,
`_Pressable`, `_Field`, `_Sheet`, the API client, `_Session`, `_CartStore`,
`_Header`, `_BottomBar`. [custom_code/widgets/_shared_core.dart.md](custom_code/widgets/_shared_core.dart.md)
lists it. **When you change a token, change it in all five** — the cores
are currently byte-identical and worth keeping that way.

Each file carries a few core helpers it does not use itself, so every file
opens with `// ignore_for_file: unused_element` — a warning silenced, not
an error.

### How the screens share state

They cannot share a Dart object — each file's `_Session` and `_CartStore`
are separate instances. They share through `SharedPreferences`, and every
screen calls `load()` in `initState`. Keys: `alhadeed.token`,
`alhadeed.user`, `alhadeed.cart`, `alhadeed.details`.

---

## What the screens call

| Screen | Calls |
| --- | --- |
| Shop | `GET /api/products`, `GET /api/products/categories` (both public), `POST /api/auth/otp/request`, `POST /api/auth/otp/verify` |
| Cart | `POST /api/orders/guest` (no account) or `POST /api/orders` (signed in) |
| Orders | `GET /api/orders/mine?scope=mine\|company`, `GET /api/orders/:id/track`, `POST /api/orders/:id/cancel` |
| Company | `GET /api/company`, `/company/staff`, `/company/orders`; `POST`/`PATCH`/`DELETE /api/company/staff` |
| Manager | `GET /api/manager/dashboard`, `GET /api/orders/queue/:stage`, `POST /api/manager/refunds/:id/decide` |

The API answers `{ ...data }` or `{ "error": "in plain words" }`. The error
is shown as the server wrote it, because the server's wording — *"Only 8
length of Iron Bar Y12 left in stock"* — says what to do next far better
than a status code would.

---

## SMS

Login codes and order confirmations both go through
[backend/src/utils/sms.js](../backend/src/utils/sms.js). Pick the provider
in `backend/.env`:

```bash
SMS_PROVIDER=africastalking   # or: log (default), generic
SMS_API_KEY=...
SMS_USERNAME=...
SMS_SENDER_ID=AL HADEED
OTP_DEV_MODE=false            # real random codes instead of 123456
```

`log` writes the message to the server console and sends nothing — what
development wants, with no account and no credit. A send that fails never
crashes the request: the order is still placed, and the app says the text
did not go.

---

## Test numbers

The API must be seeded (`npm run db:reset`). With `OTP_DEV_MODE=true` the
code is always `123456`.

| Number | Lands on |
| --- | --- |
| *any new number* | Shop → orders as a new customer, no account needed |
| `+256770111001` | Shop, as Mukasa Joseph with his order history |
| `+256770222001` | Shop, as a company owner — the Company tab has the staff register |
| `+256700000004` | **The manager side** |
| `+256700000001` | "That is the Cashier desk" — sent to the web panel |

---

## Not built here

Phase 2 in the concept paper: in-app mobile money or card payment
(Pesapal), delivery tracking and EFRIS e-receipts. Payment happens at the
cashier's desk, which is what the order flow expects today.

Push notifications are not wired up — the API records a notification at
every status change, and the tracking screen reads the current state when
opened or pulled to refresh. Firebase Cloud Messaging is the step that
turns those into alerts on the phone. The order confirmation does go out
as an SMS.

Cashier, Accounts and Store Manager have no screen in this app yet; their
numbers are told so at sign-in. They would be built the same way.
