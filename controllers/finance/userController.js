const bcrypt = require("bcryptjs");
const FinanceUser = require("../../models/financeUser");
const { logFinanceAction } = require("../../middlewares/financeAudit");

exports.getAll = async (req, res) => {
  try {
    const users = await FinanceUser.find()
      .select("-password")
      .sort({ role: 1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;

    const existing = await FinanceUser.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "A finance user with this email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await FinanceUser.create({
      name,
      email,
      password: hashedPassword,
      role,
      phone,
    });

    await logFinanceAction(req.user.id, "create_finance_user", "finance_users", user._id, {
      email,
      role,
    });

    const { password: _, ...userObj } = user.toObject();
    res.status(201).json({ message: "Finance user created.", user: userObj });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    const user = await FinanceUser.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "Finance user not found." });
    }

    user.password = await bcrypt.hash(password, 10);
    await user.save();

    await logFinanceAction(req.user.id, "reset_finance_password", "finance_users", req.params.id, {
      email: user.email,
    });

    res.json({ message: `Password reset for ${user.email}.` });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await FinanceUser.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "Finance user not found." });
    }

    await logFinanceAction(req.user.id, "delete_finance_user", "finance_users", req.params.id, {
      email: user.email,
      role: user.role,
    });

    res.json({ message: "Finance user deleted." });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
};
