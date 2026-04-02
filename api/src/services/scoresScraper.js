/**
 * ESPNcricinfo scraper — live scores AND match schedule.
 *
 * No API key required. Data is extracted from __NEXT_DATA__ JSON
 * embedded in ESPNcricinfo HTML pages.
 *
 * Exports:
 *   getLiveIPLScores()  — real-time innings scores for live IPL matches
 *   getIPLSchedule()    — full match list for the current IPL season
 */

const ESPN_BASE = 'https://www.espncricinfo.com';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ─── Team metadata — slug fragment → { code, color, name, venue } ────────────
const TEAM_BY_SLUG = {
  'royal-challengers-bengaluru': { code: 'RCB', color: '#EC1C24', name: 'Royal Challengers Bengaluru', venue: 'M. Chinnaswamy Stadium, Bengaluru' },
  'mumbai-indians':              { code: 'MI',  color: '#004BA0', name: 'Mumbai Indians',              venue: 'Wankhede Stadium, Mumbai' },
  'kolkata-knight-riders':       { code: 'KKR', color: '#2E0D59', name: 'Kolkata Knight Riders',       venue: 'Eden Gardens, Kolkata' },
  'sunrisers-hyderabad':         { code: 'SRH', color: '#F26522', name: 'Sunrisers Hyderabad',         venue: 'Rajiv Gandhi International Stadium, Hyderabad' },
  'rajasthan-royals':            { code: 'RR',  color: '#EA1A85', name: 'Rajasthan Royals',            venue: 'Sawai Mansingh Stadium, Jaipur' },
  'chennai-super-kings':         { code: 'CSK', color: '#F9CD05', name: 'Chennai Super Kings',         venue: 'M. A. Chidambaram Stadium, Chennai' },
  'punjab-kings':                { code: 'PBKS',color: '#AA4545', name: 'Punjab Kings',                venue: 'Punjab Cricket Association Stadium, Mohali' },
  'gujarat-titans':              { code: 'GT',  color: '#1B2133', name: 'Gujarat Titans',              venue: 'Narendra Modi Stadium, Ahmedabad' },
  'lucknow-super-giants':        { code: 'LSG', color: '#A72056', name: 'Lucknow Super Giants',        venue: 'BRSABV Ekana Cricket Stadium, Lucknow' },
  'delhi-capitals':              { code: 'DC',  color: '#0078BC', name: 'Delhi Capitals',              venue: 'Arun Jaitley Stadium, Delhi' },
};

