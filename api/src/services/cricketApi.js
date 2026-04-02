/**
 * CricAPI v1 client  (https://cricketdata.org)
 * Free tier: 100 calls/day
 * Sign up: https://cricketdata.org/signup.aspx
 */

const BASE = 'https://api.cricapi.com/v1';

// ─── Series-level cache (schedule rarely changes) ────────────────────────────
let _iplSeriesId = null;
let _seriesMatchList = null;
let _seriesMatchListTime = 0;
const SERIES_INFO_TTL = 1_800_000; // 30 min

const IPL_TEAM_NAMES = [
  'Mumbai Indians', 'Chennai Super Kings',
  'Royal Challengers Bengaluru', 'Royal Challengers Bangalore',
  'Kolkata Knight Riders', 'Sunrisers Hyderabad',
  'Rajasthan Royals', 'Delhi Capitals', 'Punjab Kings',
  'Gujarat Titans', 'Lucknow Super Giants',
];

// Full name → { code, color }
const TEAM_META = {
  'Mumbai Indians':                   { code: 'MI',   color: '#004BA0' },
  'Chennai Super Kings':              { code: 'CSK',  color: '#F9CD05' },
  'Royal Challengers Bengaluru':      { code: 'RCB',  color: '#EC1C24' },
  'Royal Challengers Bangalore':      { code: 'RCB',  color: '#EC1C24' },
  'Kolkata Knight Riders':            { code: 'KKR',  color: '#2E0D59' },
  'Sunrisers Hyderabad':              { code: 'SRH',  color: '#F26522' },
  'Rajasthan Royals':                 { code: 'RR',   color: '#EA1A85' },
  'Delhi Capitals':                   { code: 'DC',   color: '#0078BC' },
  'Punjab Kings':                     { code: 'PBKS', color: '#AA4545' },
  'Gujarat Titans':                   { code: 'GT',   color: '#1B2133' },
  'Lucknow Super Giants':             { code: 'LSG',  color: '#A72056' },
};

async function call(endpoint, params = {}) {
  const url = new URL(`${BASE}/${endpoint}`);
  url.searchParams.set('apikey', process.env.CRICKET_API_KEY);
  url.searchParams.set('offset', '0');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`CricAPI HTTP ${res.status}`);

  const json = await res.json();
  if (json.status !== 'success') {
    throw new Error(`CricAPI error: ${json.reason || json.status}`);
  }
  return json;
}

/** Filter: is this an IPL match? */
function isIPL(match) {
  const haystack = [match.name, match.series_id, match.series].join(' ').toLowerCase();
  if (haystack.includes('ipl') || haystack.includes('indian premier league')) return true;
  const teams = [
    ...(match.teams || []),
    ...(match.teamInfo || []).map((t) => t.name),
  ];
  return teams.some((t) => IPL_TEAM_NAMES.includes(t));
}

/** Get team meta (code + color) from full name */
function teamMeta(name) {
  return TEAM_META[name] || { code: name?.slice(0, 4).toUpperCase(), color: '#444' };
}

/**
 * Parse CricAPI score array for a given team name.
 * score: [{ r, w, o, inning: "Mumbai Indians Inning 1" }, ...]
 */
function parseScore(scoreArr, teamName) {
  const entry = scoreArr?.find((s) =>
    (s.inning || '').toLowerCase().includes(teamName.toLowerCase())
  );
  if (!entry) return { runs: 0, wickets: 0 };
  return { runs: entry.r ?? 0, wickets: entry.w ?? 0 };
}

/**
 * Convert over string/number to balls bowled.
 * CricAPI uses cricket notation: 8.2 = 8 full overs + 2 balls
 */
function overToBalls(o) {
  if (!o) return 0;
  const parts = String(o).split('.');
  return parseInt(parts[0] || 0) * 6 + parseInt(parts[1] || 0);
}

/**
 * Map a raw CricAPI match object to our Room schema.
 */
