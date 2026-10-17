require('dotenv').config();
const mongoose = require('mongoose');
const Plan = require('./models/Plan');

const PLANS = [
  { name: 'Masaa 6', duration: '6h', durationLabel: 'Masaa 6', price: 500, order: 1, description: 'Masaa 6 ya intaneti' },
  { name: 'Siku 1', duration: '1d', durationLabel: 'Siku 1', price: 1000, order: 2, description: 'Siku moja kamili' },
  { name: 'Siku 3', duration: '3d', durationLabel: 'Siku 3', price: 2000, order: 3, description: 'Siku tatu' },
  { name: 'Wiki 1', duration: '7d', durationLabel: 'Wiki 1', price: 4000, order: 4, description: 'Wiki moja' },
  { name: 'Mwezi 1', duration: '30d', durationLabel: 'Mwezi 1', price: 15000, order: 5, description: 'Mwezi mmoja' }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const existing = await Plan.countDocuments();
    console.log('Existing plans:', existing);

    if (existing > 0) {
      const force = process.argv.includes('--force');
      if (!force) {
        console.log('⚠️  Plans exist. Use --force to overwrite.');
        process.exit(0);
      }
      await Plan.deleteMany({});
      console.log('🗑️  Deleted old plans');
    }

    const created = await Plan.insertMany(PLANS);
    console.log('✅ Created', created.length, 'plans:');
    created.forEach(p => console.log('   -', p.name, '(' + p.duration + ') @ TZS', p.price));

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

seed();