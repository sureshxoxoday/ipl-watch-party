const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  lazyConnect: true,
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

// Separate client for pub/sub (a subscribed client can't do other commands)
const redisSub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  lazyConnect: true,
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

redis.on('error', (err) => console.error('Redis error:', err.message));
redisSub.on('error', (err) => console.error('Redis sub error:', err.message));

async function connectRedis() {
  await Promise.all([redis.connect(), redisSub.connect()]);
  console.log('Redis connected');
}

module.exports = { redis, redisSub, connectRedis };
