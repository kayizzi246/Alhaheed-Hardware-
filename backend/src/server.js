import http from 'node:http';
import { createApp } from './app.js';
import { initRealtime } from './realtime.js';
import { config } from './config.js';
import { close as closeDb } from './db/index.js';

// createApp opens the database and runs the migration, so it has to
// finish before anything is served. Top-level await, so a failure here
// stops the process instead of serving a half-built API.
const app = await createApp();
const server = http.createServer(app);
initRealtime(server);

server.listen(config.port, () => {
  console.log(`\n  ${config.shopName} API`);
  console.log(`  http://localhost:${config.port}/api/health`);
  console.log(`  realtime: socket.io on the same port`);
  console.log(
    `  database: ${config.databaseUrl
      ? 'postgres (' + redact(config.databaseUrl) + ')'
      : 'pglite at ' + config.dataDir}\n`
  );
});

/** Never print the password that is sitting in the connection string. */
function redact(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`;
  } catch {
    return 'configured';
  }
}

const shutdown = () => {
  server.close(async () => {
    await closeDb().catch(() => {});
    process.exit(0);
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
