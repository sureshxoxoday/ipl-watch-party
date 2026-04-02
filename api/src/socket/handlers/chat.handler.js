const Message = require('../../models/Message');
const Room = require('../../models/Room');

// Simple in-memory rate limit: 1 message per 1.5s per user
const lastMsg = new Map();

module.exports = function registerChatHandlers(io, socket) {
  socket.on('disconnect', () => {
    lastMsg.delete(socket.user.sub);
  });

  socket.on('send_message', async ({ roomId, content }) => {
    if (!content?.trim() || content.length > 500) return;
    if (!socket.rooms.has(roomId)) return; // must be in the room

    // Rate limit
    const now = Date.now();
    if (now - (lastMsg.get(socket.user.sub) || 0) < 1500) return;
    lastMsg.set(socket.user.sub, now);

    try {
      const room = await Room.findOne({ match_id: roomId })
        .select('balls_bowled status')
        .lean({ virtuals: true });
      if (!room) return;

      const msg = await Message.create({
        room_id: roomId,
        user_id: socket.user.sub,
        username: socket.user.username,
        avatar_color: socket.user.avatar_color,
        content: content.trim(),
        type: 'text',
        over: room.current_over,
      });

      io.to(roomId).emit('new_message', {
        _id: msg._id,
        username: msg.username,
        avatar_color: msg.avatar_color,
        content: msg.content,
        type: 'text',
        over: msg.over,
        created_at: msg.created_at,
      });
    } catch (err) {
      console.error('chat error:', err.message);
    }
  });
};
