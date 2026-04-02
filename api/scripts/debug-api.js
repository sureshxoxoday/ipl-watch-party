require('dotenv').config();

const BASE = 'https://api.cricapi.com/v1';

async function call(endpoint) {
  const url = new URL(`${BASE}/${endpoint}`);
  url.searchParams.set('apikey', process.env.CRICKET_API_KEY);
  url.searchParams.set('offset', '0');
  const res = await fetch(url.toString());
  return res.json();
}

async function main() {
  console.log('\n===== currentMatches =====\n');
  const current = await call('currentMatches');
  console.log('status:', current.status);
  console.log('total matches returned:', current.data?.length ?? 0);
  console.log();

  for (const m of (current.data || [])) {
    console.log('---');
    console.log('name      :', m.name);
    console.log('series_id :', m.series_id);
    console.log('teams     :', m.teams);
    console.log('teamInfo  :', m.teamInfo?.map(t => t.name));
    console.log('status    :', m.status);
    console.log('matchStarted:', m.matchStarted);
    console.log('matchEnded  :', m.matchEnded);
    console.log('score     :', JSON.stringify(m.score));
    console.log('date      :', m.dateTimeGMT);
    console.log();
  }
}

main().catch(console.error);
