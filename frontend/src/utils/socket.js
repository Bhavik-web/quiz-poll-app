import { io } from 'socket.io-client';

// Use env var or fallback to deployed backend URL
const rawUrl = import.meta.env.VITE_BACKEND_URL || 'https://quizpoll-backend.onrender.com';
const SOCKET_URL = rawUrl.replace(/\/+$/, '');

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  transports: ['websocket'],       // Match server config — skip HTTP long-polling
  reconnectionAttempts: 10,        // Don't retry forever (prevents zombie connections)
  reconnectionDelay: 1000,         // Start retrying at 1 second
  reconnectionDelayMax: 10000,     // Cap reconnection delay at 10 seconds
  timeout: 20000,                  // Connection timeout
});
