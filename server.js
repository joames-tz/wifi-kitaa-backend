require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const connectDB = require('./config/db');
const { testConnection: testMikroTik, testConnection } = require('./config/mikrotik');
const errorHandler = require('./middleware/error');

const app = express();
const server = http.createServer(app);

// ============ MIDDLEWARE ============
// app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*' }));
app.use(morgan('dev'));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api', rateLimit({ windowMs: 60_000, max: 300 }));

// ============ API ROUTES ============
app.use('/api/plans', require('./routes/plans'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/admin/analytics', require('./routes/analytics'));
app.use('/api/vouchers', require('./routes/vouchers'));

// ============ HEALTH CHECK ============
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    business: process.env.BUSINESS_NAME || 'WiFi Portal',
    time: new Date().toISOString()
  });
});

// ============ SERVE FRONTEND ============
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'admin.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// ============ ERROR HANDLER ============
app.use(errorHandler);

// ============ START SERVER ============
const PORT = process.env.PORT || 5001;

(async () => {
  await testConnection();
  await connectDB();
 

  server.listen(PORT,'0.0.0.0', () => {
    console.log(`🚀 ${process.env.BUSINESS_NAME || 'wifi kitaa'} running on http://localhost:${PORT}`);
    console.log(`👑 Admin panel: http://localhost:${PORT}/admin`);
  });
})();