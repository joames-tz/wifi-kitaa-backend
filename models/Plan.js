const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  name: { type: String, required: true },         // e.g. "Masaa 6"
  duration: { type: String, required: true },     // e.g. "6h", "1d", "3d", "7d", "30d"
  durationLabel: { type: String, required: true },// e.g. "Masaa 6", "Siku 1"
  price: { type: Number, required: true },        // in TZS
  description: { type: String, default: '' },
  active: { type: Boolean, default: true },
  order: { type: Number, default: 0 }             // display order
}, { timestamps: true });

module.exports = mongoose.model('Plan', planSchema);