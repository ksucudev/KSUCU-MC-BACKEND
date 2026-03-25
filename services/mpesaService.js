const https = require('https');

class MpesaService {
  constructor() {
    this.consumerKey = process.env.MPESA_CONSUMER_KEY;
    this.consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    this.shortcode = process.env.MPESA_SHORTCODE;
    this.passkey = process.env.MPESA_PASSKEY;
    this.callbackUrl = process.env.MPESA_CALLBACK_URL;
    this.baseUrl = 'api.safaricom.co.ke';
  }

  _request(options, postData) {
    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch {
            reject(new Error(`Invalid JSON response: ${body}`));
          }
        });
      });
      req.on('error', reject);
      if (postData) req.write(postData);
      req.end();
    });
  }

  async getAccessToken() {
    const credentials = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
    const res = await this._request({
      hostname: this.baseUrl,
      path: '/oauth/v1/generate?grant_type=client_credentials',
      method: 'GET',
      headers: { Authorization: `Basic ${credentials}` },
    });
    if (!res.data.access_token) {
      throw new Error(`Failed to get M-Pesa access token: ${JSON.stringify(res.data)}`);
    }
    return res.data.access_token;
  }

  async stkPush({ phone, amount, accountReference, transactionDesc }) {
    const token = await this.getAccessToken();
    const timestamp = this.getTimestamp();
    const password = Buffer.from(`${this.shortcode}${this.passkey}${timestamp}`).toString('base64');
    const formattedPhone = this.formatPhoneNumber(phone);
    const payload = JSON.stringify({
      BusinessShortCode: this.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount),
      PartyA: formattedPhone,
      PartyB: this.shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: this.callbackUrl,
      AccountReference: accountReference,
      TransactionDesc: transactionDesc,
    });
    const res = await this._request({
      hostname: this.baseUrl,
      path: '/mpesa/stkpush/v1/processrequest',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }, payload);
    if (res.status !== 200 || res.data.errorCode) {
      throw new Error(`M-Pesa STK push failed: ${JSON.stringify(res.data)}`);
    }
    return res.data;
  }

  async stkQuery(checkoutRequestID) {
    const token = await this.getAccessToken();
    const timestamp = this.getTimestamp();
    const password = Buffer.from(`${this.shortcode}${this.passkey}${timestamp}`).toString('base64');
    const payload = JSON.stringify({
      BusinessShortCode: this.shortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestID,
    });
    const res = await this._request({
      hostname: this.baseUrl,
      path: '/mpesa/stkpushquery/v1/query',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }, payload);
    return res.data;
  }

  formatPhoneNumber(phone) {
    let formatted = String(phone).replace(/\s+/g, '');
    if (formatted.startsWith('0')) formatted = '254' + formatted.substring(1);
    else if (formatted.startsWith('+')) formatted = formatted.substring(1);
    return formatted;
  }

  getTimestamp() {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  }
}

module.exports = new MpesaService();
