const mpesaService = require('../../services/mpesaService');
const Transaction = require('../../models/financeTransaction');
const { logFinanceAction } = require('../../middlewares/financeAudit');

exports.initiatePayment = async (req, res) => {
  try {
    const { phone, amount, category } = req.body;
    if (!phone || !amount) {
      return res.status(400).json({ message: 'Phone and amount are required.' });
    }
    const result = await mpesaService.stkPush({
      phone,
      amount: Math.round(amount),
      accountReference: (category || 'Offering').charAt(0).toUpperCase() + (category || 'offering').slice(1),
      transactionDesc: `CU ${category || 'offering'} payment`,
    });
    res.json({ message: 'STK push sent. Check your phone.', data: result });
  } catch (err) {
    res.status(500).json({ message: 'M-Pesa request failed.', error: err.message });
  }
};

// Member-facing STK push (authenticated via user_s cookie)
exports.memberPayment = async (req, res) => {
  try {
    const { phone, amount, category } = req.body;
    if (!phone || !amount) {
      return res.status(400).json({ message: 'Phone number and amount are required.' });
    }
    if (amount < 1 || amount > 150000) {
      return res.status(400).json({ message: 'Amount must be between KES 1 and KES 150,000.' });
    }
    const validCategories = ['offering', 'tithe', 'thanksgiving'];
    const cat = validCategories.includes(category) ? category : 'offering';
    const result = await mpesaService.stkPush({
      phone,
      amount: Math.round(amount),
      accountReference: cat.charAt(0).toUpperCase() + cat.slice(1),
      transactionDesc: `KSUCU ${cat} contribution`,
    });
    res.json({ message: 'STK push sent. Check your phone to complete payment.', data: result });
  } catch (err) {
    res.status(500).json({ message: 'M-Pesa request failed. Please try again.', error: err.message });
  }
};

exports.callback = async (req, res) => {
  try {
    const { Body } = req.body;
    if (!Body || !Body.stkCallback) {
      return res.status(400).json({ message: 'Invalid callback.' });
    }
    const { ResultCode, ResultDesc, CallbackMetadata } = Body.stkCallback;
    if (ResultCode === 0 && CallbackMetadata) {
      const items = CallbackMetadata.Item;
      const getValue = (name) => items.find(i => i.Name === name)?.Value;
      const amount = getValue('Amount');
      const mpesaCode = getValue('MpesaReceiptNumber');
      const phone = getValue('PhoneNumber');
      await Transaction.create({
        type: 'cash_in',
        category: 'offering',
        amount,
        source: 'mpesa',
        phone: String(phone),
        description: `M-Pesa payment ${mpesaCode}`,
      });
      console.log(`M-Pesa payment received: ${mpesaCode}, KES ${amount}`);
    } else {
      console.log(`M-Pesa payment failed: ${ResultDesc}`);
    }
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (err) {
    console.error('M-Pesa callback error:', err);
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
};
