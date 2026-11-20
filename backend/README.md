# Backend — Al Hadeed Hardware API

Node.js + Express, PostgreSQL via the built-in `pg`, Socket.IO for
real-time order hand-off.

## Run

```bash
npm install
npm run db:reset    # fresh database with demo data
npm run dev         # watch mode on :4000
npm test            # end-to-end tests
```

Health check: <http://localhost:4000/api/health>

## Layout

```
src/
  config.js            environment settings
  app.js               express app, route mounting
  server.js            http server + socket.io
  realtime.js          socket rooms: user:<id>, role:<role>, company:<id>
  db/
    schema.sql         the whole data model
    index.js           all / get / run / tx / counters  ← the only SQL surface
    seed.js            demo data: staff, catalogue, orders at each stage
    reset.js           wipe and reseed
  middleware/
    auth.js            authenticate, requireRole, requireCompanyOwner
    validate.js        zod body validation
    error.js           consistent error responses
  services/
    orders.js          the order lifecycle and every rule it enforces
  routes/              one file per side: cashier, accounts, store, manager, company…
  utils/               tokens, audit trail, notifications, money
tests/
  flow.test.js         14 end-to-end tests
```

## Where the rules live

Almost all business logic is in
[src/services/orders.js](src/services/orders.js) — placing, paying, verifying,
releasing and cancelling. Each is wrapped in a transaction, writes to the audit
trail, sends notifications and emits the real-time event. The route files are
thin: validate, call the service, return JSON.

See [../docs/ORDER_FLOW.md](../docs/ORDER_FLOW.md) for the rules themselves.
