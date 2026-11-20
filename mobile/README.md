# Mobile App — all five sides

One React Native (Expo) app. The role on the login decides which side opens:
customers shop, and each staff member sees only their own desk.

## Run

```bash
npm install
npm start        # then scan the QR code with Expo Go
```

**On a real phone,** set the API to your computer's LAN address — `localhost`
on a phone means the phone:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.14:4000 npm start
```

## Sides

| Role | Tabs |
| --- | --- |
| Customer | Shop · Cart · Orders · Company (company accounts only) · Account |
| Cashier | Queue · Receipts · Alerts · Profile |
| Accounts | Verify · Cash Book · Reports · Profile |
| Store Manager | Release · Stock · Alerts · Profile |
| Manager | Dashboard · Orders · Products · Staff · Reports |

Routing is in [src/navigation/index.js](src/navigation/index.js) — `RoleRouter`
picks the tab set from `user.role`.

## Layout

```
src/
  lib/
    api.js           fetch wrapper, token storage, 401 handling
    AuthContext.js   session, sign in / out, socket lifecycle
    CartContext.js   the customer's cart
    socket.js        one Socket.IO connection per session
    theme.js         colours and spacing
    format.js        money, dates, status labels
  components/ui.js   Screen, Card, Button, Chip, Field, Input, Stat…
  screens/
    customer/        Shop, Product, Cart, Orders, OrderTrack, Company, Account
    cashier/         Queue, Receipts
    accounts/        Verify, CashBook
    store/           Release queue, Stock
    manager/         Dashboard, Orders, OrderDetail, Products, Staff, Reports
  navigation/        role-based tab and stack navigators
```

## Prototype screens

| Concept paper | Screen |
| --- | --- |
| Fig 1 — Product List | `customer/ShopScreen.js` |
| Fig 2 — Cart & Place Order | `customer/CartScreen.js` |
| Fig 3 — Live Order Tracking | `customer/OrderTrackScreen.js` |
| Fig 4 — Company Owner: Staff & All Orders | `customer/CompanyScreen.js` |
| Fig 5 — Cashier Payment Queue | `cashier/CashierQueueScreen.js` |
| Fig 6 — Store: Release Goods & Stock | `store/StoreQueueScreen.js`, `store/StockScreen.js` |
| Fig 7 — Manager Dashboard | `manager/DashboardScreen.js` |
