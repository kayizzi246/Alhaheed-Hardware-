import { io } from 'socket.io-client';
import { API_URL, getToken } from './api';

let socket = null;

export function connectSocket() {
  const token = getToken();
  if (!token) return null;
  if (socket) return socket;
  socket = io(API_URL, { auth: { token }, transports: ['websocket'] });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export const getSocket = () => socket;
