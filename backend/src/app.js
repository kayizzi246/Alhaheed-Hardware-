import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { migrate } from './db/index.js';
import { notFoundHandler, errorHandler } from './middleware/error.js';

import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import cashierRoutes from './routes/cashier.js';
import accountsRoutes from './routes/accounts.js';
import storeRoutes from './routes/store.js';
import managerRoutes from './routes/manager.js';
import companyRoutes from './routes/company.js';
import reportRoutes from './routes/reports.js';
import notificationRoutes from './routes/notifications.js';

export function createApp() {
  migrate();

  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(
    cors({
      origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
      credentials: true,
    })
  );

  app.get('/api/health', (_req, res) =>
    res.json({ ok: true, shop: config.shopName, currency: config.currency, time: new Date().toISOString() })
  );

  app.use('/api/auth', authRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/cashier', cashierRoutes);
  app.use('/api/accounts', accountsRoutes);
  app.use('/api/store', storeRoutes);
  app.use('/api/manager', managerRoutes);
  app.use('/api/company', companyRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/notifications', notificationRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
