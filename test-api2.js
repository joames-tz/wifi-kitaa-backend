const RouterOSAPI = require('node-routeros').RouterOSAPI;

const conn = new RouterOSAPI({
  host: '192.168.88.1',
  user: 'wifiportal',
  password: 'jo&londu7y',
  port: 8728,
  timeout: 10
});

conn.connect()
  .then(() => {
    console.log('✅ Connected to MikroTik!');
    return conn.write('/system/resource/print');
  })
  .then((data) => {
    console.log('✅ Router info:');
    console.log('  Board:', data[0]['board-name']);
    console.log('  Version:', data[0].version);
    console.log('  Uptime:', data[0].uptime);
    console.log('\n🎉 API works!');
    conn.close();
  })
  .catch((err) => {
    console.error('❌ Error:', err);
    conn.close();
  });