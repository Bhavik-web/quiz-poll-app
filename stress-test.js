// ══════════════════════════════════════════════════════
// k6 Stress Test Script
// ══════════════════════════════════════════════════════
// Tests WebSocket connections simulating up to 1500 concurrent users
//
// Prerequisites:
//   1. Install k6: https://k6.io/docs/get-started/installation/
//      Windows: choco install k6  (or winget install k6)
//      Mac: brew install k6
//      Linux: snap install k6
//
//   2. Start your backend server: cd backend && npm run dev
//
//   3. Create a test room via the admin UI and note the room code
//
// Usage:
//   k6 run --env ROOM_CODE=YOUR_CODE stress-test.js
//
// Custom options:
//   k6 run --env ROOM_CODE=ABC123 --env BACKEND_URL=ws://localhost:5000 stress-test.js
//
// Target metrics:
//   - WebSocket connection time: <3s at p95
//   - Answer acknowledgment: <500ms at p95
//   - Zero 5xx errors
//   - Memory stays below 400MB
// ══════════════════════════════════════════════════════

import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// Custom metrics
const wsConnections = new Counter('ws_connections_total');
const wsErrors = new Counter('ws_errors_total');
const joinLatency = new Trend('join_room_latency', true);
const answerLatency = new Trend('submit_answer_latency', true);

export const options = {
  stages: [
    { duration: '15s', target: 100 },    // Warm up to 100 users
    { duration: '30s', target: 500 },    // Ramp to 500
    { duration: '30s', target: 1000 },   // Ramp to 1000
    { duration: '30s', target: 1500 },   // Ramp to 1500
    { duration: '60s', target: 1500 },   // Hold at 1500 for 60 seconds
    { duration: '15s', target: 0 },      // Ramp down
  ],
  thresholds: {
    ws_connecting: ['p(95)<3000'],        // 95% connect within 3 seconds
    ws_errors_total: ['count<50'],        // Less than 50 total errors
    join_room_latency: ['p(95)<2000'],    // 95% join within 2 seconds
    submit_answer_latency: ['p(95)<500'], // 95% submit within 500ms
  },
};

const BACKEND_URL = __ENV.BACKEND_URL || 'ws://localhost:5000';
const ROOM_CODE = __ENV.ROOM_CODE || 'TEST01';

export default function () {
  const url = `${BACKEND_URL}/socket.io/?EIO=4&transport=websocket`;
  const userId = `k6_user_${__VU}_${__ITER}`;

  const res = ws.connect(url, {}, function (socket) {
    let joinStart;

    socket.on('open', () => {
      wsConnections.add(1);

      // Socket.io handshake (Engine.IO protocol)
      socket.send('40');

      // Wait for handshake acknowledgment
      sleep(0.5);

      // ── Join Room ──
      joinStart = Date.now();
      const joinPayload = JSON.stringify([
        'join_room',
        { roomCode: ROOM_CODE, userId: userId }
      ]);
      socket.send(`42${joinPayload}`);
    });

    socket.on('message', (data) => {
      // Track join response latency
      if (joinStart && data.includes('success')) {
        joinLatency.add(Date.now() - joinStart);
        joinStart = null;
      }

      // When we receive a new question, simulate answering it
      if (data.includes('new_question')) {
        // Simulate human think time (2-8 seconds)
        sleep(Math.random() * 6 + 2);

        // Extract question data (basic parsing)
        try {
          const payloadStr = data.replace(/^\d+/, '');
          const parsed = JSON.parse(payloadStr);
          const question = parsed[1] || parsed;

          if (question && question._id) {
            const answerStart = Date.now();
            const answerPayload = JSON.stringify([
              'submit_answer',
              {
                roomCode: ROOM_CODE,
                userId: userId,
                questionId: question._id,
                selectedOption: '1'  // Always pick option 1
              }
            ]);
            socket.send(`42${answerPayload}`);

            // Wait for acknowledgment
            socket.on('message', (ackData) => {
              if (ackData.includes('success') || ackData.includes('error')) {
                answerLatency.add(Date.now() - answerStart);
              }
            });
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }

      // Track errors
      if (data.includes('error')) {
        wsErrors.add(1);
      }
    });

    socket.on('error', (e) => {
      wsErrors.add(1);
    });

    // Keep connection alive for the test duration
    sleep(45);
  });

  check(res, {
    'WebSocket connected': (r) => r && r.status === 101,
  });
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

// Helper for text summary (if available)
function textSummary(data, opts) {
  try {
    // k6 has a built-in textSummary in newer versions
    const { textSummary } = require('https://jslib.k6.io/k6-summary/0.0.1/index.js');
    return textSummary(data, opts);
  } catch (e) {
    return JSON.stringify(data, null, 2);
  }
}
