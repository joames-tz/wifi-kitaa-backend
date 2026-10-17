const express = require('express');
const Voucher = require('../models/Voucher');
const Plan = require('../models/Plan');
const adminAuth = require('../middleware/auth');
const mikrotik = require('../services/mikrotik');
const router = express.Router();

// ============================================================
// HELPER: Generate a unique, readable voucher code
// ============================================================
function generateCode() {
  // Excluded confusing chars: I, L, O, 0, 1
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  code += '-';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code; // e.g. AB7K-9MNP
}

// ============================================================
// ADMIN: Generate vouchers (bulk)
// ============================================================
router.post('/admin/generate', adminAuth, async (req, res, next) => {
  try {
    const { planId, quantity = 1, note = '' } = req.body;

    if (!planId) {
      return res.status(400).json({ error: 'planId is required' });
    }

    const qty = Math.min(Math.max(parseInt(quantity) || 1, 1), 100);

    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const batchId = 'BATCH-' + Date.now().toString(36).toUpperCase();
    const vouchers = [];

    for (let i = 0; i < qty; i++) {
      let code;
      let exists = true;
      let attempts = 0;

      while (exists && attempts < 10) {
        code = generateCode();
        const found = await Voucher.findOne({ code });
        exists = !!found;
        attempts++;
      }

      const v = await Voucher.create({
        code,
        planId: plan._id,
        planName: plan.name,
        planDuration: plan.duration,
        durationLabel: plan.durationLabel || plan.name,
        price: plan.price,
        note,
        createdBy: req.admin.username || 'admin',
        batchId,
        status: 'unused'
      });

      vouchers.push(v);
    }

    res.json({
      success: true,
      batchId,
      count: vouchers.length,
      vouchers: vouchers.map(v => ({
        code: v.code,
        planName: v.planName,
        price: v.price,
        durationLabel: v.durationLabel
      }))
    });
  } catch (err) { next(err); }
});

// ============================================================
// ADMIN: List all vouchers
// ============================================================
router.get('/admin/list', adminAuth, async (req, res, next) => {
  try {
    const { status, batchId } = req.query;
    const query = {};
    if (status) query.status = status;
    if (batchId) query.batchId = batchId;

    const vouchers = await Voucher.find(query).sort('-createdAt').limit(500);
    res.json(vouchers);
  } catch (err) { next(err); }
});

// ============================================================
// ADMIN: Cancel a voucher
// ============================================================
router.post('/admin/cancel/:id', adminAuth, async (req, res, next) => {
  try {
    const v = await Voucher.findById(req.params.id);
    if (!v) return res.status(404).json({ error: 'Voucher not found' });
    if (v.status === 'used') {
      return res.status(400).json({ error: 'Cannot cancel a used voucher' });
    }
    v.status = 'cancelled';
    await v.save();
    res.json({ success: true, voucher: v });
  } catch (err) { next(err); }
});

// ============================================================
// ADMIN: Delete a voucher
// ============================================================
router.delete('/admin/:id', adminAuth, async (req, res, next) => {
  try {
    await Voucher.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ============================================================
// PUBLIC: Redeem a voucher (customer enters code)
// ============================================================
router.post('/redeem', async (req, res, next) => {
  try {
    const { code, macAddress, phone } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Voucher code is required' });
    }

    const cleanCode = String(code).trim().toUpperCase().replace(/\s+/g, '');

    const voucher = await Voucher.findOne({ code: cleanCode });
    if (!voucher) {
      return res.status(404).json({ error: 'Voucher code si sahihi' });
    }

    if (voucher.status === 'used') {
      return res.status(400).json({ error: 'Voucher hii ilishatumika' });
    }
    if (voucher.status === 'cancelled') {
      return res.status(400).json({ error: 'Voucher hii imefutwa' });
    }
    if (voucher.status === 'expired') {
      return res.status(400).json({ error: 'Voucher hii imeisha muda' });
    }

    // Activate on MikroTik
    if (macAddress) {
      const result = await mikrotik.activateUser(
        macAddress,
        voucher.planDuration,
        process.env.MIKROTIK_HOTSPOT_PROFILE || 'default'
      );

      if (!result.success) {
        return res.status(500).json({
          error: 'Imeshindwa kuwezesha intaneti. Jaribu tena.',
          detail: result.error
        });
      }
    }

    // Calculate expiry
    const ms = parseDuration(voucher.planDuration);

    voucher.status = 'used';
    voucher.usedAt = new Date();
    voucher.activatedAt = new Date();
    voucher.expiresAt = new Date(Date.now() + ms);
    voucher.usedBy = {
      macAddress: macAddress ? macAddress.toUpperCase() : null,
      phone: phone || null,
      ip: req.ip || null
    };
    await voucher.save();

    res.json({
      success: true,
      message: 'Hongera! Intaneti yako imewaka.',
      planName: voucher.planName,
      durationLabel: voucher.durationLabel,
      expiresAt: voucher.expiresAt
    });
  } catch (err) { next(err); }
});

// Helper
function parseDuration(d) {
  const units = {
    '1h': 3600000, '2h': 7200000, '4h': 14400000, '6h': 21600000,
    '12h': 43200000, '1d': 86400000, '3d': 259200000,
    '7d': 604800000, '30d': 2592000000
  };
  return units[d] || 86400000;
}

module.exports = router;