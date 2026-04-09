import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';
import Room from '../models/Room.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret_demo_key_123', { expiresIn: '30d' });
};

// @route   POST /api/admin/register
router.post('/register', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const adminExists = await Admin.findOne({ email });
    if (adminExists) {
      return res.status(400).json({ message: 'Admin already exists' });
    }
    const admin = await Admin.create({ email, password });
    res.status(201).json({
      _id: admin._id,
      email: admin.email,
      token: generateToken(admin._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/admin/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const admin = await Admin.findOne({ email });
    if (admin && (await admin.matchPassword(password))) {
      res.json({
        _id: admin._id,
        email: admin.email,
        token: generateToken(admin._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/admin/rooms
router.get('/rooms', protect, async (req, res) => {
  try {
    const rooms = await Room.find({ admin: req.admin._id }).select('-participants');
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/admin/rooms
router.post('/rooms', protect, async (req, res) => {
  const { name } = req.body;
  
  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Room name is required' });
  }

  try {
    // Generate 6-char random code
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const room = await Room.create({
      roomCode,
      name,
      admin: req.admin._id,
      questions: []
    });
    res.status(201).json(room);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/admin/rooms/:id
router.get('/rooms/:id', protect, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room || room.admin.toString() !== req.admin._id.toString()) {
      return res.status(404).json({ message: 'Room not found' });
    }
    res.json(room);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/admin/rooms/:id/questions
router.post('/rooms/:id/questions', protect, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room || room.admin.toString() !== req.admin._id.toString()) {
      return res.status(404).json({ message: 'Room not found' });
    }
    room.questions.push(req.body);
    await room.save();
    res.status(201).json(room);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/admin/rooms/:id/questions/:questionId
router.put('/rooms/:id/questions/:questionId', protect, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room || room.admin.toString() !== req.admin._id.toString()) {
      return res.status(404).json({ message: 'Room not found' });
    }
    const qIndex = room.questions.findIndex(q => q._id.toString() === req.params.questionId);
    if (qIndex > -1) {
      room.questions[qIndex] = { ...room.questions[qIndex].toObject(), ...req.body };
      await room.save();
      res.json(room);
    } else {
      res.status(404).json({ message: 'Question not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/admin/rooms/:id/questions/:questionId
router.delete('/rooms/:id/questions/:questionId', protect, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room || room.admin.toString() !== req.admin._id.toString()) {
      return res.status(404).json({ message: 'Room not found' });
    }
    room.questions = room.questions.filter(q => q._id.toString() !== req.params.questionId);
    await room.save();
    res.json(room);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/admin/rooms/:id
router.delete('/rooms/:id', protect, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room || room.admin.toString() !== req.admin._id.toString()) {
      return res.status(404).json({ message: 'Room not found' });
    }
    await Room.deleteOne({ _id: room._id });
    res.json({ message: 'Room removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
