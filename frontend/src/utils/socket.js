import { io } from 'socket.io-client';

// Use env var or fallback to deployed backend URL
const rawUrl = import.meta.env.VITE_BACKEND_URL || 'https://quizpoll-backend.onrender.com';
const SOCKET_URL = rawUrl.replace(/\/+$/, '');

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  transports: ['polling', 'websocket'],  // Start with polling, upgrade to websocket
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000,
  timeout: 20000,
  withCredentials: false,
});
