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

// Determine allowed origins
const allowedOrigins = process.env.FRONTEND_URL 
  ? [process.env.FRONTEND_URL, process.env.FRONTEND_URL.replace(/\/$/, '')]
  : true; // true = allow all origins

// ── Socket.io — tuned for 1500 concurrent connections ──
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: false
  },
  pingInterval: 25000,
  pingTimeout: 20000,
  maxHttpBufferSize: 1e5,
  transports: ['polling', 'websocket'],  // polling first for reliability
  perMessageDeflate: false,
  allowEIO3: true,
});

server.setMaxListeners(0);

// ── Middleware ──
app.use(compression());
app.use(cors({ origin: '*' }));  // Allow all origins for API
app.use(express.json({ limit: '100kb' }));

// ── Routes ──
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'API is running', version: 'v2.1', uptime: process.uptime() });
});

app.get('/', (req, res) => {
  res.send('API is running...');
});

// ── Socket.io handlers ──
socketHandlers(io);

// ── Start Server FIRST, then connect DB ──
const PORT = process.env.PORT || 5000;

// Start listening immediately so Render detects the port
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

// Connect to database after server is running
const connectDB = async () => {
  try {
    let mongoUri = process.env.MONGODB_URI;

    if (process.env.NODE_ENV === 'production') {
      if (!mongoUri) {
        console.error('ERROR: MONGODB_URI is required in production');
        return;
      }
      await mongoose.connect(mongoUri, {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
      });
      console.log('Connected to MongoDB Atlas');
    } else {
      try {
        if (mongoUri) {
          await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2000 });
          console.log('Connected to MongoDB');
        } else {
          throw new Error('No MONGODB_URI');
        }
      } catch {
        console.log('Starting in-memory MongoDB for development...');
        const { MongoMemoryServer } = await import('mongodb-memory-server');
        const mongod = await MongoMemoryServer.create();
        await mongoose.connect(mongod.getUri());
        console.log('Connected to in-memory MongoDB (dev mode)');
      }
    }

    // Pre-seed default admin account
    try {
      const adminExists = await Admin.findOne({ email: 'admin@admin.com' });
      if (!adminExists) {
        await Admin.create({ email: 'admin@admin.com', password: 'admin' });
        console.log('Pre-seeded default admin: admin@admin.com / admin');
      }
    } catch (err) {
      console.log('Could not seed admin', err);
    }
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
  }
};

connectDB();
