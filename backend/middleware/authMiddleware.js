import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';

// ── Simple LRU cache for admin lookups ──
// Avoids hitting the database on every authenticated API call.
// TTL: 5 minutes — after that, the admin is re-fetched from DB.
const adminCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_demo_key_123');

      // Check cache first — avoid DB query
      const cached = adminCache.get(decoded.id);
      if (cached && Date.now() - cached.time < CACHE_TTL) {
        req.admin = cached.data;
        return next();
      }

      // Cache miss — query DB and cache the result
      const admin = await Admin.findById(decoded.id).select('-password');
      if (!admin) {
        return res.status(401).json({ message: 'Admin not found' });
      }

      adminCache.set(decoded.id, { data: admin, time: Date.now() });
      req.admin = admin;

      return next();
    } catch (error) {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};
