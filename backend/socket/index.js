import Room from '../models/Room.js';
import Response from '../models/Response.js';

// ═══════════════════════════════════════════════════════════════
// IN-MEMORY ROOM CACHE
// Instead of hitting MongoDB on every socket event, we cache
// active room state in memory and periodically flush to DB.
// This reduces DB queries from ~1500/event to ~1 every 10 seconds.
// ═══════════════════════════════════════════════════════════════
const roomCache = new Map(); // key: roomCode, value: room-like plain object
const dirtyRooms = new Set(); // rooms that need to be persisted

/**
 * Load a room from cache or DB. Returns a plain JS object (not a Mongoose doc).
 */
async function loadRoom(roomCode) {
  if (roomCache.has(roomCode)) return roomCache.get(roomCode);
  const room = await Room.findOne({ roomCode }).lean();
  if (!room) return null;

  // Initialize in-memory responses array (loaded separately for active rooms)
  if (!room.responses) {
    room.responses = [];
  }

  // Load existing responses from the Response collection for active sessions
  if (room.status === 'active' || room.status === 'waiting') {
    try {
      const existingResponses = await Response.find({ roomCode }).lean();
      room.responses = existingResponses.map(r => ({
        userId: r.userId,
        questionId: r.questionId,
        selectedOption: r.selectedOption,
        isCorrect: r.isCorrect,
        timestamp: r.createdAt
      }));
    } catch (err) {
      console.error(`Failed to load responses for room ${roomCode}:`, err);
      room.responses = [];
    }
  }

  roomCache.set(roomCode, room);
  return room;
}

/**
 * Mark a room as dirty so it will be persisted on the next flush cycle.
 */
function markDirty(roomCode) {
  dirtyRooms.add(roomCode);
}

/**
 * Flush dirty rooms to the database.
 * Runs every 10 seconds to batch writes.
 */
async function flushDirtyRooms() {
  for (const code of dirtyRooms) {
    const cached = roomCache.get(code);
    if (!cached) continue;
    try {
      await Room.findOneAndUpdate(
        { roomCode: code },
        {
          $set: {
            status: cached.status,
            currentQuestionIndex: cached.currentQuestionIndex,
            showResults: cached.showResults,
            participants: cached.participants,
          }
        }
      );
    } catch (err) {
      console.error(`Failed to persist room ${code}:`, err);
    }
  }
  dirtyRooms.clear();
}

// Periodic flush interval — persist dirty rooms every 10 seconds
const flushInterval = setInterval(flushDirtyRooms, 10_000);

// Ensure cleanup on process exit
process.on('SIGTERM', async () => {
  clearInterval(flushInterval);
  await flushDirtyRooms();
  process.exit(0);
});

process.on('SIGINT', async () => {
  clearInterval(flushInterval);
  await flushDirtyRooms();
  process.exit(0);
});

