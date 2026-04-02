/**
 * Live match poller — ESPNcricinfo scraper for schedule and real-time scores.
 * No API rate limits — poll as frequently as needed.
 *
 * Poll interval: CRICKET_POLL_INTERVAL_MS (default 15 000 ms = 15 sec)
 */

const Room = require('../models/Room');
const Message = require('../models/Message');
const { getLiveIPLScores, getIPLSchedule, invalidateScheduleCache } = require('./scoresScraper');

const POLL_MS = parseInt(process.env.CRICKET_POLL_INTERVAL_MS, 10) || 15000;

// Snapshot: matchId → { runsA, wicketsA, runsB, wicketsB, innings, lastBallId, lastOverNumber }
const snapshot = new Map();

// ESPN match IDs seen in the previous poll — used to detect match end
let prevEspnMatchIds = new Set();

// Shot type → readable label
const SHOT_LABEL = {
  SQUARE_DRIVE: 'square drive', COVER_DRIVE: 'cover drive', STRAIGHT_DRIVE: 'straight drive',
  ON_DRIVE: 'on drive', OFF_DRIVE: 'off drive', FLICK: 'flick', PULL: 'pull shot',
  HOOK: 'hook shot', CUT: 'cut shot', SWEEP: 'sweep', REVERSE_SWEEP: 'reverse sweep',
  GLANCE: 'glance', NUDGE: 'nudge', PUNCH: 'punch', SLOG: 'slog', LOFT: 'lofted shot',
  SCOOP: 'scoop', RAMP: 'ramp', HELICOPTER: 'helicopter shot',
};

function shotLabel(type) { return SHOT_LABEL[type] || 'shot'; }

/** Extract surname from a stat string like "Abhishek Sharma 6* (2b 1x6)" */
function shortName(statText) {
  if (!statText?.long) return '';
  const words = statText.long.split(' ');
  const nameWords = [];
  for (const w of words) {
    if (/^\d/.test(w) || w.includes('(') || w.includes('-') || w.includes('*')) break;
    nameWords.push(w);
  }
  return nameWords[nameWords.length - 1] || '';
}

/** Build a rich commentary line for one ball. Returns null for dot/single/double. */
function ballCommentary(ball) {
  const batter = shortName(ball.batsmanStatText);
  const bowler = shortName(ball.bowlerStatText);
  const shot = shotLabel(ball.shotType);

  if (ball.isWicket) {
    return {
      type: 'WICKET', emoji: '😱💀',
      label: batter && bowler
        ? `WICKET! ${batter} is OUT! ${bowler} gets the breakthrough!`
        : 'WICKET! A wicket falls!',
    };
  }
  if (ball.isSix) {
    return {
      type: 'SIX', emoji: '🔥🔥🔥',
      label: batter && bowler
        ? `SIX! ${batter} launches a ${shot} off ${bowler} into the stands!`
        : 'SIX!! Massive hit!',
    };
  }
  if (ball.isFour) {
    return {
      type: 'FOUR', emoji: '🏏',
      label: batter && bowler
        ? `FOUR! ${batter} plays a ${shot} off ${bowler} to the boundary!`
        : 'FOUR! Racing to the boundary!',
    };
  }
  return null;
}

async function emitAndPersist(io, match_id, currentOver, event) {
  io.to(match_id).emit('match_event', { type: event.type, emoji: event.emoji });

  const msg = await Message.create({
    room_id: match_id,
    user_id: null,
    username: 'Match',
    avatar_color: '#FF6B00',
    content: `${event.emoji} ${event.label}`,
    type: 'event',
    over: currentOver,
    match_event: event.type,
  });
  io.to(match_id).emit('new_message', {
    _id: msg._id,
    username: 'Match',
    avatar_color: '#FF6B00',
    content: msg.content,
    type: 'event',
    over: msg.over,
    match_event: event.type,
    created_at: msg.created_at,
  });
}

function ballKey(ball) {
  return ball.id ?? `${ball.overNumber}.${ball.ballNumber}`;
}

/**
 * Collect balls for a specific over from the END of the recentBalls array.
 * Iterates backward so it naturally stops at the innings boundary —
 * overNumber resets to 0 in innings 2, so a forward filter would wrongly
 * include same-numbered overs from innings 1.
 */
function getOverBalls(recentBalls, overNum) {
  const balls = [];
  let found = false;
  for (let i = recentBalls.length - 1; i >= 0; i--) {
    const b = recentBalls[i];
    if (b.overNumber === overNum) {
      found = true;
      balls.unshift(b);
    } else if (found) {
      break; // moved past this over going backwards — stop
    }
  }
  return balls;
}

