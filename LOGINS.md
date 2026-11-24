# Signing in

Who can sign in where, what the test accounts are, and how to make real
ones on the live shop.

> **The passwords below are for the test site on this computer only.**
> They have never existed on pearlfx.online, and they must not be used
> there. Making the real accounts is the last section.

---

## Who uses what

Five kinds of account. Only three of them can use the web panel — the
other two work from the phone, which is the point of the phone app.

| | Phone app | Web panel | wp-admin |
| --- | :---: | :---: | :---: |
| **Customer** | yes | — | — |
| **Cashier** | yes | yes | their desk only |
| **Accounts** | yes | yes | their desk only |
| **Store Manager** | yes | — | their desk only |
| **Manager** | yes | yes | all four desks |
| **Administrator** | — | yes, as a manager | all of WordPress |

A Store Manager who tries the web panel is told *"Store Manager
accounts sign in on the Al Hadeed phone app, not here."* That is
deliberate, not a fault: the store's work happens walking the aisles with a phone, not
sitting at a counter.

The rule is enforced on the server as well as in the browser. A guard
that only exists in the browser is not a guard.

---

## The test site on this computer

Everything below is the Docker WordPress at `localhost:8080`. It is
throwaway: wipe it, rebuild it, nothing is lost.

### Staff

Same password for all of them: **`DeskTest123!`**

| Username | Desk | Phone, for SMS sign-in |
| --- | --- | --- |
| `manager` | Manager | +256700000004 |
| `cashier` | Cashier | +256700000001 |
| `accounts` | Accounts | +256700000002 |
| `store` | Store Manager — **app only** | +256700000003 |
| `admin` | WordPress administrator | — |

`admin` signs into the web panel too, and arrives as a manager:
administrators hold every desk capability, so the API gives them the
most privileged one.

### Hiring from the panel

Sign in as `manager`, open **Staff → Hire someone**. Name, phone, desk,
and a password — one is made for you (`Cement-Lorry-48` style, easy to
read across a counter), or type your own: 8+ characters with a letter
and a number. After saving, the sign-in details are shown **once**, to
hand over in person. They are never sent by SMS; the person is only
texted that their account is ready.

Click anyone's name to open their page: what they took today and this
month, every receipt and what Accounts made of it (with the payment
screenshot), and everything they did, newest first. It refreshes
itself every 15 seconds.

From their page: **Set a new password** (signs them out everywhere at
once) and **Suspend** (also signs them out). A manager cannot reset
another manager's password or the owner's — that would be a way to take
over the account.

Because you set the password, you can sign in as them to see exactly
their screen. Store Managers sign in on the phone app, not the panel.

Made while testing this, on the test site only:

| Name | Desk | Sign in with | Password |
| --- | --- | --- | --- |
| Brenda Achieng | Cashier | 0789555101 | `NewPass2026` |
| Ronald Ssali | Store Manager — app | 0789555102 | `Shelves2026` |
| Joan Namutebi | Store Manager — app | 0789555103 | `Shelves-Joan-77` |

### A company account

For testing the app's company screen, where a contractor buys on
account and lets their people order on it.

| | |
| --- | --- |
| Username | `ahcompanyowner` |
| Phone | +256770999111 |
| Signs in by | SMS code |
| Code in test mode | `123456` |

### Customers

Customers look around without an account and sign in on the cart page to
order: with an SMS code (a new number gives a name and the account is
made) or with an email and password. Their usernames look like `ah256770111002`, which is the number
with the punctuation taken out.

### The account for Google Play's reviewers

They cannot receive an SMS in Kampala, so they get a password.

- On the test site: `tester@example.com` / `Review2026!`
- On the live shop: **Users → Add New**, role **Customer**, an email you
  own and a new password. Put those under **Play Console → App content →
  App access**, and say: *Account → Sign in → Password*. Never give
  Google a staff account.

### One app, two sides

