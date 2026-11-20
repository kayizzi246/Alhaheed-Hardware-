-- =====================================================================
-- AL HADEED HARDWARE - ORDERING & CASH BOOKING SYSTEM
-- Database schema (SQLite dialect, MVP / Phase 1)
-- =====================================================================
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------
-- CUSTOMER ACCOUNTS (Individual & Company)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name    TEXT    NOT NULL,
  tin             TEXT,
  contact_person  TEXT,
  phone           TEXT    NOT NULL,
  email           TEXT,
  address         TEXT,
  status          TEXT    NOT NULL DEFAULT 'active',   -- active | suspended
  date_registered TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Every human that can log in: customers AND staff.
CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name      TEXT    NOT NULL,
  phone          TEXT    NOT NULL UNIQUE,
  email          TEXT    UNIQUE,
  password_hash  TEXT,                                 -- staff login; customers use OTP
  -- role: customer | cashier | accounts | store | manager
  role           TEXT    NOT NULL,
  -- account_type applies to role='customer': individual | company_owner | company_staff
  account_type   TEXT    NOT NULL DEFAULT 'individual',
  company_id     INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  staff_role     TEXT,                                 -- company's own label: cashier, buyer, site supervisor
  spending_limit INTEGER,                              -- per-order limit for company staff, in minor currency unit
  status         TEXT    NOT NULL DEFAULT 'active',    -- active | suspended
  added_by       INTEGER REFERENCES users(id),
  tin            TEXT,
  address        TEXT,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_role    ON users(role);

-- One-time passwords for customer phone login
CREATE TABLE IF NOT EXISTS otp_codes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  phone      TEXT    NOT NULL,
  code       TEXT    NOT NULL,
  expires_at TEXT    NOT NULL,
  consumed   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone);

-- ---------------------------------------------------------------------
-- PRODUCTS & STOCK
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS products (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  code            TEXT    NOT NULL UNIQUE,
  name            TEXT    NOT NULL,
  category_id     INTEGER REFERENCES categories(id),
  description     TEXT,
  unit            TEXT    NOT NULL DEFAULT 'pc',       -- bag, pc, length, litre...
  price           INTEGER NOT NULL,                    -- UGX, whole shillings
  picture         TEXT,
  stock_available INTEGER NOT NULL DEFAULT 0,
  reorder_level   INTEGER NOT NULL DEFAULT 0,
  supplier        TEXT,
  remarks         TEXT,
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_name     ON products(name);

-- Price change history (Manager side)
CREATE TABLE IF NOT EXISTS price_changes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  old_price  INTEGER NOT NULL,
  new_price  INTEGER NOT NULL,
  changed_by INTEGER NOT NULL REFERENCES users(id),
  changed_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Every stock movement: goods received, release, adjustment
CREATE TABLE IF NOT EXISTS stock_movements (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement     TEXT    NOT NULL,     -- goods_received | release | adjustment
  quantity     INTEGER NOT NULL,     -- signed: +in, -out
  stock_before INTEGER NOT NULL,
  stock_after  INTEGER NOT NULL,
  order_id     INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  supplier     TEXT,
  reason       TEXT,
  handled_by   INTEGER NOT NULL REFERENCES users(id),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_stock_product ON stock_movements(product_id);

-- ---------------------------------------------------------------------
-- ORDERS
-- ---------------------------------------------------------------------
-- status: pending_payment -> paid -> payment_verified -> released
--         plus: cancelled | rejected | refunded
CREATE TABLE IF NOT EXISTS orders (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no         TEXT    NOT NULL UNIQUE,            -- #AH-10427
  customer_id      INTEGER NOT NULL REFERENCES users(id),
  company_id       INTEGER REFERENCES companies(id),
  status           TEXT    NOT NULL DEFAULT 'pending_payment',
  current_stage    TEXT    NOT NULL DEFAULT 'cashier', -- cashier | accounts | store | done
  subtotal         INTEGER NOT NULL DEFAULT 0,
  delivery_fee     INTEGER NOT NULL DEFAULT 0,
  total            INTEGER NOT NULL DEFAULT 0,
  fulfilment       TEXT    NOT NULL DEFAULT 'pickup',  -- pickup | delivery
  delivery_address TEXT,
  notes            TEXT,
  cancel_reason    TEXT,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_status   ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_company  ON orders(company_id);
CREATE INDEX IF NOT EXISTS idx_orders_created  ON orders(created_at);

CREATE TABLE IF NOT EXISTS order_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products(id),
  product_name TEXT   NOT NULL,                        -- snapshot at order time
  unit        TEXT    NOT NULL,
  quantity    INTEGER NOT NULL,
  unit_price  INTEGER NOT NULL,                        -- snapshot at order time
  line_total  INTEGER NOT NULL,
  qty_released INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);

-- Full audit trail: who handled the order, when, at which desk
CREATE TABLE IF NOT EXISTS order_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  stage      TEXT    NOT NULL,       -- customer | cashier | accounts | store | manager
  action     TEXT    NOT NULL,       -- placed | payment_received | verified | rejected | released | cancelled | refunded
  from_status TEXT,
  to_status  TEXT,
  handled_by INTEGER REFERENCES users(id),
  handler_name TEXT,
  notes      TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_order ON order_events(order_id);

-- ---------------------------------------------------------------------
-- PAYMENTS, RECEIPTS, CASH BOOK
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id        INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  receipt_no      TEXT    NOT NULL UNIQUE,             -- R-00843
  amount_due      INTEGER NOT NULL,
  amount_paid     INTEGER NOT NULL,
  method          TEXT    NOT NULL,                    -- cash | mobile_money | card
  transaction_ref TEXT,
  cashier_id      INTEGER NOT NULL REFERENCES users(id),
  cashier_name    TEXT    NOT NULL,
  verified        INTEGER NOT NULL DEFAULT 0,          -- 0 pending, 1 verified, -1 rejected
  verified_by     INTEGER REFERENCES users(id),
  verifier_name   TEXT,
  verified_at     TEXT,
  verify_remarks  TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_payments_order    ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_verified ON payments(verified);

-- Accounts cash book: cash in / cash out with running balance
CREATE TABLE IF NOT EXISTS cash_book (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_date  TEXT    NOT NULL DEFAULT (date('now')),
  details     TEXT    NOT NULL,
  cash_in     INTEGER NOT NULL DEFAULT 0,
  cash_out    INTEGER NOT NULL DEFAULT 0,
  method      TEXT,
  order_id    INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  payment_id  INTEGER REFERENCES payments(id) ON DELETE SET NULL,
  recorded_by INTEGER NOT NULL REFERENCES users(id),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cashbook_date ON cash_book(entry_date);

CREATE TABLE IF NOT EXISTS refunds (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount      INTEGER NOT NULL,
  reason      TEXT,
  status      TEXT    NOT NULL DEFAULT 'requested',    -- requested | approved | declined
  requested_by INTEGER REFERENCES users(id),
  decided_by  INTEGER REFERENCES users(id),
  decided_at  TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- NOTIFICATIONS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT,                                     -- broadcast to a desk when user_id is null
  title      TEXT    NOT NULL,
  body       TEXT,
  order_id   INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  read       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notif_role ON notifications(role, read);

-- Counter table so order/receipt numbers never collide
CREATE TABLE IF NOT EXISTS counters (
  name  TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);
INSERT OR IGNORE INTO counters(name, value) VALUES ('order', 10400), ('receipt', 800);
