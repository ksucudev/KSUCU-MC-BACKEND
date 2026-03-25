const bcrypt = require("bcryptjs");
const Patron = require("../models/patron");
const SuperAdmin = require("../models/superAdmin");
const AdmissionAdmin = require("../models/admissionAdmin");
const BsAdmin = require("../models/bsAdmin");
const MissionAdmin = require("../models/missionAdmin");
const AdminNews = require("../models/adminNews");
const Overseer = require("../models/overseer");
const FinanceUser = require("../models/financeUser");

const modelMap = {
  patron: Patron,
  superadmin: SuperAdmin,
  admission: AdmissionAdmin,
  bs: BsAdmin,
  mission: MissionAdmin,
  news: AdminNews,
  overseer: Overseer,
  chairperson: null, // special case
};

exports.getAll = async (req, res) => {
  try {
    const type = req.params.type.toLowerCase();

    if (!(type in modelMap)) {
      return res.status(400).json({ message: `Invalid admin type: ${type}` });
    }

    let users;
    if (type === "chairperson") {
      users = await FinanceUser.find({ role: "chairperson" })
        .select("-password")
        .sort({ email: 1 });
    } else {
      const Model = modelMap[type];
      users = await Model.find()
        .select("-password")
        .sort({ email: 1 });
    }

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const type = req.params.type.toLowerCase();

    if (!(type in modelMap)) {
      return res.status(400).json({ message: `Invalid admin type: ${type}` });
    }

    const { email, password, phone } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let user;

    if (type === "patron") {
      const count = await Patron.countDocuments();
      if (count > 0) {
        return res.status(400).json({ message: "A patron account already exists." });
      }
      user = await Patron.create({ email, password: hashedPassword, phone });
    } else if (type === "chairperson") {
      const existing = await FinanceUser.findOne({ email });
      if (existing) {
        return res.status(400).json({ message: "A user with this email already exists." });
      }
      user = await FinanceUser.create({
        email,
        password: hashedPassword,
        role: "chairperson",
        phone,
      });
    } else {
      const Model = modelMap[type];
      const existing = await Model.findOne({ email });
      if (existing) {
        return res.status(400).json({ message: "A user with this email already exists." });
      }
      user = await Model.create({ email, password: hashedPassword, phone });
    }

    const { password: _, ...userObj } = user.toObject();
    res.status(201).json({ message: "Admin created.", user: userObj });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const type = req.params.type.toLowerCase();
    const { id } = req.params;
    const { password } = req.body;

    if (!(type in modelMap)) {
      return res.status(400).json({ message: `Invalid admin type: ${type}` });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }

    let user;
    if (type === "chairperson") {
      user = await FinanceUser.findById(id);
    } else {
      const Model = modelMap[type];
      user = await Model.findById(id);
    }

    if (!user) {
      return res.status(404).json({ message: "Admin not found." });
    }

    user.password = await bcrypt.hash(password, 10);
    await user.save();

    res.json({ message: `Password reset for ${user.email}.` });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
};

exports.deleteAdmin = async (req, res) => {
  try {
    const type = req.params.type.toLowerCase();
    const { id } = req.params;

    if (!(type in modelMap)) {
      return res.status(400).json({ message: `Invalid admin type: ${type}` });
    }

    let user;
    if (type === "chairperson") {
      user = await FinanceUser.findByIdAndDelete(id);
    } else {
      const Model = modelMap[type];
      user = await Model.findByIdAndDelete(id);
    }

    if (!user) {
      return res.status(404).json({ message: "Admin not found." });
    }

    res.json({ message: `Admin ${user.email} deleted.` });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
};
