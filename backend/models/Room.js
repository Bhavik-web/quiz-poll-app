import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['poll', 'quiz'],
    required: true
  },
  text: {
    type: String,
    required: true
  },
  options: [{
    id: String,
    text: String
  }],
  correctAnswer: { // Only needed for quiz
    type: String 
  },
  timeLimit: { // In seconds
    type: Number,
    default: 30
  }
});

// NOTE: responseSchema has been moved to models/Response.js
// Responses are now stored in a separate collection to prevent
// unbounded document growth in the Room document.


const participantSchema = new mongoose.Schema({
  id: String,
  joinedAt: {
    type: Date,
    default: Date.now
  },
  score: {
    type: Number,
    default: 0
  }
});

const roomSchema = new mongoose.Schema({
  roomCode: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['waiting', 'active', 'finished'],
    default: 'waiting'
  },
  currentQuestionIndex: {
    type: Number,
    default: -1 // -1 means no question is active
  },
  showResults: {
    type: Boolean,
    default: false
  },
  questions: [questionSchema],
  participants: [participantSchema]
  // NOTE: responses are now stored in the separate Response collection
  // to prevent unbounded document growth (see models/Response.js)
}, { timestamps: true });

export default mongoose.model('Room', roomSchema);
