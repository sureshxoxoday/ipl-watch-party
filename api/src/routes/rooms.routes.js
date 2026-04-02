const { Router } = require('express');
const Room = require('../models/Room');
const Message = require('../models/Message');
const Poll = require('../models/Poll');
const auth = require('../middleware/auth');

const router = Router();

// List all public rooms (exclude private rooms)
router.get('/', auth, async (req, res) => {
  try {
    const rooms = await Room.find({ isPrivate: { $ne: true } })
      .sort({ status: -1, match_date: 1 })
      .lean({ virtuals: true });
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Resolve an invite code → room info (used by JoinPrivatePage)
router.get('/join/:inviteCode', auth, async (req, res) => {
  try {
    const room = await Room.findOne({ inviteCode: req.params.inviteCode, isPrivate: true }).lean({ virtuals: true });
    if (!room) return res.status(404).json({ error: 'Invite link is invalid or expired' });
    res.json({ match_id: room.match_id, match_title: room.match_title, inviteCode: room.inviteCode });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single room (private rooms require invite code query param)
router.get('/:matchId', auth, async (req, res) => {
  try {
    const room = await Room.findOne({ match_id: req.params.matchId }).lean({ virtuals: true });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    if (room.isPrivate) {
      const isOwner = room.owner_id?.toString() === req.user.id;
      const hasCode = req.query.invite === room.inviteCode;
      if (!isOwner && !hasCode) return res.status(403).json({ error: 'Invite code required' });
    }

    res.json(room);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get last 60 messages (for chat history on join)
router.get('/:matchId/messages', auth, async (req, res) => {
  try {
    const messages = await Message.find({ room_id: req.params.matchId })
      .sort({ created_at: -1 })
      .limit(60)
      .lean();
    res.json(messages.reverse());
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get active poll
router.get('/:matchId/poll', auth, async (req, res) => {
  try {
    const poll = await Poll.findOne({ room_id: req.params.matchId, status: 'active' })
      .sort({ created_at: -1 })
      .lean();
    if (!poll) return res.json(null);

    const total = poll.options.reduce((s, o) => s + o.votes, 0);
    res.json({
      ...poll,
      options: poll.options.map((o) => ({
        text: o.text,
        votes: o.votes,
        pct: total > 0 ? Math.round((o.votes / total) * 100) : 0,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
