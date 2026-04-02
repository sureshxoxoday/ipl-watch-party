require('dotenv').config();

const http = require('http');
const app = require('./app');
const { connect } = require('./config/database');
const { connectRedis } = require('./config/redis');
const setupSocket = require('./socket');
const startMatchSimulator = require('./services/matchSimulator');
const startLivePoller    = require('./services/livePoller');

const PORT = process.env.PORT || 3001;

async function main() {
  await connect();
  await connectRedis();

  const server = http.createServer(app);
  const io = setupSocket(server);

  if (process.env.CRICKET_API_KEY) {
    console.log('[startup] CRICKET_API_KEY found — live scores via ESPNcricinfo + schedule via CricAPI');
    startLivePoller(io);
  } else {
    console.log('[startup] No CRICKET_API_KEY — using match simulator (set key in .env for real data)');
    startMatchSimulator(io);
  }

  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});
