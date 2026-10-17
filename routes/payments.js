const express = require('express');
const Order = require('../models/Order');
const selcom = require('../services/selcom');
const mikrotik = require('../services/mikrotik');
const router = express.Router();

// POST /api/payments/initiate
// Sends USSD payment prompt to customer's phone
router.post('/initiate', async (req, res, next) => {
  try {
    const orderId = req.body.orderId;
    if (!orderId) {
      return res.status(400).json({ error: 'orderId required' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ error: 'Order already paid' });
    }

    let selcomRes;
    try {
      selcomRes = await selcom.pushUSSD({
        amount: order.amount,
        phone: order.phone,
        method: order.paymentMethod,
        orderId: order._id.toString(),
        name: 'WiFi Customer'
      });
    } catch (err) {
      console.error('Selcom error:', err.message);
      return res.status(500).json({
        error: 'Payment gateway error',
        detail: err.message
      });
    }

    order.paymentRef = selcomRes && selcomRes.data ? selcomRes.data.reference : null;
    order.paymentRaw = selcomRes;
    await order.save();

    res.json({
      success: true,
      message: 'Check your phone for the payment prompt',
      reference: order.paymentRef
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/payments/webhook
// Called by Selcom when payment is confirmed or fails
router.post('/webhook', async (req, res) => {
  try {
    console.log('Selcom webhook received:', req.body);
    const orderId = req.body.order_id || req.body.orderId || req.body.reference;
    const status = req.body.payment_status || req.body.status;

    if (!orderId) {
      return res.status(400).json({ error: 'No order ID' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const statusUpper = String(status || '').toUpperCase();
    const success = ['COMPLETED', 'SUCCESS', 'PAID'].includes(statusUpper);
    const failed = ['FAILED', 'CANCELLED', 'DECLINED'].includes(statusUpper);

    if (success) {
      await handleSuccessfulPayment(order);
    } else if (failed) {
      order.paymentStatus = 'failed';
      order.status = 'failed';
      await order.save();
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Webhook failed' });
  }
});

// POST /api/payments/:orderId/mark-paid
// Manually mark an order as paid (admin override / testing)
router.post('/:orderId/mark-paid', async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    await handleSuccessfulPayment(order);
    res.json({ success: true, order: order });
  } catch (err) {
    next(err);
  }
});

// Helper: Activate MikroTik user after successful payment
async function handleSuccessfulPayment(order) {
  try {
    order.paymentStatus = 'paid';
    order.status = 'active';
    order.activatedAt = new Date();

    const ms = parseDuration(order.planDuration);
    order.expiresAt = new Date(Date.now() + ms);

    if (order.macAddress) {
      const result = await mikrotik.activateUser(
        order.macAddress,
        order.planDuration,
        process.env.MIKROTIK_HOTSPOT_PROFILE || 'default'
      );

      if (result.success) {
        order.mikrotikUser = result.username;
      } else {
        order.status = 'failed';
        console.error('MikroTik activation failed:', result.error);
      }
    }

    await order.save();
    console.log('Order activated:', order._id.toString());
  } catch (err) {
    console.error('handleSuccessfulPayment error:', err.message);
  }
}

// Helper: Convert duration string to milliseconds
function parseDuration(d) {
  const units = {
    '1h': 3600000,
    '2h': 7200000,
    '4h': 14400000,
    '6h': 21600000,
    '12h': 43200000,
    '1d': 86400000,
    '3d': 259200000,
    '7d': 604800000,
    '30d': 2592000000
  };
  return units[d] || 86400000;
}

module.exports = router;