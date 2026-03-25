const Requisition = require("../../models/financeRequisition");
const { logFinanceAction } = require("../../middlewares/financeAudit");

exports.create = async (req, res) => {
  try {
    const data = { ...req.body, requested_by: req.user.id };
    const requisition = await Requisition.create(data);
    await logFinanceAction(req.user.id, "create", "requisitions", requisition._id, data);
    res.status(201).json({ message: "Requisition submitted.", id: requisition._id });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.startDate || req.query.endDate) {
      filter.createdAt = {};
      if (req.query.startDate) filter.createdAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate) filter.createdAt.$lte = new Date(req.query.endDate);
    }
    const requisitions = await Requisition.find(filter)
      .populate("requested_by", "username email")
      .populate("approved_by", "username email")
      .sort({ createdAt: -1 });
    res.json(requisitions);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const requisition = await Requisition.findById(req.params.id)
      .populate("requested_by", "username email")
      .populate("approved_by", "username email");
    if (!requisition) {
      return res.status(404).json({ message: "Requisition not found." });
    }
    res.json(requisition);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
};

exports.approve = async (req, res) => {
  try {
    await Requisition.findByIdAndUpdate(req.params.id, {
      status: "approved",
      approved_by: req.user.id,
    });
    await logFinanceAction(req.user.id, "approve", "requisitions", req.params.id, {});
    res.json({ message: "Requisition approved." });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
};

exports.reject = async (req, res) => {
  try {
    await Requisition.findByIdAndUpdate(req.params.id, {
      status: "rejected",
      approved_by: req.user.id,
    });
    await logFinanceAction(req.user.id, "reject", "requisitions", req.params.id, {});
    res.json({ message: "Requisition rejected." });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
};

exports.complete = async (req, res) => {
  try {
    const { amount_spent } = req.body;
    const voucher_url = req.file ? req.file.path.replace(/\\/g, "/") : null;
    await Requisition.findByIdAndUpdate(req.params.id, {
      status: "completed",
      amount_spent,
      voucher_url,
    });
    await logFinanceAction(req.user.id, "complete", "requisitions", req.params.id, { amount_spent });
    res.json({ message: "Requisition completed." });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
};