async function poll(io) {
  // ── 1. Fetch ESPN live scores first (needed to widen the schedule filter) ────
  let espnScores = [];
  try {
    espnScores = await getLiveIPLScores();
    if (espnScores.length) {
      console.log(`[poller] ESPN: ${espnScores.length} live match(es) with scores`);
    }
  } catch (err) {
    console.warn('[poller] ESPN scraper failed:', err.message);
  }

  // If a match that was live last poll has disappeared from ESPN live scores,
  // the match just ended — force-expire the schedule cache so we get fresh status.
  const currEspnMatchIds = new Set(espnScores.map((s) => s.espnMatchId).filter(Boolean));
  for (const id of prevEspnMatchIds) {
    if (!currEspnMatchIds.has(id)) {
      console.log(`[poller] Match ${id} dropped from ESPN live — invalidating schedule cache`);
      invalidateScheduleCache();
      break;
    }
  }
  prevEspnMatchIds = currEspnMatchIds;

  // ── 2. Fetch schedule ─────────────────────────────────────────────────────────
  let schedule = [];
  try {
    schedule = await getIPLSchedule();
  } catch (err) {
    console.error('[poller] ESPN schedule fetch failed:', err.message);
  }

  // Match an ESPN score entry to a schedule room.
  // Primary: espnMatchId (objectId from URL) — exact, handles same-team repeated fixtures.
  // Fallback: matchTeamCodes from URL slug — used if objectId parse failed.
  function espnMatchesRoom(s, match_id, team_a_code, team_b_code) {
    if (s.espnMatchId != null) return s.espnMatchId === match_id;
    if (s.matchTeamCodes) {
      return s.matchTeamCodes.includes(team_a_code) && s.matchTeamCodes.includes(team_b_code);
    }
    return false;
  }

  // Include non-completed matches that are either:
  //   (a) already marked live by ESPN schedule, or
  //   (b) exactly matched by an ESPN live score entry (catches stale schedule cache)
  const apiMatches = schedule.filter((m) => {
    if (m.status === 'completed') return false;
    if (m.status === 'live') return true;
    return espnScores.some((s) => espnMatchesRoom(s, m.match_id, m.team_a.code, m.team_b.code));
  });

  // ── 3. Merge and persist ─────────────────────────────────────────────────────
  for (const roomData of apiMatches) {
    const { match_id, team_a, team_b, status, result } = roomData;

    const espn = espnScores.find((s) => espnMatchesRoom(s, match_id, team_a.code, team_b.code));

    let scoreA, scoreB, innings, balls_bowled, batting_team, target;

    if (espn) {
      scoreA = espn.scores[team_a.code] ?? { runs: 0, wickets: 0 };
      scoreB = espn.scores[team_b.code] ?? { runs: 0, wickets: 0 };
      innings      = espn.innings;
      balls_bowled = espn.balls;
      batting_team = espn.battingTeamCode;
      target       = espn.target;

      if (espn.firstInningsComplete && espn.innings === 1) {
        const firstInningsTeam  = espn.battingTeamCode;
        const firstInningsScore = espn.scores[firstInningsTeam];
        const nextBatter = firstInningsTeam === team_a.code ? team_b.code : team_a.code;
        innings      = 2;
        balls_bowled = 0;
        batting_team = nextBatter;
        target = target ?? (firstInningsScore?.runs ?? 0) + 1;
      }
    } else if (roomData._has_live_score) {
      scoreA       = team_a.score;
      scoreB       = team_b.score;
      innings      = roomData.innings;
      balls_bowled = roomData.balls_bowled;
      batting_team = roomData.batting_team;
      target       = roomData.target;
    } else {
      await Room.updateOne(
        { match_id },
        { $set: { status, result }, $setOnInsert: {
          match_title: roomData.match_title,
          venue: roomData.venue,
          match_date: roomData.match_date,
          'team_a.code': team_a.code,
          'team_a.name': team_a.name,
          'team_a.color': team_a.color,
          'team_b.code': team_b.code,
          'team_b.name': team_b.name,
          'team_b.color': team_b.color,
        }},
        { upsert: true }
      );
      continue;
    }

    const resolvedStatus = espn ? 'live' : status;
    const resolvedResult = resolvedStatus === 'live' ? null : result;

    // ── 4. Current over balls — computed before DB write so they can be persisted ─
    const lastBallInMatch = espn?.recentBalls?.[espn.recentBalls.length - 1];
    const currentOverNum = lastBallInMatch?.overNumber ?? null;
    const freshOverBalls = currentOverNum != null
      ? getOverBalls(espn.recentBalls, currentOverNum).map((b) => ({
          runs: b.totalRuns ?? b.runs ?? 0,
          isWicket: !!b.isWicket,
          isFour: !!b.isFour,
          isSix: !!b.isSix,
          isWide: !!(b.isWide || b.extras?.wides),
          isNoBall: !!(b.isNoBall || b.extras?.noBalls),
        }))
      : null; // null = no new data; don't overwrite DB value

    const dbSet = {
      status: resolvedStatus,
      result: resolvedResult,
      'team_a.score': scoreA,
      'team_b.score': scoreB,
      innings,
      balls_bowled,
      batting_team,
      target,
    };
    // Only persist over balls when we have fresh ESPN data; otherwise keep last stored value
    if (freshOverBalls !== null) dbSet.current_over_balls = freshOverBalls;

    const existing = await Room.findOneAndUpdate(
      { match_id },
      {
        $set: dbSet,
        $setOnInsert: {
          match_title: roomData.match_title,
          venue: roomData.venue,
          match_date: roomData.match_date,
          'team_a.code': team_a.code,
          'team_a.name': team_a.name,
          'team_a.color': team_a.color,
          'team_b.code': team_b.code,
          'team_b.name': team_b.name,
          'team_b.color': team_b.color,
        },
      },
      { upsert: true, new: true }
    );

    // Broadcast live score update — use DB value as fallback for over balls
    const currentOverBalls = freshOverBalls ?? existing.current_over_balls ?? [];
    const scorePayload = {
      team_a: { ...team_a, score: scoreA },
      team_b: { ...team_b, score: scoreB },
      innings,
      balls_bowled,
      current_over: existing.current_over,
      batting_team,
      target,
      status: resolvedStatus,
      result: resolvedResult,
      current_over_balls: currentOverBalls,
    };
    io.to(match_id).emit('score_update', scorePayload);
    // Also push scores to any private rooms following this match
    io.to(`scores:${match_id}`).emit('score_update', scorePayload);

    // ── Match complete detected from live ESPN data ───────────────────────────
    if (espn?.matchComplete) {
      const result = espn.matchResult || 'Match completed.';
      const justCompleted = await Room.findOneAndUpdate(
        { match_id, status: { $ne: 'completed' } },
        { $set: { status: 'completed', result, current_over_balls: [] } },
        { new: false }
      );
      if (justCompleted) {
        console.log(`[poller] Match complete (from scraper): ${match_id} — ${result}`);
        await emitAndPersist(io, match_id, null, {
          type: 'MATCH_RESULT', emoji: '🏆',
          label: result,
        });
        io.to(match_id).emit('score_update', { status: 'completed', result, current_over_balls: [] });
        snapshot.delete(match_id);
        continue;
      }
    }

    // ── 5. Ball-by-ball commentary ───────────────────────────────────────────
    const prev = snapshot.get(match_id);
    const curr = {
      runsA: scoreA.runs, wicketsA: scoreA.wickets,
      runsB: scoreB.runs, wicketsB: scoreB.wickets,
      innings,
      lastBallId: prev?.lastBallId ?? null,
      lastOverNumber: prev?.lastOverNumber ?? -1,
      // Persisted across polls to prevent re-emitting over summaries for overs
      // that had extras (balls 7, 8…) processed in subsequent polls.
      lastSummaryOverNumber: prev?.lastSummaryOverNumber ?? -1,
    };

    const currentOver = existing.current_over;

    if (espn?.recentBalls?.length) {
      const lastBall = espn.recentBalls[espn.recentBalls.length - 1];
      const latestBallId = lastBall ? ballKey(lastBall) : null;

      // ── First poll after (re)start — skip commentary, just sync position ──
      if (!prev) {
        curr.lastBallId = latestBallId;
        curr.lastOverNumber = lastBall?.overNumber ?? -1;
        // Only mark the over as already-summarized if it was complete when we
        // started (last seen ball was the 6th legal delivery). If we restart
        // mid-over, mark the PREVIOUS over as done so the current over's
        // summary can still fire when ball 6 arrives.
        const lastBallOverComplete = (lastBall?.ballNumber ?? 0) >= 6;
        curr.lastSummaryOverNumber = lastBallOverComplete
          ? (lastBall?.overNumber ?? -1)
          : (lastBall?.overNumber ?? 0) - 1;
        snapshot.set(match_id, curr);
        continue;
      }

      // ── Innings changed — emit break, reset ball cursor & over counters ───
      if (prev.innings !== innings) {
        await emitAndPersist(io, match_id, currentOver, {
          type: 'INNINGS_BREAK', emoji: '⚡',
          label: `Innings break! ${batting_team} now batting.`,
        });
        await Room.updateOne({ match_id }, { $set: { current_over_balls: [] } });
        curr.lastBallId = latestBallId;
        curr.lastOverNumber = lastBall?.overNumber ?? -1;
        curr.lastSummaryOverNumber = -1; // reset for new innings
        snapshot.set(match_id, curr);
        continue;
      }

      // ── Normal case: find new balls since last known ────────────────────
      const lastSeenId = prev.lastBallId;
      const lastSeenIdx = lastSeenId !== null
        ? espn.recentBalls.findIndex((b) => ballKey(b) === lastSeenId)
        : -1;

      const newBalls = lastSeenIdx === -1
        ? espn.recentBalls.slice(-3)
        : espn.recentBalls.slice(lastSeenIdx + 1);

      let lastOverSeen = prev.lastOverNumber;

      // emitOverSummary — guarded by curr.lastSummaryOverNumber (persists across polls)
      // so a no-ball/wide in a later poll can't re-trigger the same over's summary.
      const emitOverSummary = async (overNum) => {
        if (overNum <= curr.lastSummaryOverNumber) return;
        curr.lastSummaryOverNumber = overNum;
        const overRuns = getOverBalls(espn.recentBalls, overNum)
          .reduce((s, b) => s + (b.totalRuns ?? b.runs ?? 0), 0);
        await emitAndPersist(io, match_id, currentOver, {
          type: 'OVER_COMPLETE', emoji: '📊',
          label: `End of Over ${overNum}: ${overRuns} run${overRuns !== 1 ? 's' : ''}.`,
        });
      };

      for (const ball of newBalls) {
        // Fallback: first ball of a new over means previous over is complete
        if (ball.overNumber > lastOverSeen && lastOverSeen >= 0) {
          await emitOverSummary(lastOverSeen);
        }

        const event = ballCommentary(ball);
        if (event) await emitAndPersist(io, match_id, currentOver, event);

        // Primary: 6th legal delivery completes the over
        if (ball.ballNumber >= 6) {
          await emitOverSummary(ball.overNumber);
        }

        lastOverSeen = ball.overNumber;
      }

      curr.lastBallId = latestBallId;
      curr.lastOverNumber = lastOverSeen;
    } else {
      // No ESPN ball data — emit with persisted over balls from DB
      const fallbackPayload = {
        team_a: { ...team_a, score: scoreA },
        team_b: { ...team_b, score: scoreB },
        innings, balls_bowled, current_over: existing.current_over,
        batting_team, target, status: resolvedStatus, result: resolvedResult,
        current_over_balls: existing.current_over_balls ?? [],
      };
      io.to(match_id).emit('score_update', fallbackPayload);
      io.to(`scores:${match_id}`).emit('score_update', fallbackPayload);

      // No ball-by-ball data — innings break detection via score diff only
      if (prev && prev.innings !== innings) {
        await emitAndPersist(io, match_id, currentOver, {
          type: 'INNINGS_BREAK', emoji: '⚡',
          label: `Innings break! ${batting_team} now batting.`,
        });
      }
    }

    snapshot.set(match_id, curr);
  }

  // ── Cleanup: sync room status with ESPN schedule ─────────────────────────────
  const liveMatchIds = new Set(apiMatches.map((m) => m.match_id));

  // 1. Upcoming matches incorrectly marked 'live' → reset to 'upcoming'
  const upcomingToReset = schedule
    .filter((m) => m.status === 'upcoming' && !liveMatchIds.has(m.match_id))
    .map((m) => m.match_id);
  if (upcomingToReset.length > 0) {
    const { modifiedCount } = await Room.updateMany(
      { match_id: { $in: upcomingToReset }, status: 'live' },
      { $set: { status: 'upcoming' } }
    );
    if (modifiedCount > 0) console.log(`[poller] Reset ${modifiedCount} room(s) to upcoming`);
  }

  // 2. Completed matches → set 'completed' + result, clear live over balls
  //    Also emit a MATCH_RESULT chat message for rooms that just transitioned live → completed.
  const completedMatches = schedule.filter((m) => m.status === 'completed');
  for (const m of completedMatches) {
    const room = await Room.findOneAndUpdate(
      { match_id: m.match_id, status: { $ne: 'completed' } },
      { $set: { status: 'completed', result: m.result, current_over_balls: [] } },
      { new: false } // return original doc so we know it was live before
    );
    if (room) {
      console.log(`[poller] Marked ${m.match_id} as completed: ${m.result}`);
      await emitAndPersist(io, m.match_id, null, {
        type: 'MATCH_RESULT', emoji: '🏆',
        label: m.result || 'Match completed.',
      });
      io.to(m.match_id).emit('score_update', {
        status: 'completed',
        result: m.result,
        current_over_balls: [],
      });
      snapshot.delete(m.match_id);
    }
  }
}

module.exports = function startLivePoller(io) {
  console.log(`[poller] Live poller started — polling every ${POLL_MS / 1000}s`);
  poll(io).catch((err) => console.error('[poller]', err.message));
  setInterval(() => poll(io).catch((err) => console.error('[poller]', err.message)), POLL_MS);
};
