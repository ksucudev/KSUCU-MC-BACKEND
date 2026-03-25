const Asset = require("../../models/financeAsset");
const { logFinanceAction } = require("../../middlewares/financeAudit");

exports.create = async (req, res) => {
  try {
    const data = { ...req.body, recorded_by: req.user.id };
    const asset = await Asset.create(data);
    await logFinanceAction(req.user.id, "create", "assets", asset._id, data);
    res.status(201).json({ message: "Asset recorded.", id: asset._id });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const assets = await Asset.find().sort({ createdAt: -1 });
    res.json(assets);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) return res.status(404).json({ message: "Asset not found." });
    res.json(asset);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    await Asset.findByIdAndUpdate(req.params.id, req.body);
    await logFinanceAction(req.user.id, "update", "assets", req.params.id, req.body);
    res.json({ message: "Asset updated." });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    await Asset.findByIdAndDelete(req.params.id);
    await logFinanceAction(req.user.id, "delete", "assets", req.params.id, {});
    res.json({ message: "Asset deleted." });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
};
