require('dotenv').config();
const mongoose = require('mongoose');
const Room = require('../src/models/Room');

// ─── Fallback fixtures (no API key) ──────────────────────────────────────────
const FALLBACK = [
  {
    match_id: 'MI_vs_CSK_20260328',
    match_title: 'MI vs CSK',
    venue: 'Wankhede Stadium, Mumbai',
    match_date: new Date('2026-03-28T19:30:00+05:30'),
    status: 'live',
    team_a: { code: 'MI',  name: 'Mumbai Indians',      color: '#004BA0', score: { runs: 0, wickets: 0 } },
    team_b: { code: 'CSK', name: 'Chennai Super Kings', color: '#F9CD05', score: { runs: 0, wickets: 0 } },
    innings: 1, balls_bowled: 0, batting_team: 'MI',
  },
  {
    match_id: 'RCB_vs_KKR_20260329',
    match_title: 'RCB vs KKR',
    venue: 'M. Chinnaswamy Stadium, Bengaluru',
    match_date: new Date('2026-03-29T19:30:00+05:30'),
    status: 'upcoming',
    team_a: { code: 'RCB', name: 'Royal Challengers Bengaluru', color: '#EC1C24', score: { runs: 0, wickets: 0 } },
    team_b: { code: 'KKR', name: 'Kolkata Knight Riders',       color: '#2E0D59', score: { runs: 0, wickets: 0 } },
    innings: 1, balls_bowled: 0, batting_team: 'RCB',
  },
  {
    match_id: 'SRH_vs_RR_20260330',
    match_title: 'SRH vs RR',
    venue: 'Rajiv Gandhi International Stadium, Hyderabad',
    match_date: new Date('2026-03-30T15:30:00+05:30'),
    status: 'upcoming',
    team_a: { code: 'SRH', name: 'Sunrisers Hyderabad', color: '#F26522', score: { runs: 0, wickets: 0 } },
    team_b: { code: 'RR',  name: 'Rajasthan Royals',    color: '#EA1A85', score: { runs: 0, wickets: 0 } },
    innings: 1, balls_bowled: 0, batting_team: 'SRH',
  },
  {
    match_id: 'GT_vs_LSG_20260331',
    match_title: 'GT vs LSG',
    venue: 'Narendra Modi Stadium, Ahmedabad',
    match_date: new Date('2026-03-31T19:30:00+05:30'),
    status: 'upcoming',
    team_a: { code: 'GT',  name: 'Gujarat Titans',       color: '#1B2133', score: { runs: 0, wickets: 0 } },
    team_b: { code: 'LSG', name: 'Lucknow Super Giants', color: '#A72056', score: { runs: 0, wickets: 0 } },
    innings: 1, balls_bowled: 0, batting_team: 'GT',
  },
  {
    match_id: 'DC_vs_PBKS_20260401',
    match_title: 'DC vs PBKS',
    venue: 'Arun Jaitley Stadium, Delhi',
    match_date: new Date('2026-04-01T19:30:00+05:30'),
    status: 'upcoming',
    team_a: { code: 'DC',   name: 'Delhi Capitals', color: '#0078BC', score: { runs: 0, wickets: 0 } },
    team_b: { code: 'PBKS', name: 'Punjab Kings',   color: '#AA4545', score: { runs: 0, wickets: 0 } },
    innings: 1, balls_bowled: 0, batting_team: 'DC',
  },
];

async function fetchFromESPN() {
  const { getIPLSchedule } = require('../src/services/scoresScraper');
  const matches = await getIPLSchedule();
  const live     = matches.filter((m) => m.status === 'live');
  const upcoming = matches.filter((m) => m.status === 'upcoming');
  console.log(`  ESPN: ${live.length} live, ${upcoming.length} upcoming IPL match(es)`);
  return [...live, ...upcoming];
}

async function upsert(matches) {
  for (const match of matches) {
    const { match_id, ...fields } = match;
    await Room.updateOne(
      { match_id },
      { $set: fields, $setOnInsert: { match_id } },
      { upsert: true }
    );
    console.log(`  ✓  ${match.match_title || match_id}  [${match.status}]`);
  }
}

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected\n');

  let matches;

  try {
    console.log('Fetching IPL schedule from ESPNcricinfo...\n');
    matches = await fetchFromESPN();
  } catch (err) {
    console.warn(`  ESPN fetch failed: ${err.message} — using fallback fixtures\n`);
    matches = FALLBACK;
  }

  if (!matches.length) {
    console.warn('  No IPL matches returned — using fallback fixtures\n');
    matches = FALLBACK;
  }

  // Wipe existing rooms so stale data doesn't persist
  await Room.deleteMany({});
  console.log('Cleared existing rooms\n');

  console.log(`Inserting ${matches.length} match(es):`);
  await upsert(matches);
  console.log('\nSeed complete ✓');
  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });
