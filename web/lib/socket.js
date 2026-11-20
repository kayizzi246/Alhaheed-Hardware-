'use client';
import { io } from 'socket.io-client';
import { API_BASE, getToken } from './api';

let socket = null;

/** One shared socket per browser tab, authenticated with the JWT. */
export function getSocket() {
  if (typeof window === 'undefined') return null;
  const token = getToken();
  if (!token) return null;
  if (!socket) {
    socket = io(API_BASE, { auth: { token }, transports: ['websocket', 'polling'] });
  }
  return socket;
}

export function closeSocket() {
  socket?.disconnect();
  socket = null;
}
