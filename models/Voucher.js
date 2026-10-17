const mongoose = require('mongoose');

const voucherSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, index: true },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
  planName: { type: String, required: true },
  planDuration: { type: String, required: true },
  durationLabel: { type: String, default: '' },
  price: { type: Number, required: true },
  note: { type: String, default: '' },
  createdBy: { type: String, default: 'admin' },
  status: {
    type: String,
    enum: ['unused', 'used', 'expired', 'cancelled'],
    default: 'unused',
    index: true
  },
  usedBy: {
    macAddress: { type: String, default: null },
    phone: { type: String, default: null },
    ip: { type: String, default: null }
  },
  batchId: { type: String, default: null, index: true },
  usedAt: { type: Date, default: null },
  activatedAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Voucher', voucherSchema);