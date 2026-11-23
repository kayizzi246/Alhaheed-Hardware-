# Backups, and keeping people out

What to back up, how, and the handful of things that actually get a
small shop's website broken into.

---

## Fix this one first

Your Users screen shows **`manager` with the role Administrator**.

An Administrator can install plugins, edit PHP, read the database,
change anyone's password and delete the site. The manager needs none
of that. The plugin creates a **Manager** role that holds exactly five
capabilities — read, and the four desks — and nothing else:

```
ah_manager    read, ah_desk_manager, ah_desk_cashier,
              ah_desk_accounts, ah_desk_store

manage_options   no
install_plugins  no
edit_files       no
edit_users       no
```

**Users → manager → Role → Manager → Update.** They keep every screen
they use; they lose the ability to take the shop down by accident or
to be used to take it down by somebody who gets their password.

Keep exactly one Administrator — the person who looks after the site.
Everyone else gets a desk.

---

## What is actually worth backing up

Five tables the plugin owns:

| Table | What is in it |
| --- | --- |
| `wp_ah_payments` | Every receipt: amount, method, reference, who took it, who verified it |
| `wp_ah_cash_book` | Cash in and out, with the running balance |
| `wp_ah_expenses` | Requests, approvals, and what was paid out |
| `wp_ah_events` | The audit trail — who did what, and when |
| `wp_ah_otp` | Sign-in codes. Short-lived; nothing lost if it goes |

And WooCommerce's, which hold the orders, the products and the
customers — `wp_posts`, `wp_postmeta`, `wp_wc_*`, `wp_users`,
`wp_usermeta`.

They are no use apart. An order in WooCommerce whose payment row is
missing is a sale nobody can account for, and a cash book with no
orders behind it is a column of numbers. **Back up the whole database,
not a few tables.**

Also back up `wp-content/uploads` — the product photographs live
there, and they are not in the database.

---

## How to back up

### The straightforward way

**UpdraftPlus** (free). Plugins → Add New → install → Settings →
UpdraftPlus Backups.

- Files **weekly**, database **daily**
- Keep **14**
- Send them to **Google Drive or Dropbox** — not to the server

That last point is the one people get wrong. A backup sitting in
`wp-content/` on the same machine is gone with the machine, and worse:
a backup folder that can be reached from a browser hands your entire
database to anybody who guesses the filename. Off-site, always.

### Also use the host's own backups

Whoever hosts pearlfx.online almost certainly takes nightly snapshots.
Find out, and find out **how far back they go** and **how to restore
one**. Two independent backups is the whole point — the one you
control and the one the host controls.

### Test a restore before you need one

A backup nobody has ever restored is a belief, not a backup. Once,
restore last night's to a staging site or a local copy and sign in. It
takes an hour and it is the only way to find out the file was
truncated, the plugin was excluded, or nobody knows the password to
the Google Drive it goes to.

Put a reminder in the calendar for six months' time to do it again.

---

## Keeping people out

In rough order of how often each one is what actually went wrong.

**1. Passwords.** `DeskTest123!` is on this project's test site. It
must never be on pearlfx.online. Every member of staff gets their own
password nobody else knows, or no password at all — the desks sign in
by SMS code, which is better, because there is nothing to share, write
down or reuse.

**2. Two-factor on the Administrator.** Install **WP 2FA** or
**Two-Factor** and turn it on for the admin account. A stolen
administrator password is the whole shop; a stolen one with 2FA is an
annoyance.

**3. Keep things updated.** This is not housekeeping. Vercel refused
to deploy this very project last week because the version of Next.js
it used had a published vulnerability — that is how fast a known hole
turns into a real one. Turn on automatic updates for WordPress,
WooCommerce and plugins, and look at the updates screen weekly.

**4. Limit login attempts.** **Limit Login Attempts Reloaded** (free).
Without it, anybody can try passwords against `/wp-login.php` all
night at any speed they like.

**5. HTTPS that actually works.** The site returned a Cloudflare 525 —
an SSL handshake failure between Cloudflare and your server — earlier
this week. While that is broken, passwords and session tokens can
cross the network in the open. Cloudflare → SSL/TLS: use **Full
(strict)** with a valid origin certificate, and make the apex domain
resolve as well as `www`.

**6. Stop file editing from the dashboard.** One line in
`wp-config.php`:

```php
define( 'DISALLOW_FILE_EDIT', true );
```

With it, somebody who gets into wp-admin still cannot write PHP
through the browser, which is the usual next step after a stolen
password.

**7. Suspend people, do not delete them.** When somebody leaves:
**Users → edit → status suspended**. They can no longer sign in, and
every order they handled keeps their name on it. Deleting the account
takes that name off the audit trail — the one record that exists for
answering "who did that", which is the question nobody asks until
something has gone wrong.

---

## What this system already does

Not everything is on you.

**Money cannot move without two people.** A cashier takes a payment,
accounts verifies it, the store releases the goods. An expense is
raised at one desk, approved by the manager, paid by the cashier. No
single person can take money out on their own.

**Everything is written down.** Every payment, verification, release,
cancellation, approval and payout goes into `wp_ah_events` with who
did it and when. It is readable on **Manager → Audit Trail**.

**The desk roles are minimal.** Five capabilities for a manager, two
for everybody else. A stolen cashier password gets somebody the
payment queue — not the plugins screen.

**Customers cannot see any internal screen.** Every desk route checks
a capability on the server, not just in the browser. A customer's
token on an expenses or cash book request gets 403.

**Uploaded pictures are checked by their contents.** A PHP file
renamed `photo.jpg` is refused. Trusting the extension is how a site
gets a web shell.

---

## If you think something has happened

1. Change the Administrator password, then every member of staff's.
2. Look at **Manager → Audit Trail** — it is time-stamped and names
   people. An entry nobody recognises is the thing to pull on.
3. Check **Users** for accounts nobody made, especially new
   Administrators.
4. Restore from the last backup you trust — which is why the dates
   matter, and why you test a restore before you need one.
