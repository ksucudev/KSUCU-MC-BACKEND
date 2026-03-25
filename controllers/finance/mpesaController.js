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
      accountReference: 'CUFinance',
      transactionDesc: `CU ${category || 'contribution'} payment`,
    });
    res.json({ message: 'STK push sent. Check your phone.', data: result });
  } catch (err) {
    res.status(500).json({ message: 'M-Pesa request failed.', error: err.message });
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
