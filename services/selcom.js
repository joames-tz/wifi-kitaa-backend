const axios = require('axios');

/**
 * Get auth token from Selcom
 */
async function getAuthToken() {
  const { SELCOM_API_KEY, SELCOM_API_SECRET, SELCOM_BASE_URL } = process.env;

  if (!SELCOM_API_KEY || !SELCOM_API_SECRET) {
    throw new Error('Selcom credentials not configured');
  }

  const auth = Buffer.from(SELCOM_API_KEY + ':' + SELCOM_API_SECRET).toString('base64');

  const res = await axios.post(
    SELCOM_BASE_URL + '/checkout/create-order-minimal',
    {},
    {
      headers: {
        'Authorization': 'Bearer ' + auth,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }
  );

  return res.data;
}

/**
 * Push USSD payment prompt to customer's phone
 */
async function pushUSSD(params) {
  const { SELCOM_VENDOR_ID, SELCOM_BASE_URL } = process.env;

  if (!SELCOM_VENDOR_ID) {
    throw new Error('Selcom Vendor ID not configured');
  }

  const normalizedPhone = normalizePhone(params.phone);

  const methodMap = {
    'mpesa': 'M-Pesa',
    'tigopesa': 'Tigo Pesa',
    'airtelmoney': 'Airtel Money',
    'halopesa': 'Halopesa'
  };

  const payload = {
    vendor: SELCOM_VENDOR_ID,
    order_id: params.orderId,
    buyer_email: process.env.BUSINESS_EMAIL || 'customer@example.com',
    buyer_name: params.name || 'Customer',
    buyer_phone: normalizedPhone,
    amount: params.amount,
    currency: 'TZS',
    payment_method: methodMap[params.method] || 'M-Pesa',
    redirect_url: (process.env.SERVER_URL || '') + '/api/payments/callback',
    cancel_url: (process.env.SERVER_URL || '') + '/api/payments/cancel',
    webhook_url: (process.env.SERVER_URL || '') + '/api/payments/webhook',
    no_of_items: 1
  };

  const authToken = await getAuthToken();

  const res = await axios.post(
    SELCOM_BASE_URL + '/checkout/create-order',
    payload,
    {
      headers: {
        'Authorization': 'Bearer ' + authToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }
  );

  return res.data;
}

/**
 * Verify payment status
 */
async function checkPaymentStatus(orderId) {
  const { SELCOM_VENDOR_ID, SELCOM_BASE_URL } = process.env;
  const authToken = await getAuthToken();

  const res = await axios.get(
    SELCOM_BASE_URL + '/checkout/order-status?order_id=' + orderId,
    {
      headers: {
        'Authorization': 'Bearer ' + authToken,
        'X-Vendor-Id': SELCOM_VENDOR_ID
      }
    }
  );

  return res.data;
}

/**
 * Normalize phone number to 255XXXXXXXXX
 */
function normalizePhone(phone) {
  let p = String(phone).replace(/[^0-9]/g, '');
  if (p.startsWith('0')) p = '255' + p.slice(1);
  else if (p.length === 9 && p.startsWith('7')) p = '255' + p;
  return p;
}

module.exports = {
  getAuthToken,
  pushUSSD,
  checkPaymentStatus,
  normalizePhone
};