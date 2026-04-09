import mongoose from 'mongoose';

const responseSchema = new mongoose.Schema({
  roomCode: {
    type: String,
    required: true,
    index: true
  },
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true
  },
  selectedOption: {
    type: String,
    required: true
  },
  isCorrect: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Compound index for fast lookups: "get all responses for a question in a room"
responseSchema.index({ roomCode: 1, questionId: 1 });

// Unique constraint: one answer per user per question per room
responseSchema.index({ roomCode: 1, questionId: 1, userId: 1 }, { unique: true });

export default mongoose.model('Response', responseSchema);
