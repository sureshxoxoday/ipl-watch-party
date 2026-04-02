const { Server } = require('socket.io');
const socketAuth = require('../middleware/socketAuth');
const { redis } = require('../config/redis');
const registerChatHandlers = require('./handlers/chat.handler');
const registerReactionHandlers = require('./handlers/reaction.handler');
const registerPollHandlers = require('./handlers/poll.handler');
const Room = require('../models/Room');

module.exports = function setupSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.use(socketAuth);

  io.on('connection', (socket) => {
    console.log(`[socket] ${socket.user.username} connected`);

    socket.on('join_room', async (matchId, inviteCode) => {
      // For private rooms, verify invite code before allowing join
      const roomDoc = await Room.findOne({ match_id: matchId }).lean();
      if (roomDoc?.isPrivate) {
        const isOwner = roomDoc.owner_id?.toString() === socket.user.id;
        if (!isOwner && roomDoc.inviteCode !== inviteCode) {
          socket.emit('error', { message: 'Invalid invite code' });
          return;
        }
      }

      // Leave any previously joined match rooms
      for (const room of socket.rooms) {
        if (room !== socket.id && !room.startsWith('scores:')) {
          socket.leave(room);
          const cnt = Math.max(0, ((await redis.decr(`online:${room}`)) || 0));
          io.to(room).emit('online_count', cnt);
        }
      }

      socket.join(matchId);
      socket.currentRoom = matchId;

      // Private rooms also join the linked public match's score channel
      if (roomDoc?.isPrivate && roomDoc?.linked_match_id) {
        socket.join(`scores:${roomDoc.linked_match_id}`);
      }

      const count = await redis.incr(`online:${matchId}`);
      io.to(matchId).emit('online_count', count);

      console.log(`[socket] ${socket.user.username} joined ${matchId}${roomDoc?.isPrivate ? ' (private)' : ''}`);
    });

    registerChatHandlers(io, socket);
    registerReactionHandlers(io, socket);
    registerPollHandlers(io, socket);

    socket.on('disconnect', async () => {
      if (socket.currentRoom) {
        const cnt = Math.max(0, ((await redis.decr(`online:${socket.currentRoom}`)) || 0));
        io.to(socket.currentRoom).emit('online_count', cnt);
      }
      console.log(`[socket] ${socket.user.username} disconnected`);
    });
  });

  return io;
};
