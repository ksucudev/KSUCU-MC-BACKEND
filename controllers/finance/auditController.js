const AuditLog = require("../../models/financeAuditLog");

exports.getAll = async (req, res) => {
  try {
    const logs = await AuditLog.find()
      .populate("user_id", "username email")
      .sort({ createdAt: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
};
