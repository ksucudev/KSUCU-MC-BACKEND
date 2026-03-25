const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const receiptsDir = "uploads/finance/receipts/";
const vouchersDir = "uploads/finance/vouchers/";

[receiptsDir, vouchersDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const allowedMimeTypes = ["image/jpeg", "image/png", "application/pdf"];

const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("INVALID_FILE_TYPE"), false);
  }
};

const createStorage = (destinationPath) => {
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, destinationPath),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const randomString = crypto.randomBytes(8).toString("hex");
      cb(null, `${file.fieldname}-${Date.now()}-${randomString}${ext}`);
    },
  });
};

const limits = { fileSize: 5 * 1024 * 1024 }; // 5 MB

const uploadReceipt = multer({ storage: createStorage(receiptsDir), fileFilter, limits });
const uploadVoucher = multer({ storage: createStorage(vouchersDir), fileFilter, limits });

module.exports = { uploadReceipt, uploadVoucher };
