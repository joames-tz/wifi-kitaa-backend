const RouterOSAPI = require('node-routeros').RouterOSAPI;

async function connectMikroTik() {
  const conn = new RouterOSAPI({
    host: process.env.MIKROTIK_HOST,
    port: parseInt(process.env.MIKROTIK_PORT),
    user: process.env.MIKROTIK_USER,
    password: process.env.MIKROTIK_PASS,
    timeout: 10
  });
  await conn.connect();
  return conn;
}

async function testConnection() {
  try {
    const conn = await connectMikroTik();
    const data = await conn.write('/system/resource/print');
    conn.close();
    console.log('✅ MikroTik connected (' + data[0]['board-name'] + ', v' + data[0].version + ')');
    return true;
  } catch (err) {
    console.error('❌ MikroTik error:', err.message);
    return false;
  }
}

module.exports = { connectMikroTik, testConnection };