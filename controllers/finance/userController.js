const User = require("../../models/user");
const { logFinanceAction } = require("../../middlewares/financeAudit");

exports.getAll = async (req, res) => {
  try {
    const users = await User.find().select("username email phone role financeRole").sort({ username: 1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
};

exports.getFinanceUsers = async (req, res) => {
  try {
    const users = await User.find({ financeRole: { $ne: null } })
      .select("username email phone role financeRole")
      .sort({ financeRole: 1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
};

exports.assignRole = async (req, res) => {
  try {
    const { financeRole } = req.body;
    const validRoles = ['treasurer', 'auditor', 'chair_accounts', 'chairperson', null];
    if (!validRoles.includes(financeRole)) {
      return res.status(400).json({ message: "Invalid finance role." });
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { financeRole },
      { new: true }
    ).select("username email phone role financeRole");
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    await logFinanceAction(req.user.id, "assign_finance_role", "users", req.params.id, { financeRole });
    res.json({ message: `Finance role ${financeRole ? 'assigned' : 'removed'}.`, user });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
};
