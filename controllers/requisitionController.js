const Requisition = require('../models/requisition');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { sendRequisitionApprovalEmail } = require('../helperModules/sendmail');

const requisitionController = {
  // Get all requisitions
  getAllRequisitions: async (req, res) => {
    try {
      const requisitions = await Requisition.find().sort({ submittedAt: -1 });
      res.json(requisitions);
    } catch (error) {
      console.error('Error fetching requisitions:', error);
      res.status(500).json({ error: 'Failed to fetch requisitions' });
    }
  },

  // Get single requisition
  getRequisition: async (req, res) => {
    try {
      const requisition = await Requisition.findById(req.params.id);
      if (!requisition) {
        return res.status(404).json({ error: 'Requisition not found' });
      }
      res.json(requisition);
    } catch (error) {
      console.error('Error fetching requisition:', error);
      res.status(500).json({ error: 'Failed to fetch requisition' });
    }
  },

  // Create new requisition
  createRequisition: async (req, res) => {
    try {
      const newRequisition = new Requisition(req.body);
      const savedRequisition = await newRequisition.save();
      res.status(201).json(savedRequisition);
    } catch (error) {
      console.error('Error creating requisition:', error);
      res.status(500).json({ error: 'Failed to create requisition' });
    }
  },

  // Update requisition
  updateRequisition: async (req, res) => {
    try {
      const updatedRequisition = await Requisition.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      );
      if (!updatedRequisition) {
        return res.status(404).json({ error: 'Requisition not found' });
      }
      res.json(updatedRequisition);
    } catch (error) {
      console.error('Error updating requisition:', error);
      res.status(500).json({ error: 'Failed to update requisition' });
    }
  },

  // Update requisition status
  updateStatus: async (req, res) => {
    try {
      const { status, releasedBy, comments, assetTransfer } = req.body;
      const updateData = { status };

      if (status === 'released' && releasedBy) {
        updateData.releasedBy = releasedBy;
        updateData.releasedAt = new Date();
      }

      if (status === 'returned') {
        updateData.returnedAt = new Date();
      }

      if (comments) {
        updateData.comments = comments;
      }

      if (assetTransfer) {
        updateData.assetTransfer = assetTransfer;
      }

      const updatedRequisition = await Requisition.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      );

      if (!updatedRequisition) {
        return res.status(404).json({ error: 'Requisition not found' });
      }

      res.json(updatedRequisition);
    } catch (error) {
      console.error('Error updating requisition status:', error);
      res.status(500).json({ error: 'Failed to update requisition status' });
    }
  },

  // Approve requisition and send notification
  approveRequisition: async (req, res) => {
    try {
      const { approvedBy, comments, approvalSignature, assetTransfer } = req.body;

      const updateData = {
        status: 'approved',
        approvedBy: approvedBy || 'Admin',
        approvedAt: new Date(),
        comments: comments || ''
      };

      // If admin signature is provided, add it
      if (approvalSignature) {
        updateData.approvalSignature = approvalSignature;
        updateData.approvalSignatureDate = new Date();
      }

      if (assetTransfer) {
        updateData.assetTransfer = assetTransfer;
      }

      const updatedRequisition = await Requisition.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      );

      if (!updatedRequisition) {
        return res.status(404).json({ error: 'Requisition not found' });
      }

      // Send approval notification email
      try {
        await sendRequisitionApprovalEmail(updatedRequisition);

        // Mark notification as sent
        updatedRequisition.notificationSent = true;
        await updatedRequisition.save();
      } catch (emailError) {
        console.error('Error sending approval email:', emailError);
        // Don't fail the approval if email fails - notification will be queued
      }

      res.json({
        message: 'Requisition approved successfully',
        requisition: updatedRequisition,
        notificationSent: updatedRequisition.notificationSent
      });
    } catch (error) {
      console.error('Error approving requisition:', error);
      res.status(500).json({ error: 'Failed to approve requisition' });
    }
  },

  // Generate PDF for requisition
  generatePDF: async (req, res) => {
    try {
      const requisition = await Requisition.findById(req.params.id);

      if (!requisition) {
        return res.status(404).json({ error: 'Requisition not found' });
      }

      // Get current user from request
      const currentUser = req.user?.name || req.user?.username || req.headers['x-user-name'];
      const isAdmin = req.user?.role === 'admin' || req.sessionStore?.adminAuth === 'Overseer';

      // Check authorization: only admin or the requisition creator can generate PDF
      if (!isAdmin && currentUser !== requisition.recipientName) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Only admins and the requisition creator can generate PDFs'
        });
      }

      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(__dirname, '../uploads/requisitions');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const fileName = `requisition-${requisition._id}-${Date.now()}.pdf`;
      const filePath = path.join(uploadsDir, fileName);

      // Create PDF document
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      // Institution Header
      doc.fontSize(16).font('Helvetica-Bold').text('KISII UNIVERSITY CHRISTIAN UNION', { align: 'center' });
      doc.fontSize(11).font('Helvetica').text('Missions & Community Programs', { align: 'center' });
      doc.fontSize(10).font('Helvetica').text('Asset Requisition Form', { align: 'center' });
      doc.moveDown(0.3);

      // Draw decorative line
      doc.strokeColor('#730051').lineWidth(2);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.strokeColor('black').lineWidth(1);
      doc.moveDown(0.5);

      // Form Reference and Date
      doc.fontSize(9).font('Helvetica');
      doc.text(`Form Reference: REQ-${requisition._id}`, 40);
      doc.text(`Date Submitted: ${new Date(requisition.submittedAt).toLocaleString()}`, 300);
      doc.moveDown(0.5);

      // Divider
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.5);

      // SECTION 1: RECIPIENT INFORMATION
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#730051').text('1. RECIPIENT INFORMATION', 40);
      doc.fillColor('black');
      doc.fontSize(9).font('Helvetica');

      const col1X = 40;
      const col2X = 300;

      doc.text('Full Name:', col1X);
      doc.fontSize(10).font('Helvetica-Bold').text(requisition.recipientName, col1X + 50);
      doc.fontSize(9).font('Helvetica');
      doc.text('Contact Phone:', col2X);
      doc.fontSize(10).font('Helvetica-Bold').text(requisition.recipientPhone, col2X + 70);

      doc.moveDown(0.5);
      doc.fontSize(9).font('Helvetica').text('Purpose of Requisition:', col1X);
      doc.fontSize(10).font('Helvetica-Bold').text(requisition.purpose, col1X + 80);
      doc.moveDown(1);

      // SECTION 2: ITEMS REQUESTED
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#730051').text('2. ITEMS REQUESTED', 40);
      doc.fillColor('black');
      doc.moveDown(0.3);

      // Table setup
      const tableTop = doc.y;
      const tableHeaders = ['Item Name', 'Quantity', 'Description'];
      const colWidths = [200, 80, 155];
      const colPositions = [40, 240, 320];
      const rowHeight = 25;

      // Table Header Background
      doc.rect(40, tableTop, 515, rowHeight).fillAndStroke('#730051', '#730051');
      doc.fillColor('white').fontSize(9).font('Helvetica-Bold');

      tableHeaders.forEach((header, i) => {
        doc.text(header, colPositions[i] + 5, tableTop + 8, { width: colWidths[i] - 10 });
      });

      // Table Rows
      let currentY = tableTop + rowHeight;
      doc.fillColor('black').font('Helvetica');

      requisition.items.forEach((item, index) => {
        // Alternate row colors
        if (index % 2 === 0) {
          doc.fillColor('#f0f0f0');
          doc.rect(40, currentY, 515, rowHeight).fill();
          doc.fillColor('black');
        }

        // Draw borders
        doc.strokeColor('#cccccc');
        doc.rect(40, currentY, 515, rowHeight).stroke();

        // Text
        doc.fontSize(9).font('Helvetica');
        doc.text(item.itemName || '-', colPositions[0] + 5, currentY + 5, { width: colWidths[0] - 10 });
        doc.text(item.quantity.toString(), colPositions[1] + 5, currentY + 5, { width: colWidths[1] - 10 });
        doc.text(item.description || '-', colPositions[2] + 5, currentY + 5, { width: colWidths[2] - 10 });

        currentY += rowHeight;
      });

      doc.moveDown(1);

      // SECTION 3: TIMELINE & AMOUNT
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#730051').text('3. TIMELINE & FINANCIAL DETAILS', 40);
      doc.fillColor('black');
      doc.fontSize(9).font('Helvetica');

      doc.text('Expected Time to Receive:', col1X);
      doc.fontSize(10).font('Helvetica-Bold').text(new Date(requisition.timeReceived).toLocaleString(), col1X + 130);

      doc.fontSize(9).font('Helvetica').text('Expected Return Time:', col2X);
      doc.fontSize(10).font('Helvetica-Bold').text(new Date(requisition.timeToReturn).toLocaleString(), col2X + 120);

      doc.moveDown(0.5);
      doc.fontSize(9).font('Helvetica').text('Total Amount (KES):', col1X);
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#28a745').text(requisition.totalAmount.toString(), col1X + 90);
      doc.fillColor('black');
      doc.moveDown(1);

      // SECTION 4: APPROVAL STATUS
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#730051').text('4. APPROVAL STATUS', 40);
      doc.fillColor('black');
      doc.fontSize(9).font('Helvetica');

      const statusColor = requisition.status === 'approved' ? '#28a745' :
        requisition.status === 'rejected' ? '#dc3545' :
          requisition.status === 'pending' ? '#ffc107' : '#6c757d';

      doc.fillColor(statusColor).font('Helvetica-Bold').text(`Status: ${requisition.status.toUpperCase()}`, col1X, doc.y);
      doc.fillColor('black').font('Helvetica');

      if (requisition.approvedBy) {
        doc.moveDown(0.3);
        doc.text('Approved By:', col1X);
        doc.fontSize(10).font('Helvetica-Bold').text(requisition.approvedBy, col1X + 70);
        doc.fontSize(9).font('Helvetica').text('Approved Date:', col2X);
        doc.fontSize(10).font('Helvetica-Bold').text(new Date(requisition.approvedAt).toLocaleString(), col2X + 80);
      }

      if (requisition.comments) {
        doc.moveDown(0.3);
        doc.fontSize(9).font('Helvetica').text('Admin Comments:', col1X);
        doc.fontSize(10).text(requisition.comments, col1X + 80, doc.y, { width: 400 });
      }

      doc.moveDown(1);

      // SECTION 5: ADMIN APPROVAL SIGNATURE
      if (requisition.approvedBy && requisition.status === 'approved') {
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#730051').text('5. APPROVAL AUTHORIZATION', 40);
        doc.fillColor('black');
        doc.moveDown(0.3);

        const approvalSigY = doc.y;
        const sigWidth = 140;
        const sigHeight = 45;

        // Signature box
        doc.rect(40, approvalSigY, sigWidth, sigHeight).stroke();
        doc.text('(Signature)', 40 + 10, approvalSigY + 50);

        if (requisition.approvalSignature) {
          try {
            const signatureData = requisition.approvalSignature;
            if (signatureData.startsWith('data:image')) {
              const base64Data = signatureData.replace(/^data:image\/\w+;base64,/, '');
              const buffer = Buffer.from(base64Data, 'base64');
              doc.image(buffer, 40, approvalSigY, { width: sigWidth, height: sigHeight });
            }
          } catch (err) {
            console.warn('Could not embed approval signature:', err.message);
          }
        }

        // Info below signature
        doc.fontSize(8).font('Helvetica');
        doc.text(requisition.approvedBy, 40, approvalSigY + sigHeight + 5);
        doc.text('Authorized Officer', 40, approvalSigY + sigHeight + 15);
        if (requisition.approvalSignatureDate) {
          doc.text(`Signed: ${new Date(requisition.approvalSignatureDate).toLocaleDateString()}`, 40, approvalSigY + sigHeight + 25);
        }

        doc.moveDown(2);
      }

      // SECTION 6: ASSET TRANSFER SIGNATURES
      if (requisition.assetTransfer) {
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#730051').text('6. ASSET TRANSFER & RECIPIENT SIGNATURES', 40);
        doc.fillColor('black');
        doc.moveDown(0.3);

        const transferSigY = doc.y;
        const transferSigWidth = 130;
        const transferSigHeight = 50;
        const transferGap = 200;

        // Received By
        doc.rect(40, transferSigY, transferSigWidth, transferSigHeight).stroke();
        doc.text('(Signature)', 40 + 10, transferSigY + 55);

        if (requisition.assetTransfer.receivedBySignature) {
          try {
            const signatureData = requisition.assetTransfer.receivedBySignature;
            if (signatureData.startsWith('data:image')) {
              const base64Data = signatureData.replace(/^data:image\/\w+;base64,/, '');
              const buffer = Buffer.from(base64Data, 'base64');
              doc.image(buffer, 40, transferSigY, { width: transferSigWidth, height: transferSigHeight });
            }
          } catch (err) {
            console.warn('Could not embed received signature:', err.message);
          }
        }

        doc.fontSize(8).font('Helvetica');
        doc.text(requisition.assetTransfer.receivedByName || '_________________', 40, transferSigY + transferSigHeight + 5);
        doc.text('Received By (Print Name)', 40, transferSigY + transferSigHeight + 15);

        // Released By
        const releasedX = 40 + transferGap;
        doc.rect(releasedX, transferSigY, transferSigWidth, transferSigHeight).stroke();
        doc.text('(Signature)', releasedX + 10, transferSigY + 55);

        if (requisition.assetTransfer.releasedBySignature) {
          try {
            const signatureData = requisition.assetTransfer.releasedBySignature;
            if (signatureData.startsWith('data:image')) {
              const base64Data = signatureData.replace(/^data:image\/\w+;base64,/, '');
              const buffer = Buffer.from(base64Data, 'base64');
              doc.image(buffer, releasedX, transferSigY, { width: transferSigWidth, height: transferSigHeight });
            }
          } catch (err) {
            console.warn('Could not embed released signature:', err.message);
          }
        }

        doc.fontSize(8).font('Helvetica');
        doc.text(requisition.assetTransfer.releasedByName || '_________________', releasedX, transferSigY + transferSigHeight + 5);
        doc.text('Released By (Print Name)', releasedX, transferSigY + transferSigHeight + 15);

        // Date
        doc.fontSize(9).font('Helvetica');
        doc.text(`Date: ${requisition.assetTransfer.date || new Date().toLocaleDateString()}`, 40, transferSigY + transferSigHeight + 40);
      }

      doc.moveDown(2);

      // Footer
      doc.strokeColor('#730051').lineWidth(2);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.strokeColor('black').lineWidth(1);

      doc.fontSize(7).font('Helvetica').fillColor('#666666');
      doc.text('This document serves as official proof of requisition and asset transfer. All signatures are required for validity.', { align: 'center' });
      doc.text(`Generated: ${new Date().toLocaleString()} | KSUCU Missions & Community`, { align: 'center' });

      doc.end();

      stream.on('finish', async () => {
        // Update requisition with PDF info
        requisition.pdfUrl = `/api/requisitions/${requisition._id}/pdf/download?file=${fileName}`;
        requisition.pdfGeneratedAt = new Date();
        await requisition.save();

        // Log PDF generation for audit
        console.log(`PDF generated - Requisition: ${requisition._id}, User: ${currentUser}, File: ${fileName}, Time: ${new Date().toISOString()}`);

        res.json({
          message: 'PDF generated successfully',
          pdfUrl: requisition.pdfUrl,
          fileName: fileName,
          generatedAt: requisition.pdfGeneratedAt
        });
      });

      stream.on('error', (err) => {
        console.error('PDF generation error:', err);
        res.status(500).json({ error: 'Failed to generate PDF' });
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      res.status(500).json({ error: 'Failed to generate PDF' });
    }
  },

  // Get PDF info and list all PDF versions for a requisition
  getPDFInfo: async (req, res) => {
    try {
      const requisition = await Requisition.findById(req.params.id);

      if (!requisition) {
        return res.status(404).json({ error: 'Requisition not found' });
      }

      // Get current user from request (should be set by auth middleware)
      const currentUser = req.user?.name || req.user?.username || req.headers['x-user-name'];
      const isAdmin = req.user?.role === 'admin' || req.sessionStore?.adminAuth === 'Overseer';

      // Check authorization: only admin or the requisition creator can access
      if (!isAdmin && currentUser !== requisition.recipientName) {
        return res.status(403).json({
          error: 'Access denied. Only admins and the requisition creator can view PDF information.',
          message: 'You do not have permission to view this requisition\'s PDFs'
        });
      }

      const uploadsDir = path.join(__dirname, '../uploads/requisitions');
      const requisitionId = requisition._id.toString();

      let pdfVersions = [];

      // List all PDF files for this requisition
      if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir);
        pdfVersions = files
          .filter(file => file.includes(requisitionId))
          .map(file => {
            const filePath = path.join(uploadsDir, file);
            const stats = fs.statSync(filePath);
            return {
              fileName: file,
              downloadUrl: `/api/requisitions/${requisition._id}/pdf/download?file=${file}`,
              generatedAt: stats.mtime,
              size: stats.size
            };
          })
          .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
      }

      res.json({
        requisitionId: requisition._id,
        requisitionName: requisition.purpose,
        recipientName: requisition.recipientName,
        status: requisition.status,
        totalVersions: pdfVersions.length,
        pdfVersions: pdfVersions,
        latestPDF: pdfVersions.length > 0 ? pdfVersions[0] : null,
        message: pdfVersions.length === 0 ? 'No PDF generated yet. Generate one using POST /api/requisitions/:id/generate-pdf' : 'PDF versions retrieved successfully'
      });
    } catch (error) {
      console.error('Error getting PDF info:', error);
      res.status(500).json({ error: 'Failed to retrieve PDF information' });
    }
  },

  // Download PDF
  downloadPDF: async (req, res) => {
    try {
      const { file } = req.query;

      if (!file) {
        return res.status(400).json({ error: 'File parameter is required' });
      }

      // Extract requisition ID from filename (format: requisition-[ID]-[timestamp].pdf)
      const fileNameParts = file.split('-');
      if (fileNameParts.length < 2) {
        return res.status(400).json({ error: 'Invalid file name format' });
      }

      // Reconstruct the requisition ID (handle IDs with hyphens)
      const requisitionId = fileNameParts.slice(1, -1).join('-').split('.')[0];

      // Find the requisition to check authorization
      const requisition = await Requisition.findById(requisitionId);
      if (!requisition) {
        return res.status(404).json({ error: 'Requisition not found' });
      }

      // Get current user from request
      const currentUser = req.user?.name || req.user?.username || req.headers['x-user-name'];
      const isAdmin = req.user?.role === 'admin' || req.sessionStore?.adminAuth === 'Overseer';

      // Check authorization: only admin or the requisition creator can download
      if (!isAdmin && currentUser !== requisition.recipientName) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You do not have permission to download this requisition PDF'
        });
      }

      const filePath = path.join(__dirname, '../uploads/requisitions', file);

      // Security check - ensure file is within uploads directory
      const uploadsDir = path.resolve(path.join(__dirname, '../uploads/requisitions'));
      const resolvedPath = path.resolve(filePath);

      if (!resolvedPath.startsWith(uploadsDir)) {
        return res.status(403).json({ error: 'Access denied - invalid file path' });
      }

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'PDF file not found' });
      }

      // Log the download for audit purposes
      console.log(`PDF downloaded - Requisition: ${requisitionId}, User: ${currentUser}, File: ${file}, Time: ${new Date().toISOString()}`);

      res.download(filePath, file);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      res.status(500).json({ error: 'Failed to download PDF' });
    }
  },

  // User acknowledges receipt of approved requisition
  acknowledgeReceipt: async (req, res) => {
    try {
      const requisition = await Requisition.findByIdAndUpdate(
        req.params.id,
        {
          userAcknowledged: true,
          userAcknowledgedAt: new Date()
        },
        { new: true, runValidators: true }
      );

      if (!requisition) {
        return res.status(404).json({ error: 'Requisition not found' });
      }

      res.json({
        message: 'Receipt acknowledged successfully',
        requisition
      });
    } catch (error) {
      console.error('Error acknowledging receipt:', error);
      res.status(500).json({ error: 'Failed to acknowledge receipt' });
    }
  }
};

module.exports = requisitionController;