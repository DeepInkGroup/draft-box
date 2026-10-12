const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const config = require('./config');
require('./db'); // ensures schema is created on boot
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const tacticsRoutes = require('./routes/tactics');
const { registerSocketHandlers } = require('./sockets');
const { ALL_TEAMS } = require('./data/teams');
const { leagueCatalog } = require('./data/competitions');
const { tacticalCatalog } = require('./game/tacticalStyles');

const WEB_DIR = path.join(__dirname, '..', '..', 'web');

const app = express();
app.use(cors({ origin: config.corsOrigins.includes('*') ? true : config.corsOrigins }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'draft-box-server', version: '2.0.0' }));
app.get('/api/leagues', (req, res) => res.json({ leagues: leagueCatalog() }));
app.get('/api/tactical-styles', (req, res) => res.json({ styles: tacticalCatalog() }));
app.get('/api/teams', (req, res) => {
  res.json({ teams: ALL_TEAMS.map((t) => ({ code: t.code, name: t.name })) });
});
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/tactics', tacticsRoutes);
app.use('/api/admin', require('./routes/admin'));
app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found' }));

app.use(express.static(WEB_DIR));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) return next();
  res.sendFile(path.join(WEB_DIR, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: config.corsOrigins.includes('*') ? true : config.corsOrigins }
});
registerSocketHandlers(io);
app.set('io', io);

server.listen(config.port, '0.0.0.0', () => {
  console.log(`draft-box-server listening on :${server.address().port}`);
});