Everybody signs in from **Account → Sign in**. A customer stays in the
shop. A Store Manager, Cashier, Accounts or Manager login turns the app
into their desk, with its own dark bar and no way back to the shop
except **Account → Sign out**. A sign-in lasts 12 hours.

---

## Running it here

Docker must be up first — the panel has nothing to talk to without it.

```
docker start ah-mysql
docker start ah-wp

cd d:\hardwareApp\web
npm run build
npm start
```

Then:

| | |
| --- | --- |
| Staff panel | http://localhost:3000 |
| WordPress | http://localhost:8080/wp-admin |

**Point the panel at the right shop before you build.** `web/.env.local`
decides, and it is read at *build* time, not when the server starts:

```
NEXT_PUBLIC_API_URL=http://localhost:8080     # the test site here
NEXT_PUBLIC_API_URL=https://pearlfx.online    # the real shop
```

Change it, then build again. Changing it and only restarting does
nothing.

### If the panel loads with no styling at all

A server left running from an older build. Its page asks for a
stylesheet that the new build replaced, so the browser gets a 404 and
you see raw HTML. Stop it, build, start it again — in that order.

---

## The two ways in

Both end in the same place. The API decides which desk somebody
belongs to; the panel only knows where each desk lives.

**A password.** Phone number or email, plus the password. For staff who
work at a counter all day.

**A code by SMS.** For the cashier who has forgotten a password at seven
in the morning and should not have to find the manager. The code goes
to the number on the account and lasts five minutes.

In test mode the server hands the code straight back to the screen, so
nobody has to wire up an SMS gateway to try the app. On the live shop
it is texted, and the settings page is where the gateway is configured.

---

## Making the real accounts on pearlfx.online

None of the test passwords exist there. This is the part to do once,
on the live site.

1. **Install the plugin.** Upload
   `wordpress/al-hadeed-hardware.zip` under **Plugins → Add New →
   Upload Plugin**, then activate it. Activating is what creates the
   four desk roles.

2. **Put something on the shelf.** **Al Hadeed → Import products →
   *Put 25 sample products on the shelf*.** Twenty-five things an
   ironmonger actually sells, with prices, units and pictures. Change
   the prices before you trade — they are in the right range but they
   are a starting point. Or import your own spreadsheet from
   **Products → Import** in the panel.

3. **Make a person for each desk.** **Users → Add New**, once per
   member of staff, with the matching role:

   | Role to pick | What they get |
   | --- | --- |
   | Cashier | The payment queue, receipts, the cash book to read, end of day |
   | Accounts | Verifying payments, the cash book, reconciliation, reports |
   | Store Manager | The pick list and releasing goods — on the phone |
   | Manager | All of it, plus products, staff, customers and the audit trail |

4. **Put their phone number on the account.** Edit the user and fill in
   the phone field. Without it they cannot use the SMS code, and the
   customer texts will not reach them.

5. **Switch SMS on (EgoSMS).** **Al Hadeed → Settings → SMS**: gateway
   **EgoSMS**, then the API username and API password from
   comms.egosms.co → Settings → API Settings, and the sender ID EgoSMS
   approved. Save, use **Send a test SMS**, and when it arrives untick
   **Test mode** and save again. Left ticked, every code is `123456`.

6. **Check the shop's own settings.** **Al Hadeed → Settings** — the
   shop name, the currency and the SMS gateway. The name appears on
   every receipt and on the sign-in screen, so a shop still called "My
   Blog" is the first thing anybody will notice.

Your WordPress administrator account already works in the panel, so
there is a way in from the moment the plugin is active.

---

## When somebody leaves

Suspend rather than delete. **Users → edit the person → set their
status to suspended.** They can no longer sign in anywhere, and every
order they ever handled still has their name against it.

Deleting the account takes that name off the audit trail, which is the
one record that exists for answering "who did that, and when" — the
question nobody asks until something has gone wrong.
