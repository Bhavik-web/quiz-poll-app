import { io } from 'socket.io-client';

// Use env var or fallback to deployed backend URL
const rawUrl = import.meta.env.VITE_BACKEND_URL || 'https://quizpoll-backend.onrender.com';
const SOCKET_URL = rawUrl.replace(/\/+$/, '');

console.log('[Socket] Connecting to:', SOCKET_URL);

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  transports: ['polling', 'websocket'],
  reconnectionAttempts: 15,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000,
  timeout: 30000,
  withCredentials: false,
  forceNew: false,
});

socket.on('connect', () => {
  console.log('[Socket] Connected! ID:', socket.id);
});

socket.on('connect_error', (err) => {
  console.error('[Socket] Connection error:', err.message);
});

socket.on('disconnect', (reason) => {
  console.log('[Socket] Disconnected:', reason);
});
