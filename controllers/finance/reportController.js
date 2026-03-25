const Transaction = require("../../models/financeTransaction");

exports.getFinancialStatement = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const match = {};
    if (startDate && endDate) {
      match.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    const breakdown = await Transaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: { type: "$type", category: "$category" },
          total_amount: { $sum: "$amount" },
          transaction_count: { $sum: 1 },
        },
      },
      { $sort: { "_id.type": 1, "_id.category": 1 } },
    ]);
    const totals = await Transaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total_income: { $sum: { $cond: [{ $eq: ["$type", "cash_in"] }, "$amount", 0] } },
          total_expenses: { $sum: { $cond: [{ $eq: ["$type", "cash_out"] }, "$amount", 0] } },
        },
      },
    ]);
    const summary = totals[0] || { total_income: 0, total_expenses: 0 };
    res.json({
      breakdown,
      summary: {
        total_income: summary.total_income,
        total_expenses: summary.total_expenses,
        net_balance: summary.total_income - summary.total_expenses,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
};

exports.getCategoryBreakdown = async (req, res) => {
  try {
    const result = await Transaction.aggregate([
      { $match: { type: "cash_in" } },
      { $group: { _id: "$category", total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
};
