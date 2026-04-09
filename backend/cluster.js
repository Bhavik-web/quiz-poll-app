// ══════════════════════════════════════════════════════
// CLUSTER MODE (Optional)
// ══════════════════════════════════════════════════════
// Spawns multiple worker processes to utilize all CPU cores.
// Run with: npm run cluster
//
// IMPORTANT: If you use cluster mode with Socket.io, you need
// a shared adapter (e.g., @socket.io/cluster-adapter or Redis adapter)
// to ensure events are broadcast across all workers.
//
// For most free-tier deployments (1-2 CPU cores), single-process
// mode with the in-memory cache is sufficient for 1500 users.
// Only use this if you need to go beyond ~2000 concurrent users
// on a multi-core machine.
// ══════════════════════════════════════════════════════

import cluster from 'node:cluster';
import os from 'node:os';

// Limit to available cores (free tiers usually have 1-2)
const numCPUs = Math.min(os.cpus().length, 2);

if (cluster.isPrimary) {
  console.log(`Primary process ${process.pid} spawning ${numCPUs} workers`);
  console.log(`Total CPU cores available: ${os.cpus().length}`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died (code: ${code}, signal: ${signal}). Restarting...`);
    cluster.fork();
  });

  cluster.on('online', (worker) => {
    console.log(`Worker ${worker.process.pid} is online`);
  });
} else {
  // Each worker runs the full Express + Socket.io server
  import('./server.js');
}
