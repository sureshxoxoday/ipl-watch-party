const { Router } = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const auth = require('../middleware/auth');
const Room = require('../models/Room');

const router = Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const PRIVATE_ROOM_PRICE_PAISE = parseInt(process.env.PRIVATE_ROOM_PRICE_PAISE, 10) || 9900; // ₹99

function generateInviteCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase(); // e.g. "A3F9B2C1"
}

// POST /payments/create-order
// Creates a Razorpay order for a private room purchase
router.post('/create-order', auth, async (req, res) => {
  try {
    const order = await razorpay.orders.create({
      amount: PRIVATE_ROOM_PRICE_PAISE,
      currency: 'INR',
      receipt: `room_${req.user.id}_${Date.now()}`,
      notes: { userId: req.user.id, linkedMatchId: req.body.linked_match_id || '' },
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('[payments] create-order error:', err.message);
    res.status(500).json({ error: 'Could not create payment order' });
  }
});

// POST /payments/verify
// Verifies Razorpay signature and creates the private room
router.post('/verify', auth, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, linked_match_id, room_name } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing payment fields' });
  }

  // Verify HMAC signature
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expected !== razorpay_signature) {
    return res.status(400).json({ error: 'Payment verification failed' });
  }

  try {
    // Look up the linked public match to copy metadata
    const publicRoom = linked_match_id
      ? await Room.findOne({ match_id: linked_match_id, isPrivate: false }).lean()
      : null;

    const inviteCode = generateInviteCode();
    const privateMatchId = `private_${crypto.randomBytes(6).toString('hex')}`;

    const privateRoom = await Room.create({
      match_id: privateMatchId,
      match_title: room_name || (publicRoom ? `Private: ${publicRoom.match_title}` : 'Private Room'),
      match_number: publicRoom?.match_number || null,
      venue: publicRoom?.venue || null,
      match_date: publicRoom?.match_date || new Date(),
      status: publicRoom?.status || 'upcoming',
      team_a: publicRoom?.team_a || { code: 'TBD', name: 'TBD', color: '#333', score: { runs: 0, wickets: 0 } },
      team_b: publicRoom?.team_b || { code: 'TBD', name: 'TBD', color: '#333', score: { runs: 0, wickets: 0 } },
      innings: publicRoom?.innings || 1,
      balls_bowled: publicRoom?.balls_bowled || 0,
      batting_team: publicRoom?.batting_team || null,
      target: publicRoom?.target || null,
      // Private room fields
      isPrivate: true,
      inviteCode,
      owner_id: req.user.id,
      linked_match_id: linked_match_id || null,
      isPaid: true,
    });

    res.json({
      match_id: privateRoom.match_id,
      inviteCode: privateRoom.inviteCode,
      inviteUrl: `${process.env.FRONTEND_URL}/join/${inviteCode}`,
    });
  } catch (err) {
    console.error('[payments] verify error:', err.message);
    res.status(500).json({ error: 'Could not create private room' });
  }
});

module.exports = router;
