const Room = require('../models/Room');
const Message = require('../models/Message');

// Ball outcome weights (index maps to OUTCOMES)
const OUTCOMES = [
  { type: 'DOT',     runs: 0, isWicket: false, emoji: null,         label: 'Dot ball. Good line and length.' },
  { type: 'ONE',     runs: 1, isWicket: false, emoji: null,         label: 'Quick single.' },
  { type: 'TWO',     runs: 2, isWicket: false, emoji: null,         label: 'Good running — 2 runs!' },
  { type: 'THREE',   runs: 3, isWicket: false, emoji: null,         label: '3 runs! Sharp batting.' },
  { type: 'FOUR',    runs: 4, isWicket: false, emoji: '🏏',         label: 'FOUR! Cracking drive through covers!' },
  { type: 'SIX',     runs: 6, isWicket: false, emoji: '🔥🔥🔥',    label: 'SIX!! Absolutely hammered out of the park!' },
  { type: 'WICKET',  runs: 0, isWicket: true,  emoji: '😱💀',       label: 'WICKET!! Clean bowled! The stumps are shattered!' },
  { type: 'WIDE',    runs: 1, isWicket: false, emoji: null,         label: 'Wide ball. Extra run.' },
];

// Weighted probabilities (must sum doesn't matter, just relative)
const WEIGHTS = [30, 28, 15, 5, 12, 5, 8, 5];

function pickOutcome() {
  const total = WEIGHTS.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < WEIGHTS.length; i++) {
    r -= WEIGHTS[i];
    if (r <= 0) return OUTCOMES[i];
  }
  return OUTCOMES[0];
}

function formatOver(balls) {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

async function tick(io) {
  const room = await Room.findOne({ status: 'live' }).lean();
  if (!room) return;

  const outcome = pickOutcome();
  const newBalls = room.balls_bowled + 1;
  const over = formatOver(newBalls);

  // Which team is batting?
  const battingIsA = room.batting_team === room.team_a.code;
  const scoreKey = battingIsA ? 'team_a.score' : 'team_b.score';
  const currentScore = battingIsA ? room.team_a.score : room.team_b.score;

  const newRuns = currentScore.runs + outcome.runs;
  const newWickets = currentScore.wickets + (outcome.isWicket ? 1 : 0);

  const update = {
    balls_bowled: newBalls,
    [`${scoreKey}.runs`]: newRuns,
    [`${scoreKey}.wickets`]: newWickets,
  };

  // Check for innings/match end (10 wickets or 20 overs = 120 balls)
  const inningsOver = newWickets >= 10 || newBalls >= 120;

  if (inningsOver && room.innings === 1) {
    // Switch innings
    Object.assign(update, {
      innings: 2,
      balls_bowled: 0,
      batting_team: battingIsA ? room.team_b.code : room.team_a.code,
      target: newRuns + 1,
    });
  } else if (inningsOver && room.innings === 2) {
    update.status = 'completed';
    update.result = `${room.batting_team} won!`;
  } else if (room.innings === 2 && room.target && newRuns >= room.target) {
    update.status = 'completed';
    update.result = `${room.batting_team} won by ${10 - newWickets} wickets!`;
  }

  await Room.updateOne({ _id: room._id }, { $set: update });

  // Get updated room to broadcast
  const updated = await Room.findById(room._id).lean({ virtuals: true });

  // Broadcast score update
  io.to(room.match_id).emit('score_update', {
    team_a: updated.team_a,
    team_b: updated.team_b,
    innings: updated.innings,
    balls_bowled: updated.balls_bowled,
    current_over: updated.current_over,
    batting_team: updated.batting_team,
    target: updated.target,
    status: updated.status,
    result: updated.result,
  });

  // Broadcast match event for significant outcomes
  if (outcome.emoji) {
    io.to(room.match_id).emit('match_event', {
      type: outcome.type,
      emoji: outcome.emoji,
      over,
    });
  }

  // Save & broadcast event message for notable outcomes
  if (['FOUR', 'SIX', 'WICKET'].includes(outcome.type)) {
    const msg = await Message.create({
      room_id: room.match_id,
      user_id: null,
      username: 'Match',
      avatar_color: '#FF6B00',
      content: `${outcome.emoji} ${outcome.label}`,
      type: 'event',
      over,
      match_event: outcome.type,
    });
    io.to(room.match_id).emit('new_message', {
      _id: msg._id,
      username: 'Match',
      avatar_color: '#FF6B00',
      content: msg.content,
      type: 'event',
      over,
      match_event: outcome.type,
      created_at: msg.created_at,
    });
  }

  // Handle innings change notification
  if (inningsOver && room.innings === 1) {
    const notice = `⚡ Innings break! ${room.batting_team} scored ${newRuns}/${newWickets}. Target: ${newRuns + 1} runs.`;
    const msg = await Message.create({
      room_id: room.match_id,
      user_id: null,
      username: 'Match',
      avatar_color: '#FF6B00',
      content: notice,
      type: 'event',
      over,
      match_event: 'INNINGS_BREAK',
    });
    io.to(room.match_id).emit('new_message', {
      _id: msg._id,
      username: 'Match',
      avatar_color: '#FF6B00',
      content: notice,
      type: 'event',
      over,
      match_event: 'INNINGS_BREAK',
      created_at: msg.created_at,
    });
  }
}

module.exports = function startMatchSimulator(io) {
  console.log('[simulator] Match simulator started');

  function scheduleNext() {
    // A ball every 8–15 seconds
    const delay = 8000 + Math.random() * 7000;
    setTimeout(async () => {
      await tick(io).catch((err) => console.error('[simulator]', err.message));
      scheduleNext();
    }, delay);
  }

  scheduleNext();
};
