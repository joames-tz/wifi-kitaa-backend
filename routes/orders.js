const express = require('express');
const Order = require('../models/Order');
const Plan = require('../models/Plan');
const router = express.Router();

// POST place a new order (public — customer portal)
router.post('/', async (req, res, next) => {
  try {
    const { planId, phone, macAddress, ipAddress, paymentMethod } = req.body;

    if (!planId || !phone || !paymentMethod) {
      return res.status(400).json({ error: 'Missing plan, phone, or payment method' });
    }

    const validMethods = ['mpesa', 'tigopesa', 'airtelmoney', 'halopesa'];
    if (!validMethods.includes(paymentMethod)) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }

    const plan = await Plan.findById(planId);
    if (!plan || !plan.active) {
      return res.status(404).json({ error: 'Plan not found or inactive' });
    }

    const order = await Order.create({
      phone: phone.trim(),
      macAddress: macAddress ? macAddress.toUpperCase() : null,
      ipAddress: ipAddress || null,
      planId: plan._id,
      planName: plan.name,
      planDuration: plan.duration,
      amount: plan.price,
      paymentMethod,
      paymentStatus: 'pending',
      status: 'pending'
    });

    res.json({
      success: true,
      orderId: order._id,
      amount: order.amount,
      planName: order.planName
    });

  } catch (err) { next(err); }
});

// GET order status (public — for polling after payment)
router.get('/:id/status', async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .select('status paymentStatus planName amount activatedAt expiresAt');
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) { next(err); }
});

module.exports = router;