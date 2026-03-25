const Transaction = require("../../models/financeTransaction");
const { logFinanceAction } = require("../../middlewares/financeAudit");

exports.create = async (req, res) => {
  try {
    const data = { ...req.body, recorded_by: req.user.id };
    if (req.file) {
      data.receipt_url = req.file.path.replace(/\\/g, "/");
    }
    const transaction = await Transaction.create(data);
    await logFinanceAction(req.user.id, "create", "transactions", transaction._id, data);
    res.status(201).json({ message: "Transaction recorded.", id: transaction._id });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.startDate && req.query.endDate) {
      filter.createdAt = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate),
      };
    }
    const transactions = await Transaction.find(filter)
      .populate("recorded_by", "username email")
      .sort({ createdAt: -1 });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id).populate("recorded_by", "username email");
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found." });
    }
    res.json(transaction);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
};

exports.getMyContributions = async (req, res) => {
  try {
    // Match by user ID or by phone number (for M-Pesa payments)
    const User = require("../../models/user");
    const user = await User.findById(req.user.id).select("phone");
    const query = { type: "cash_in" };

    if (user && user.phone) {
      // Format phone to 254... to match M-Pesa format
      let phone254 = user.phone.replace(/\s+/g, '');
      if (phone254.startsWith('0')) phone254 = '254' + phone254.substring(1);
      else if (phone254.startsWith('+')) phone254 = phone254.substring(1);
      query.$or = [
        { recorded_by: req.user.id },
        { phone: phone254 },
        { phone: user.phone },
      ];
    } else {
      query.recorded_by = req.user.id;
    }

    const transactions = await Transaction.find(query).sort({ createdAt: -1 });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
};

exports.getBalance = async (req, res) => {
  try {
    const result = await Transaction.aggregate([
      {
        $group: {
          _id: null,
          total_in: { $sum: { $cond: [{ $eq: ["$type", "cash_in"] }, "$amount", 0] } },
          total_out: { $sum: { $cond: [{ $eq: ["$type", "cash_out"] }, "$amount", 0] } },
        },
      },
    ]);
    const data = result[0] || { total_in: 0, total_out: 0 };
    res.json({
      total_in: data.total_in,
      total_out: data.total_out,
      balance: data.total_in - data.total_out,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
};
