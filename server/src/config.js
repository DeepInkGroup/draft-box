require('dotenv').config();

module.exports = {
  port: process.env.PORT || 4321,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  corsOrigins: (process.env.CORS_ORIGIN || '*').split(',').map((s) => s.trim()),
  dbPath: process.env.DB_PATH || './data/draftbox.sqlite'
};
