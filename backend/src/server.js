import http from 'node:http';
import { createApp } from './app.js';
import { initRealtime } from './realtime.js';
import { config } from './config.js';

const app = createApp();
const server = http.createServer(app);
initRealtime(server);

server.listen(config.port, () => {
  console.log(`\n  ${config.shopName} API`);
  console.log(`  http://localhost:${config.port}/api/health`);
  console.log(`  realtime: socket.io on the same port`);
  console.log(`  database: ${config.dbFile}\n`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
