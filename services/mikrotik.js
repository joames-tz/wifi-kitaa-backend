const { connectMikroTik } = require('../config/mikrotik');

/**
 * Create a hotspot user on MikroTik and enable internet for their MAC
 * @param {string} macAddress - Customer's MAC address (AA:BB:CC:DD:EE:FF)
 * @param {string} duration - Duration string: 6h, 1d, 3d, 7d, 30d
 * @param {string} profile - Hotspot profile name
 * @returns {object} { success, username, error }
 */
async function activateUser(macAddress, duration, profile = 'default') {
  let conn;
  try {
    conn = await connectMikroTik();
    
    // Convert duration to MikroTik format
    const uptime = convertDuration(duration);
    
    // Sanitize MAC for username (replace : with -)
    const username = macAddress.replace(/:/g, '-').toUpperCase();
    
    // 1. Remove any existing user with this MAC (avoid duplicates)
    try {
      const existing = await conn.write('/ip/hotspot/user/print', [
        '?name=' + username
      ]);
      if (existing && existing.length > 0) {
        await conn.write('/ip/hotspot/user/remove', [
          '=.id=' + existing[0]['.id']
        ]);
      }
    } catch (e) {
      // Ignore — user didn't exist
    }
    
    // 2. Create new user
    await conn.write('/ip/hotspot/user/add', [
      '=name=' + username,
      '=password=' + username,
      '=mac-address=' + macAddress.toUpperCase(),
      '=limit-uptime=' + uptime,
      '=profile=' + profile,
      '=comment=WiFiPortal purchase ' + new Date().toISOString()
    ]);
    
    // 3. Disconnect any existing session so they reconnect fresh
    try {
      const active = await conn.write('/ip/hotspot/active/print', [
        '?mac-address=' + macAddress.toUpperCase()
      ]);
      if (active && active.length > 0) {
        await conn.write('/ip/hotspot/active/remove', [
          '=.id=' + active[0]['.id']
        ]);
      }
    } catch (e) {
      // Ignore
    }
    
    conn.close();
    return { success: true, username, uptime };
    
  } catch (err) {
    if (conn) conn.close();
    console.error('❌ MikroTik activate error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Remove/expire a user's access
 */
async function deactivateUser(macAddress) {
  let conn;
  try {
    conn = await connectMikroTik();
    const username = macAddress.replace(/:/g, '-').toUpperCase();
    
    const existing = await conn.write('/ip/hotspot/user/print', [
      '?name=' + username
    ]);
    
    if (existing && existing.length > 0) {
      await conn.write('/ip/hotspot/user/remove', [
        '=.id=' + existing[0]['.id']
      ]);
    }
    
    conn.close();
    return { success: true };
  } catch (err) {
    if (conn) conn.close();
    return { success: false, error: err.message };
  }
}

/**
 * Get active users on the hotspot
 */
async function getActiveUsers() {
  let conn;
  try {
    conn = await connectMikroTik();
    const users = await conn.write('/ip/hotspot/active/print');
    conn.close();
    return users || [];
  } catch (err) {
    if (conn) conn.close();
    return [];
  }
}

/**
 * Get all hotspot users created by portal
 */
async function getAllUsers() {
  let conn;
  try {
    conn = await connectMikroTik();
    const users = await conn.write('/ip/hotspot/user/print');
    conn.close();
    return users || [];
  } catch (err) {
    if (conn) conn.close();
    return [];
  }
}

/**
 * Convert our duration format to MikroTik's uptime format
 * 6h -> 6h, 1d -> 1d, 3d -> 3d, 7d -> 1w, 30d -> 30d
 */
function convertDuration(duration) {
  const map = {
    '6h': '6h',
    '12h': '12h',
    '1d': '1d',
    '3d': '3d',
    '7d': '1w',
    '30d': '30d',
    '1h': '1h',
    '2h': '2h',
    '4h': '4h'
  };
  return map[duration] || duration;
}

module.exports = {
  activateUser,
  deactivateUser,
  getActiveUsers,
  getAllUsers
};