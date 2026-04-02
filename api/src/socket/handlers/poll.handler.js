const Poll = require('../../models/Poll');
const Room = require('../../models/Room');

function formatPoll(poll) {
  const total = poll.options.reduce((s, o) => s + o.votes, 0);
  return {
    _id: poll._id,
    room_id: poll.room_id,
    question: poll.question,
    status: poll.status,
    over: poll.over,
    ends_at: poll.ends_at,
    options: poll.options.map((o) => ({
      text: o.text,
      votes: o.votes,
      pct: total > 0 ? Math.round((o.votes / total) * 100) : 0,
    })),
  };
}

module.exports = function registerPollHandlers(io, socket) {
  socket.on('create_poll', async ({ roomId, question, options }) => {
    if (!question?.trim()) return;
    if (!Array.isArray(options) || options.length < 2 || options.length > 4) return;
    if (!socket.rooms.has(roomId)) return;

    try {
      const room = await Room.findOne({ match_id: roomId }).lean({ virtuals: true });
      if (!room || room.status !== 'live') return;

      // Close any existing active polls
      await Poll.updateMany({ room_id: roomId, status: 'active' }, { $set: { status: 'closed' } });

      const endsAt = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes
      const poll = await Poll.create({
        room_id: roomId,
        question: question.trim().slice(0, 200),
        options: options.map((o) => ({ text: String(o).trim().slice(0, 80), votes: 0 })),
        created_by: socket.user.sub,
        over: room.current_over,
        ends_at: endsAt,
      });

      io.to(roomId).emit('new_poll', formatPoll(poll));

      // Auto-close after 3 min
      setTimeout(async () => {
        const updated = await Poll.findOneAndUpdate(
          { _id: poll._id, status: 'active' },
          { $set: { status: 'closed' } },
          { new: true }
        );
        if (updated) io.to(roomId).emit('poll_closed', { pollId: poll._id });
      }, 3 * 60 * 1000);
    } catch (err) {
      console.error('create_poll error:', err.message);
    }
  });

  socket.on('vote_poll', async ({ pollId, optionIndex }) => {
    if (typeof optionIndex !== 'number' || optionIndex < 0) return;

    try {
      const poll = await Poll.findById(pollId);
      if (!poll || poll.status !== 'active') return;
      if (!poll.options[optionIndex]) return;

      const userId = socket.user.sub.toString();
      if (poll.voters.some((v) => v.toString() === userId)) return; // already voted

      poll.voters.push(socket.user.sub);
      poll.options[optionIndex].votes += 1;
      await poll.save();

      io.to(poll.room_id).emit('poll_update', formatPoll(poll));
    } catch (err) {
      console.error('vote_poll error:', err.message);
    }
  });
};