function toRoom(m) {
  const teams = m.teamInfo?.length >= 2 ? m.teamInfo : null;
  const nameA = teams?.[0]?.name || m.teams?.[0] || 'Team A';
  const nameB = teams?.[1]?.name || m.teams?.[1] || 'Team B';
  const metaA = teamMeta(nameA);
  const metaB = teamMeta(nameB);

  const scores = m.score || [];
  const scoreA = parseScore(scores, nameA);
  const scoreB = parseScore(scores, nameB);

  // Determine current innings and batting team
  const innings = scores.length || 1;
  const lastInning = scores[scores.length - 1];
  const battingName = lastInning
    ? IPL_TEAM_NAMES.find((t) => (lastInning.inning || '').includes(t)) || nameA
    : nameA;
  const battingCode = teamMeta(battingName).code;

  // Over/balls from the current innings entry
  const currentO = lastInning?.o || 0;
  const balls = overToBalls(currentO);

  // Derive status
  let status = 'upcoming';
  if (m.matchEnded) status = 'completed';
  else if (m.matchStarted) status = 'live';

  // Target (2nd innings → target is 1st innings runs + 1)
  let target = null;
  if (innings >= 2 && scores[0]) {
    target = scores[0].r + 1;
  }

  return {
    match_id: m.id,
    match_title: `${metaA.code} vs ${metaB.code}`,
    venue: m.venue || '',
    match_date: m.dateTimeGMT ? new Date(m.dateTimeGMT) : new Date(),
    status,
    team_a: { code: metaA.code, name: nameA, color: metaA.color, score: scoreA },
    team_b: { code: metaB.code, name: nameB, color: metaB.color, score: scoreB },
    innings,
    balls_bowled: balls,
    batting_team: battingCode,
    target,
    result: m.status && status === 'completed' ? m.status : null,

    // True only when the API actually returned score data (not available on free tier for IPL)
    _has_live_score: scores.length > 0,

    // Keep raw id and name for reference
    _api_name: m.name,
  };
}

/**
 * Find the current (most recently started) IPL series ID.
 * Result is cached for the lifetime of the process.
 */
async function findIPLSeriesId() {
  if (_iplSeriesId) return _iplSeriesId;
  const json = await call('series', { search: 'Indian Premier League' });
  const now = new Date();
  const candidates = (json.data || [])
    .filter((s) => s.startDate && s.name.toLowerCase().includes('indian premier league'))
    .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  // Pick the most recent series that has already started
  const current = candidates.find((s) => new Date(s.startDate) <= now) || candidates[0];
  if (!current) throw new Error('No IPL series found from CricAPI');
  _iplSeriesId = current.id;
  console.log(`[cricketApi] Using series: ${current.name} (${_iplSeriesId})`);
  return _iplSeriesId;
}

/**
 * Get the full match list for the current IPL series.
 * Cached for SERIES_INFO_TTL to save API calls.
 */
async function getSeriesMatchList() {
  const now = Date.now();
  if (_seriesMatchList && now - _seriesMatchListTime < SERIES_INFO_TTL) {
    return _seriesMatchList;
  }
  const seriesId = await findIPLSeriesId();
  const json = await call('series_info', { id: seriesId });
  _seriesMatchList = json.data?.matchList || [];
  _seriesMatchListTime = now;
  return _seriesMatchList;
}

/** Fetch current (live) IPL matches with real-time scores via match_info */
async function getCurrentMatches() {
  const allMatches = await getSeriesMatchList();
  const live = allMatches.filter((m) => m.matchStarted && !m.matchEnded);

  if (live.length === 0) return [];

  // Fetch live scores for each active match (1 API call per live match)
  const results = await Promise.all(
    live.map(async (m) => {
      try {
        const detail = await call('match_info', { id: m.id });
        return toRoom(detail.data);
      } catch {
        return toRoom(m); // fallback to series list data
      }
    })
  );
  return results;
}

/** Fetch upcoming IPL matches from the current series */
async function getUpcomingMatches() {
  const allMatches = await getSeriesMatchList();
  return allMatches
    .filter((m) => !m.matchStarted)
    .sort((a, b) => new Date(a.dateTimeGMT) - new Date(b.dateTimeGMT))
    .slice(0, 10)
    .map(toRoom);
}

module.exports = { getCurrentMatches, getUpcomingMatches, toRoom, isIPL };
