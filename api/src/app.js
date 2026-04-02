require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const routes = require('./routes');

const app = express();

app.set('trust proxy', 1);
app.disable('etag'); // prevent 304 responses — all API data is dynamic
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '512kb' }));

app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));
app.use('/api/v1', routes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/mem', (req, res) => {
  const m = process.memoryUsage();
  res.json({
    rss_mb:        (m.rss / 1024 / 1024).toFixed(2),
    heap_used_mb:  (m.heapUsed / 1024 / 1024).toFixed(2),
    heap_total_mb: (m.heapTotal / 1024 / 1024).toFixed(2),
    external_mb:   (m.external / 1024 / 1024).toFixed(2),
    array_buffers_mb: (m.arrayBuffers / 1024 / 1024).toFixed(2),
  });
});

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

module.exports = app;
