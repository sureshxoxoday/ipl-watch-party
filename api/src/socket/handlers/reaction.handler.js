const { redis } = require('../../config/redis');

const VALID_EMOJIS = ['🔥', '😱', '💯', '😂', '🏏', '💪', '❤️', '👏', '🎉', '😤'];

// In-memory sliding window: max 5 reactions per 3s per user per room
const reactionBucket = new Map();

module.exports = function registerReactionHandlers(io, socket) {
  socket.on('disconnect', () => {
    for (const key of reactionBucket.keys()) {
      if (key.startsWith(socket.user.sub + ':')) reactionBucket.delete(key);
    }
  });

  socket.on('send_reaction', ({ roomId, emoji }) => {
    if (!VALID_EMOJIS.includes(emoji)) return;
    if (!socket.rooms.has(roomId)) return;

    const key = `${socket.user.sub}:${roomId}`;
    const bucket = reactionBucket.get(key) || [];
    const now = Date.now();
    const recent = bucket.filter((t) => now - t < 3000);

    if (recent.length >= 5) return; // rate limited

    recent.push(now);
    reactionBucket.set(key, recent);

    // Broadcast emoji to everyone in the room
    io.to(roomId).emit('reaction', { emoji });

    // Track in Redis (for top-reactions analytics later)
    redis.hincrby(`rxn:${roomId}`, emoji, 1).catch(() => {});
  });
};
