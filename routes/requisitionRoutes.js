const express = require('express');
const router = express.Router();
const requisitionController = require('../controllers/requisitionController');
const { overseerAuth } = require('../middlewares/overseerAuthMiddleware');

// Get all requisitions
router.get('/requisitions', requisitionController.getAllRequisitions);

// Get single requisition
router.get('/requisitions/:id', requisitionController.getRequisition);

// Get PDF info and versions for a requisition
router.get('/requisitions/:id/pdf-info', requisitionController.getPDFInfo);

// Create new requisition
router.post('/requisitions', overseerAuth, requisitionController.createRequisition);

// Update requisition
router.put('/requisitions/:id', overseerAuth, requisitionController.updateRequisition);

// Update requisition status
router.patch('/requisitions/:id/status', overseerAuth, requisitionController.updateStatus);

// Approve requisition and send notification
router.patch('/requisitions/:id/approve', overseerAuth, requisitionController.approveRequisition);

// Generate PDF for requisition
router.post('/requisitions/:id/generate-pdf', overseerAuth, requisitionController.generatePDF);

// Download PDF
router.get('/requisitions/:id/pdf/download', requisitionController.downloadPDF);

// User acknowledges receipt
router.post('/requisitions/:id/acknowledge', requisitionController.acknowledgeReceipt);

module.exports = router;