// ═══════════════════════════════════════════════════════════════
// SOCKET HANDLERS
// ═══════════════════════════════════════════════════════════════
export const socketHandlers = (io) => {
  io.on('connection', (socket) => {
    // ── PARTICIPANT: Join Room ──
    socket.on('join_room', async ({ roomCode, userId }, callback) => {
      try {
        const code = roomCode.toUpperCase();
        const room = await loadRoom(code);
        if (!room) return callback({ error: 'Room not found' });

        // Join the socket.io room
        socket.join(code);

        // Add participant if not already present (in-memory only, no DB call)
        if (!room.participants.find(p => p.id === userId)) {
          room.participants.push({ id: userId, score: 0, joinedAt: new Date() });
          markDirty(code);
        }

        // Build current question payload (strip correctAnswer for participants)
        let currentQuestion = null;
        if (room.currentQuestionIndex >= 0 && room.currentQuestionIndex < room.questions.length) {
          const q = room.questions[room.currentQuestionIndex];
          currentQuestion = {
            _id: q._id,
            type: q.type,
            text: q.text,
            options: q.options,
            timeLimit: q.timeLimit
          };
        }

        callback({
          success: true,
          status: room.status,
          currentQuestion,
          showResults: room.showResults,
          roomName: room.name
        });

        // Notify admin of updated participant count
        io.to(`admin_${code}`).emit('participant_update', room.participants.length);
      } catch (error) {
        callback({ error: error.message });
      }
    });

    // ── PARTICIPANT: Submit Answer ──
    socket.on('submit_answer', async ({ roomCode, userId, questionId, selectedOption }, callback) => {
      try {
        const room = await loadRoom(roomCode);
        if (!room) return callback({ error: 'Room not found' });
        if (room.status !== 'active') return callback({ error: 'No active question' });

        const question = room.questions.find(q => q._id.toString() === questionId);
        if (!question) return callback({ error: 'Question not found' });

        // Check duplicate answer (in-memory check — instant)
        const alreadyAnswered = room.responses.find(
          r => r.userId === userId && r.questionId.toString() === questionId
        );
        if (alreadyAnswered) return callback({ error: 'Already answered' });

        // Determine correctness
        let isCorrect = false;
        if (question.type === 'quiz') {
          isCorrect = (selectedOption === question.correctAnswer);
        }

        // Add response to in-memory cache
        room.responses.push({
          userId,
          questionId,
          selectedOption,
          isCorrect,
          timestamp: new Date()
        });

        // Update participant score in memory
        if (isCorrect) {
          const p = room.participants.find(p => p.id === userId);
          if (p) p.score += 10;
        }

        markDirty(roomCode);

        // Persist response to the separate Response collection (fire-and-forget)
        Response.create({
          roomCode,
          questionId,
          userId,
          selectedOption,
          isCorrect
        }).catch(err => {
          // Duplicate key error is expected if user somehow double-submits
          if (err.code !== 11000) {
            console.error('Failed to persist response:', err);
          }
        });

        // Send updated response count for this question to admin
        const responsesForQ = room.responses.filter(
          r => r.questionId.toString() === questionId
        );
        io.to(`admin_${roomCode}`).emit('responses_update', responsesForQ);

        callback({ success: true, isCorrect });
      } catch (error) {
        callback({ error: error.message });
      }
    });

    // ── ADMIN: Join Room Control ──
    socket.on('admin_join', async ({ roomCode }, callback) => {
      socket.join(`admin_${roomCode}`);
      try {
        const room = await loadRoom(roomCode);
        if (room) {
          callback({
            participantsCount: room.participants.length,
            responses: room.responses
          });
        }
      } catch (ex) {
        console.error(ex);
      }
    });

    // ── ADMIN: Start Session ──
    socket.on('admin_start_session', async ({ roomCode }, callback) => {
      try {
        const room = await loadRoom(roomCode);
        if (!room) return callback({ error: 'Room not found' });

        room.status = 'active';
        if (room.currentQuestionIndex === -1) {
          room.currentQuestionIndex = 0;
        }
        room.showResults = false;
        markDirty(roomCode);

        const q = room.questions[room.currentQuestionIndex];
        if (!q) {
          return callback({ error: 'No questions available in this room.' });
        }

        const currentQuestion = {
          _id: q._id,
          type: q.type,
          text: q.text,
          options: q.options,
          timeLimit: q.timeLimit
        };

        io.to(roomCode).emit('new_question', currentQuestion);
        callback({ success: true });
      } catch (ex) {
        callback({ error: ex.message });
      }
    });

    // ── ADMIN: Next Question ──
    socket.on('admin_next_question', async ({ roomCode, index }, callback) => {
      try {
        const room = await loadRoom(roomCode);
        if (!room) return callback({ error: 'Room not found' });

        room.currentQuestionIndex = index;
        room.showResults = false;
        markDirty(roomCode);

        const q = room.questions[index];
        if (!q) {
          return callback({ error: 'Question not found at the specified index.' });
        }

        const currentQuestion = {
          _id: q._id,
          type: q.type,
          text: q.text,
          options: q.options,
          timeLimit: q.timeLimit
        };

        io.to(roomCode).emit('new_question', currentQuestion);
        callback({ success: true });
      } catch (ex) {
        callback({ error: ex.message });
      }
    });

    // ── ADMIN: Show Results ──
    socket.on('admin_show_results', async ({ roomCode }, callback) => {
      try {
        const room = await loadRoom(roomCode);
        if (!room) return callback({ error: 'Room not found' });

        room.showResults = true;
        markDirty(roomCode);

        const q = room.questions[room.currentQuestionIndex];
        if (!q) {
          return callback({ error: 'No active question.' });
        }

        const questionId = q._id;
        const responses = room.responses.filter(
          r => r.questionId.toString() === questionId.toString()
        );

        io.to(roomCode).emit('show_results', { responses, correctAnswer: q.correctAnswer });
        callback({ success: true });
      } catch (ex) {
        callback({ error: ex.message });
      }
    });

    // ── ADMIN: End Session ──
    socket.on('admin_end_session', async ({ roomCode }, callback) => {
      try {
        const room = await loadRoom(roomCode);
        if (!room) return callback({ error: 'Room not found' });

        room.status = 'finished';
        markDirty(roomCode);

        // Build leaderboard from in-memory data
        const leaderboard = [...room.participants]
          .sort((a, b) => b.score - a.score)
          .slice(0, 10);

        io.to(roomCode).emit('session_ended', leaderboard);

        // Force immediate persist for finished rooms
        try {
          await Room.findOneAndUpdate(
            { roomCode },
            {
              $set: {
                status: 'finished',
                participants: room.participants,
              }
            }
          );
        } catch (err) {
          console.error('Failed to persist finished room:', err);
        }

        // Clean up cache for finished rooms — free memory
        dirtyRooms.delete(roomCode);
        roomCache.delete(roomCode);

        callback({ success: true });
      } catch (ex) {
        callback({ error: ex.message });
      }
    });

    socket.on('disconnect', () => {
      // No-op at scale — avoid per-connection logging
    });
  });
};
