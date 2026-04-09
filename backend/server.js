import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import compression from 'compression';
import adminRoutes from './routes/adminRoutes.js';
import { socketHandlers } from './socket/index.js';
import Admin from './models/Admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const server = http.createServer(app);

// ── Socket.io — tuned for 1500 concurrent connections ──
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  },
  pingInterval: 25000,        // How often to ping clients (ms)
  pingTimeout: 20000,         // How long to wait for pong response (ms)
  maxHttpBufferSize: 1e5,     // 100KB max message size (prevents abuse)
  transports: ['websocket'],  // Skip HTTP long-polling — saves memory & CPU
  allowUpgrades: false,       // No transport upgrade negotiation needed
  perMessageDeflate: false,   // Disable per-message compression (saves CPU at scale)
});

// Increase event listener limit for 1500+ socket connections
server.setMaxListeners(0);

// ── Middleware ──
app.use(compression());                           // Gzip responses — ~70% bandwidth reduction
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json({ limit: '100kb' }));        // Prevent oversized payload attacks

// ── Routes ──
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'API is running', uptime: process.uptime() });
});

// Base Route
app.get('/', (req, res) => {
  res.send('API is running...');
});

// ── Socket.io handlers ──
socketHandlers(io);

// ── DB Connection & Server Start ──
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    let mongoUri = process.env.MONGODB_URI;

    // Dev fallback: use in-memory MongoDB if no external DB is available
    if (!mongoUri || mongoUri.includes('127.0.0.1') || mongoUri.includes('localhost')) {
      try {
        // Try connecting to local MongoDB first
        if (mongoUri) {
          await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2000 });
          console.log('Connected to local MongoDB');
        } else {
          throw new Error('No MONGODB_URI set');
        }
      } catch {
        // Fall back to in-memory MongoDB for seamless dev experience
        console.log('Local MongoDB not available — starting in-memory server...');
        const { MongoMemoryServer } = await import('mongodb-memory-server');
        const mongod = await MongoMemoryServer.create();
        mongoUri = mongod.getUri();
        await mongoose.connect(mongoUri, {
          maxPoolSize: 10,
          bufferCommands: false,
        });
        console.log('Connected to in-memory MongoDB (dev mode)');
        console.log('⚠️  Data will be lost on restart. Use MongoDB Atlas for persistence.');
      }
    } else {
      // Production: connect to external MongoDB (Atlas, etc.)
      await mongoose.connect(mongoUri, {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        bufferCommands: false,
      });
      console.log('Connected to MongoDB');
    }

    // Pre-seed default admin account
    try {
      const adminExists = await Admin.findOne({ email: 'admin@admin.com' });
      if (!adminExists) {
        await Admin.create({ email: 'admin@admin.com', password: 'admin' });
        console.log('Pre-seeded default admin account: admin@admin.com / admin');
      }
    } catch (err) {
      console.log('Could not seed admin', err);
    }

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Socket.io transports: websocket only`);
      console.log(`Network: http://10.125.1.133:${PORT}`);
    });
  } catch (error) {
    console.log('MongoDB connection error:', error);
  }
};

startServer();
