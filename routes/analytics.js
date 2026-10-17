const express = require('express');
const Order = require('../models/Order');
const Plan = require('../models/Plan');
const adminAuth = require('../middleware/auth');
const router = express.Router();

// ============================================================
// GET /api/admin/analytics
// Returns data for all 4 dashboard charts
// ============================================================
router.get('/', adminAuth, async (req, res, next) => {
  try {
    const now = new Date();

    // ---------- CHART 1: Daily Login Activity (last 14 days) ----------
    const dailyLogins = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const next = new Date(d.getTime() + 86400000);

      const count = await Order.countDocuments({
        createdAt: { $gte: d, $lt: next }
      });

      dailyLogins.push({
        date: d.toLocaleDateString('en', { day: 'numeric', month: 'short' }),
        count
      });
    }

    // ---------- CHART 2: Daily Bandwidth Usage (last 7 days) ----------
    // Bandwidth is estimated: each plan's duration (in hours) x ~0.5 MB/min avg
    // For REAL bandwidth, see note below — requires MikroTik traffic logging
    const dailyBandwidth = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const next = new Date(d.getTime() + 86400000);

      const dayOrders = await Order.find({
        createdAt: { $gte: d, $lt: next },
        paymentStatus: 'paid'
      });

      let downloadMB = 0;
      let uploadMB = 0;

      dayOrders.forEach(o => {
        const hours = durationToHours(o.planDuration);
        // Estimate: 30 MB download per hour, 8 MB upload per hour
        downloadMB += Math.round(hours * 30);
        uploadMB += Math.round(hours * 8);
      });

      dailyBandwidth.push({
        date: d.toLocaleDateString('en', { day: 'numeric', month: 'short' }),
        download: downloadMB,
        upload: uploadMB
      });
    }

    // ---------- CHART 3: New vs Repeat Users ----------
    // New user = first order this month
    // Repeat user = had order before this month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const ordersThisMonth = await Order.find({
      createdAt: { $gte: monthStart }
    });

    const uniquePhonesThisMonth = [...new Set(ordersThisMonth.map(o => o.phone))];

    let newUsers = 0;
    let repeatUsers = 0;

    for (const phone of uniquePhonesThisMonth) {
      const priorOrder = await Order.findOne({
        phone,
        createdAt: { $lt: monthStart }
      });
      if (priorOrder) repeatUsers++;
      else newUsers++;
    }

    // Fallback if no data
    if (newUsers === 0 && repeatUsers === 0) {
      const allOrders = await Order.countDocuments();
      const allPhones = await Order.distinct('phone');
      newUsers = allPhones.length || 0;
      repeatUsers = Math.max(0, allOrders - allPhones.length);
    }

    // ---------- CHART 4: Revenue Mix by Plan ----------
    const revenueByPlan = await Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      {
        $group: {
          _id: '$planName',
          revenue: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { revenue: -1 } }
    ]);

    let revenueMix = revenueByPlan.map(r => ({
      planName: r._id || 'Unknown',
      revenue: r.revenue,
      orderCount: r.count
    }));

    // Fallback: if no paid orders, aggregate all orders
    if (revenueMix.length === 0) {
      const allByPlan = await Order.aggregate([
        {
          $group: {
            _id: '$planName',
            revenue: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        },
        { $sort: { revenue: -1 } }
      ]);
      revenueMix = allByPlan.map(r => ({
        planName: r._id || 'Unknown',
        revenue: r.revenue,
        orderCount: r.count
      }));
    }

    // ---------- BONUS STATS ----------
    const totalOrders = await Order.countDocuments();
    const paidOrders = await Order.countDocuments({ paymentStatus: 'paid' });
    const activeOrders = await Order.countDocuments({ status: 'active' });
    const uniqueCustomers = (await Order.distinct('phone')).length;

    res.json({
      dailyLogins,
      dailyBandwidth,
      userTypes: { newUsers, repeatUsers },
      revenueMix,
      summary: {
        totalOrders,
        paidOrders,
        activeOrders,
        uniqueCustomers
      }
    });

  } catch (err) {
    console.error('Analytics error:', err);
    next(err);
  }
});

// Helper: convert duration code to hours
function durationToHours(d) {
  const map = {
    '1h': 1, '2h': 2, '4h': 4, '6h': 6, '12h': 12,
    '1d': 24, '3d': 72, '7d': 168, '30d': 720
  };
  return map[d] || 1;
}

module.exports = router;