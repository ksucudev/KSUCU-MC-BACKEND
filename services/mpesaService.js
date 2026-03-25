class MpesaService {
  constructor() {
    this.consumerKey = process.env.MPESA_CONSUMER_KEY;
    this.consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    this.shortcode = process.env.MPESA_SHORTCODE;
    this.passkey = process.env.MPESA_PASSKEY;
    this.callbackUrl = process.env.MPESA_CALLBACK_URL;
    this.baseUrl = 'https://api.safaricom.co.ke';
  }

  async getAccessToken() {
    const credentials = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
    const response = await fetch(
      `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      { method: 'POST', headers: { Authorization: `Basic ${credentials}` } }
    );
    if (!response.ok) throw new Error(`Failed to get M-Pesa access token: ${response.statusText}`);
    const data = await response.json();
    return data.access_token;
  }

  async stkPush({ phone, amount, accountReference, transactionDesc }) {
    const token = await this.getAccessToken();
    const timestamp = this.getTimestamp();
    const password = Buffer.from(`${this.shortcode}${this.passkey}${timestamp}`).toString('base64');
    const formattedPhone = this.formatPhoneNumber(phone);
    const response = await fetch(
      `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          BusinessShortCode: this.shortcode, Password: password, Timestamp: timestamp,
          TransactionType: 'CustomerPayBillOnline', Amount: Math.round(amount),
          PartyA: formattedPhone, PartyB: this.shortcode, PhoneNumber: formattedPhone,
          CallBackURL: this.callbackUrl, AccountReference: accountReference, TransactionDesc: transactionDesc,
        }),
      }
    );
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`M-Pesa STK push failed: ${errorData}`);
    }
    return await response.json();
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