// Also keyed by abbreviation for score lookups
const TEAM_BY_CODE = Object.fromEntries(
  Object.values(TEAM_BY_SLUG).map((t) => [t.code, t])
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchHTML(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept': 'text/html' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

function extractNextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('__NEXT_DATA__ not found in page');
  return JSON.parse(m[1]);
}

/** Parse team slugs from a match slug like "rcb-vs-srh-1st-match" */
function teamsFromSlug(slug) {
  // Format: {team-a-slug}-vs-{team-b-slug}-{N}[stndrh]-match
  const m = slug.match(/^(.+?)-vs-(.+?)-\d+[a-z]+-match/);
  if (!m) return null;
  const a = TEAM_BY_SLUG[m[1]];
  const b = TEAM_BY_SLUG[m[2]];
  if (!a || !b) return null;
  return [a, b];
}

function stateToStatus(state) {
  if (state === 'LIVE') return 'live';
  if (state === 'POST') return 'completed';
  return 'upcoming';
}

// ─── Schedule (Series page) ───────────────────────────────────────────────────

// Cache the series slug (changes once per season)
let _iplSeriesSlug = null;
let _scheduleCache = null;
let _scheduleCacheTime = 0;
const SCHEDULE_TTL = 1_800_000; // 30 min

/**
 * Discover the current IPL series slug from the ESPN live scores page.
 * Returns something like "ipl-2026-1510719".
 */
async function findIPLSeriesSlug() {
  if (_iplSeriesSlug) return _iplSeriesSlug;
  const html = await fetchHTML(`${ESPN_BASE}/live-cricket-score`);
  const m = html.match(/href="(\/series\/ipl-\d{4}-\d+)"/i);
  if (!m) throw new Error('Could not find IPL series slug on ESPN');
  _iplSeriesSlug = m[1].replace('/series/', '');
  console.log(`[scraper] IPL series slug: ${_iplSeriesSlug}`);
  return _iplSeriesSlug;
}

/**
 * Recursively collect match schedule objects from __NEXT_DATA__.
 * A schedule match has: objectId, slug, state, startDate, startTime.
 */
function collectScheduleMatches(obj, depth = 0, out = []) {
  if (depth > 12 || !obj || typeof obj !== 'object') return out;
  if (
    obj.objectId &&
    obj.slug &&
    obj.state &&
    obj.startDate &&
    obj.startTime &&
    /vs/.test(obj.slug) &&
    /match/.test(obj.slug)
  ) {
    out.push(obj);
  }
  for (const v of Object.values(obj)) collectScheduleMatches(v, depth + 1, out);
  return out;
}

/**
 * Fetch and return the full IPL match schedule for this season.
 * Each item is shaped for direct use as a Room document:
 * {
 *   match_id, match_title, venue, match_date, status,
 *   team_a: { code, name, color, score: {runs:0,wickets:0} },
 *   team_b: { code, name, color, score: {runs:0,wickets:0} },
 *   innings, balls_bowled, batting_team
 * }
 */
async function getIPLSchedule() {
  const now = Date.now();
  if (_scheduleCache && now - _scheduleCacheTime < SCHEDULE_TTL) {
    return _scheduleCache;
  }

  const seriesSlug = await findIPLSeriesSlug();
  // Use the fixtures page — contains the full season schedule (all 74 matches)
  const html = await fetchHTML(`${ESPN_BASE}/series/${seriesSlug}/match-schedule-fixtures`);
  const data = extractNextData(html);
  const raw = collectScheduleMatches(data);

  // Deduplicate by objectId
  const seen = new Set();
  const unique = raw.filter((m) => {
    if (seen.has(m.objectId)) return false;
    seen.add(m.objectId);
    return true;
  });

  const matches = [];
  for (const m of unique) {
    const teams = teamsFromSlug(m.slug);
    if (!teams) continue; // Skip non-IPL matches that sneak in

    const [teamA, teamB] = teams;
    const status = stateToStatus(m.state);
    const matchDate = new Date(m.startTime || m.startDate);

    matches.push({
      match_id: String(m.objectId),
      match_title: `${teamA.code} vs ${teamB.code}`,
      match_number: m.title || null,   // "1st Match", "2nd Match", …
      venue: teamA.venue, // home team's venue (approximation for early matches)
      match_date: matchDate,
      status,
      team_a: { code: teamA.code, name: teamA.name, color: teamA.color, score: { runs: 0, wickets: 0 } },
      team_b: { code: teamB.code, name: teamB.name, color: teamB.color, score: { runs: 0, wickets: 0 } },
      innings: 1,
      balls_bowled: 0,
      batting_team: teamA.code,
      result: status === 'completed' ? (m.statusText || m.status || 'Completed') : null,
      _espn_slug: m.slug,
      _espn_series_slug: seriesSlug,
    });
  }

  // Sort: live first, then upcoming by date, then completed
  matches.sort((a, b) => {
    const order = { live: 0, upcoming: 1, completed: 2 };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return new Date(a.match_date) - new Date(b.match_date);
  });

  _scheduleCache = matches;
  _scheduleCacheTime = now;
  return matches;
}

// ─── Live scores (individual match pages) ────────────────────────────────────

/**
 * Recursively find innings objects in __NEXT_DATA__.
 */
function extractInnings(obj, depth = 0, out = []) {
  if (depth > 12 || !obj || typeof obj !== 'object') return out;
  if (
    typeof obj.inningNumber === 'number' &&
    typeof obj.runs === 'number' &&
    typeof obj.wickets === 'number' &&
    obj.team?.abbreviation
  ) {
    out.push(obj);
  }
  for (const v of Object.values(obj)) extractInnings(v, depth + 1, out);
  return out;
}

function dedupeInnings(innings) {
  const seen = new Set();
  return innings.filter((i) => {
    const key = `${i.inningNumber}:${i.team.abbreviation}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function oversToBalls(o) {
  if (!o) return 0;
  const [full, partial = '0'] = String(o).split('.');
  return parseInt(full) * 6 + parseInt(partial);
}

/**
 * Fetch live IPL match URLs from ESPN's live scores page.
 */
async function discoverLiveIPLUrls() {
  const html = await fetchHTML(`${ESPN_BASE}/live-cricket-score`);
  const seen = new Set();
  for (const [, path] of html.matchAll(/href="(\/series\/ipl[^"]*\/live-cricket-score)"/gi)) {
    seen.add(ESPN_BASE + path);
  }
  return [...seen];
}

/**
 * Deep-traverse __NEXT_DATA__ to collect individual ball delivery objects.
 * A ball object has overNumber, ballNumber, and batsmanStatText.
 */
function collectBalls(obj, depth = 0, out = []) {
  if (depth > 15 || !obj || typeof obj !== 'object') return out;
  if (Array.isArray(obj)) {
    for (const v of obj) collectBalls(v, depth + 1, out);
    return out;
  }
  if (
    typeof obj.overNumber === 'number' &&
    typeof obj.ballNumber === 'number' &&
    obj.batsmanStatText
  ) {
    out.push(obj);
    return out; // don't recurse into ball objects
  }
  for (const v of Object.values(obj)) collectBalls(v, depth + 1, out);
  return out;
}

function extractRecentBalls(data) {
  const raw = collectBalls(data);
  // Deduplicate by id (ESPN sometimes duplicates balls in different parts of the tree)
  const seen = new Set();
  const unique = raw.filter((b) => {
    const key = b.id ?? `${b.overNumber}.${b.ballNumber}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // Sort chronologically. ESPN `id` is a monotonically increasing integer across
  // the whole match, so it correctly orders across innings without needing inningNumber.
  unique.sort((a, b) => {
    if (a.id && b.id) return a.id - b.id;
    if (a.overNumber !== b.overNumber) return a.overNumber - b.overNumber;
    return a.ballNumber - b.ballNumber;
  });
  return unique;
}

/**
 * Scrape innings score from a single ESPN live match page.
 */
/**
 * Search __NEXT_DATA__ for a match result string like "MI won by 6 wickets".
 * ESPN stores this in various fields depending on page version.
 */
function extractMatchResult(obj, depth = 0) {
  if (depth > 12 || !obj || typeof obj !== 'object') return null;
  for (const key of ['statusText', 'result', 'winnerText', 'statusInfo', 'matchSummary']) {
    const v = obj[key];
    if (typeof v === 'string' && v.length > 5 &&
        /won|tied|abandoned|no result/i.test(v)) {
      return v;
    }
  }
  for (const v of Object.values(obj)) {
    const r = extractMatchResult(v, depth + 1);
    if (r) return r;
  }
  return null;
}

async function scrapeMatchScore(url) {
  // Extract the ESPN match objectId and both team codes from the URL slug.
  // e.g. /series/ipl-2026-1510719/royal-challengers-bengaluru-vs-sunrisers-hyderabad-1st-match-1510800/live-cricket-score
  const slugMatch = url.match(/\/series\/[^/]+\/([^/]+)\/live/);
  const urlSlug = slugMatch?.[1] ?? '';
  // The objectId is the last run of digits in the slug (e.g. "1510800")
  const espnMatchId = urlSlug.match(/-(\d+)$/)?.[1] ?? null;
  const urlTeams = teamsFromSlug(urlSlug);
  const matchTeamCodes = urlTeams ? urlTeams.map((t) => t.code) : null;

  const html = await fetchHTML(url);
  const data = extractNextData(html);
  const raw = dedupeInnings(extractInnings(data));

  if (!raw.length) return null;

  const scoreMap = {};
  for (const inn of raw) {
    const code = inn.team.abbreviation;
    const balls = inn.balls ?? oversToBalls(inn.overs);
    // totalBalls = allocated balls for this innings (120 normally, 90 for 15-over match, etc.)
    const totalBalls = inn.totalBalls ?? 120;
    scoreMap[code] = {
      runs: inn.runs,
      wickets: inn.wickets,
      balls,
      totalBalls,
      isCurrent: !!inn.isCurrent,
      inningNumber: inn.inningNumber,
      // Innings is done when all allocated overs are bowled OR all out.
      // ESPN keeps isCurrent=true during innings break, so we cannot rely on it.
      complete: balls >= totalBalls || inn.wickets >= 10,
    };
  }

  const current = raw.find((i) => i.isCurrent);
  const innings = current?.inningNumber ?? raw.length;
  const battingTeamCode = current?.team?.abbreviation ?? raw[raw.length - 1]?.team?.abbreviation;
  const firstInnings = raw.find((i) => i.inningNumber === 1);
  const firstInningsEntry = firstInnings ? scoreMap[firstInnings.team.abbreviation] : null;

  // True once 1st innings is over — works for 20-over, rain-shortened, DLS-revised matches.
  const firstInningsComplete = !!(firstInningsEntry?.complete && innings === 1);

  // Target: prefer ESPN's own target field on the 2nd innings row (set by DLS or standard).
  // Fall back to 1st innings runs + 1.
  const secondInnings = raw.find((i) => i.inningNumber === 2);
  const dlsTarget = secondInnings?.target && secondInnings.target > 0 ? secondInnings.target : null;
  const target = innings === 2 && firstInningsEntry
    ? (dlsTarget ?? firstInningsEntry.runs + 1)
    : null;

  // ── Match completion & result ────────────────────────────────────────────────
  const secondInningsEntry = secondInnings ? scoreMap[secondInnings.team.abbreviation] : null;
  const matchComplete = innings === 2 && !!secondInningsEntry?.complete;

  // Search __NEXT_DATA__ for a result string (e.g. "MI won by 6 wickets")
  const matchResult = matchComplete ? extractMatchResult(data) : null;

  // ── Recent ball-by-ball data ─────────────────────────────────────────────────
  const recentBalls = extractRecentBalls(data);

  // Use current batting innings for balls; fall back to most recent innings.
  // ESPN sometimes doesn't set isCurrent on every delivery, so we must not return 0.
  const ballsSource = current ?? raw[raw.length - 1];
  const balls = ballsSource?.balls ?? oversToBalls(ballsSource?.overs) ?? 0;

  return {
    espnMatchId,      // ESPN objectId string from URL — exact match key
    matchTeamCodes,   // both teams from URL slug — fallback match key
    teamCodes: [...new Set(raw.map((i) => i.team.abbreviation))],
    scores: Object.fromEntries(
      Object.entries(scoreMap).map(([code, s]) => [code, { runs: s.runs, wickets: s.wickets }])
    ),
    innings,
    balls,
    battingTeamCode,
    target,
    firstInningsComplete,
    matchComplete,
    matchResult,
    recentBalls,
  };
}

/**
 * Return live scores for all current IPL matches.
 */
async function getLiveIPLScores() {
  const urls = await discoverLiveIPLUrls();
  if (!urls.length) return [];

  const results = await Promise.allSettled(urls.map(scrapeMatchScore));
  return results
    .filter((r) => r.status === 'fulfilled' && r.value)
    .map((r) => r.value);
}

function invalidateScheduleCache() {
  _scheduleCacheTime = 0;
}

module.exports = { getLiveIPLScores, getIPLSchedule, invalidateScheduleCache };
