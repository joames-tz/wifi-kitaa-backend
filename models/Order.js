const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  // Customer info
  phone: { type: String, required: true, index: true },
  macAddress: { type: String, default: null, index: true },
  ipAddress: { type: String, default: null },

  // Plan info
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
  planName: { type: String, required: true },
  planDuration: { type: String, required: true },
  amount: { type: Number, required: true },

  // Payment
  paymentMethod: { type: String, enum: ['mpesa', 'tigopesa', 'airtelmoney', 'halopesa', 'cash'], required: true },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'cancelled'], default: 'pending' },
  paymentRef: { type: String, default: null },     // Selcom transaction ID
  paymentRaw: { type: Object, default: null },     // full Selcom response

  // Fulfillment
  status: { type: String, enum: ['pending', 'active', 'expired', 'failed'], default: 'pending' },
  activatedAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null },
  mikrotikUser: { type: String, default: null }    // username created in MikroTik

}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);