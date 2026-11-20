import { Server } from 'socket.io';
import { config } from './config.js';
import { verifyToken } from './utils/tokens.js';

let io = null;

/**
 * Socket.IO rooms:
 *   user:<id>   -> one signed-in person (order status updates)
 *   role:<role> -> a desk (cashier / accounts / store / manager queues)
 *   company:<id>-> a company owner watching all staff orders
 */
export function initRealtime(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: config.corsOrigins, credentials: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Missing token'));
    try {
      socket.data.user = verifyToken(token);
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const u = socket.data.user;
    socket.join(`user:${u.sub}`);
    socket.join(`role:${u.role}`);
    if (u.companyId) socket.join(`company:${u.companyId}`);
  });

  return io;
}

export const emitToUser = (userId, event, payload) =>
  io?.to(`user:${userId}`).emit(event, payload);

export const emitToRole = (role, event, payload) =>
  io?.to(`role:${role}`).emit(event, payload);

export const emitToCompany = (companyId, event, payload) =>
  companyId && io?.to(`company:${companyId}`).emit(event, payload);

/** Desks that watch the live order board. */
export function emitToDesks(event, payload) {
  ['cashier', 'accounts', 'store', 'manager'].forEach((r) => emitToRole(r, event, payload));
}
