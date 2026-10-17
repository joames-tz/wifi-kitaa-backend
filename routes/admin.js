const express = require('express');
const jwt = require('jsonwebtoken');
const Plan = require('../models/Plan');
const Order = require('../models/Order');
const Setting = require('../models/Setting');
const adminAuth = require('../middleware/auth');
const mikrotik = require('../services/mikrotik');
const router = express.Router();

// ============ LOGIN ============
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (username !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign(
    { role: 'admin', username },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );
  res.json({ token });
});

// ============ STATS ============
router.get('/stats', adminAuth, async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalOrders, todayOrders, activeOrders, pendingOrders] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ createdAt: { $gte: today } }),
      Order.countDocuments({ status: 'active' }),
      Order.countDocuments({ paymentStatus: 'pending' })
    ]);

    const revenueData = await Order.find({ paymentStatus: 'paid' });
    const totalRevenue = revenueData.reduce((s, o) => s + o.amount, 0);

    const todayRevenueData = await Order.find({
      paymentStatus: 'paid',
      createdAt: { $gte: today }
    });
    const todayRevenue = todayRevenueData.reduce((s, o) => s + o.amount, 0);

    res.json({
      totalOrders,
      todayOrders,
      activeOrders,
      pendingOrders,
      totalRevenue,
      todayRevenue
    });
  } catch (err) { next(err); }
});

// ============ PLANS ============
router.get('/plans', adminAuth, async (req, res, next) => {
  try {
    const plans = await Plan.find().sort('order price');
    res.json(plans);
  } catch (err) { next(err); }
});

router.post('/plans', adminAuth, async (req, res, next) => {
  try {
    const { name, duration, durationLabel, price, description, order } = req.body;
    if (!name || !duration || !price) {
      return res.status(400).json({ error: 'name, duration, price required' });
    }
    const plan = await Plan.create({
      name,
      duration,
      durationLabel: durationLabel || name,
      price,
      description: description || '',
      order: order || 0
    });
    res.json(plan);
  } catch (err) { next(err); }
});

router.patch('/plans/:id', adminAuth, async (req, res, next) => {
  try {
    const plan = await Plan.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!plan) return res.status(404).json({ error: 'Not found' });
    res.json(plan);
  } catch (err) { next(err); }
});

router.delete('/plans/:id', adminAuth, async (req, res, next) => {
  try {
    await Plan.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ============ ORDERS ============
router.get('/orders', adminAuth, async (req, res, next) => {
  try {
    const orders = await Order.find().sort('-createdAt').limit(500);
    res.json(orders);
  } catch (err) { next(err); }
});

router.patch('/orders/:id', adminAuth, async (req, res, next) => {
  try {
    const order = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!order) return res.status(404).json({ error: 'Not found' });
    res.json(order);
  } catch (err) { next(err); }
});

// ============ MIKROTIK LIVE DATA ============
router.get('/mikrotik/active', adminAuth, async (req, res, next) => {
  try {
    const users = await mikrotik.getActiveUsers();
    res.json(users);
  } catch (err) { next(err); }
});

router.get('/mikrotik/users', adminAuth, async (req, res, next) => {
  try {
    const users = await mikrotik.getAllUsers();
    res.json(users);
  } catch (err) { next(err); }
});

// ============ SETTINGS (splash page, business info) ============
router.get('/settings', adminAuth, async (req, res, next) => {
  try {
    const settings = await Setting.find();
    const obj = {};
    settings.forEach(s => { obj[s.key] = s.value; });
    res.json(obj);
  } catch (err) { next(err); }
});

router.get('/settings/public', async (req, res, next) => {
  // Public settings for the customer portal (splash banner etc.)
  try {
    const settings = await Setting.find({
      key: { $in: ['splashTitle', 'splashSubtitle', 'splashImage', 'splashEnabled', 'businessName', 'businessPhone', 'supportPhone'] }
    });
    const obj = {};
    settings.forEach(s => { obj[s.key] = s.value; });
    res.json(obj);
  } catch (err) { next(err); }
});

router.post('/settings', adminAuth, async (req, res, next) => {
  try {
    const updates = req.body; // { key: value, key2: value2 }
    for (const [key, value] of Object.entries(updates)) {
      await Setting.findOneAndUpdate(
        { key },
        { key, value },
        { upsert: true, new: true }
      );
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;