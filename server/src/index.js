const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const config = require('./config');
require('./db'); // ensures schema is created on boot
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const { registerSocketHandlers } = require('./sockets');

const app = express();
app.use(cors({ origin: config.corsOrigins.includes('*') ? true : config.corsOrigins }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'draft-box-server' }));
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

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

server.listen(config.port, () => {
  console.log(`draft-box-server listening on :${config.port}`);
});
