const express = require('express');
const Plan = require('../models/Plan');
const router = express.Router();

// GET all active plans (public — customer portal)
router.get('/', async (req, res, next) => {
  try {
    const plans = await Plan.find({ active: true }).sort('order price');
    res.json(plans);
  } catch (err) { next(err); }
});

// GET single plan
router.get('/:id', async (req, res, next) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json(plan);
  } catch (err) { next(err); }
});

module.exports = router;