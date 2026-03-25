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

// Check STK push payment status
exports.checkStatus = async (req, res) => {
  try {
    const { checkoutRequestID } = req.params;
    if (!checkoutRequestID) {
      return res.status(400).json({ message: 'CheckoutRequestID is required.' });
    }
    const result = await mpesaService.stkQuery(checkoutRequestID);

    // Safaricom returns errorCode when still processing
    if (result.errorCode) {
      return res.json({ status: 'pending', message: 'Payment is being processed...' });
    }

    // ResultCode can be string or number
    const code = Number(result.ResultCode);
    let status, message;
    if (code === 0) {
      status = 'success';
      message = 'Payment completed successfully!';
    } else if (code === 1032) {
      status = 'cancelled';
      message = 'You cancelled the payment. You can try again when ready.';
    } else if (code === 1037) {
      status = 'timeout';
      message = 'The payment request timed out. Please try again.';
    } else if (code === 1) {
      status = 'failed';
      message = 'Insufficient funds in your M-Pesa account.';
    } else if (code === 2001) {
      status = 'failed';
      message = 'Wrong M-Pesa PIN entered.';
    } else if (isNaN(code)) {
      status = 'pending';
      message = 'Payment is being processed...';
    } else {
      status = 'failed';
      message = result.ResultDesc || 'Payment failed. Please try again.';
    }
    res.json({ status, message, resultCode: code });
  } catch (err) {
    res.json({ status: 'pending', message: 'Payment is being processed...' });
  }
};

exports.callback = async (req, res) => {
  try {
    const { Body } = req.body;
    if (!Body || !Body.stkCallback) {
      return res.status(400).json({ message: 'Invalid callback.' });
    }
    const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = Body.stkCallback;
    const io = req.app.get('io');

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
      if (io) io.emit('mpesa-payment-result', { checkoutRequestID: CheckoutRequestID, status: 'success', message: 'Payment completed successfully!' });
    } else {
      console.log(`M-Pesa payment failed: ${ResultDesc}`);
      const status = ResultCode === 1032 ? 'cancelled' : ResultCode === 1037 ? 'timeout' : 'failed';
      const message = ResultCode === 1032 ? 'You cancelled the payment.' : ResultCode === 1037 ? 'Payment request timed out.' : ResultDesc || 'Payment failed.';
      if (io) io.emit('mpesa-payment-result', { checkoutRequestID: CheckoutRequestID, status, message });
    }
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (err) {
    console.error('M-Pesa callback error:', err);
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
};
