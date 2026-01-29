require('dotenv').config();
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken')

//  Nodemailer transporter with Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});


const sendMail = async (to, subject, html) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

const generateToken = ({ username, password, email, yos, et, phone, ministry,course, reg }) => {
  const payload = { username, password, email, yos, et, phone, ministry,course, reg };
  const secret = process.env.JWT_USER_SECRET;
  const options = { expiresIn: '1h' };
  return jwt.sign(payload, secret, options);
};

// Send requisition approval notification email
const sendRequisitionApprovalEmail = async (requisition) => {
  try {
    const recipientEmail = requisition.recipientName ? `${requisition.recipientName.toLowerCase().replace(/\s+/g, '.')}@student.ku.ac.ke` : requisition.recipientPhone;
    
    const itemsList = requisition.items
      .map(item => `<li><strong>${item.itemName}</strong> - Qty: ${item.quantity}${item.description ? ` (${item.description})` : ''}</li>`)
      .join('');

    const approvedByText = requisition.approvedBy ? `by ${requisition.approvedBy}` : '';
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
            .header { background: linear-gradient(135deg, #730051 0%, #ab0051 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { padding: 20px; }
            .section { margin: 20px 0; padding: 15px; background: #f9f9f9; border-left: 4px solid #730051; }
            .section h3 { margin-top: 0; color: #730051; }
            ul { margin: 10px 0; padding-left: 20px; }
            li { margin: 8px 0; }
            .button { display: inline-block; margin-top: 20px; padding: 12px 30px; background: #730051; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; }
            .footer { border-top: 1px solid #ddd; margin-top: 20px; padding-top: 20px; font-size: 12px; color: #666; text-align: center; }
            .status-badge { display: inline-block; padding: 5px 15px; background: #28a745; color: white; border-radius: 20px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Requisition Approved ✓</h1>
            </div>
            
            <div class="content">
              <p>Dear <strong>${requisition.recipientName}</strong>,</p>
              
              <p>Good news! Your requisition has been <span class="status-badge">APPROVED</span> and is ready for processing.</p>
              
              <div class="section">
                <h3>Requisition Details</h3>
                <p><strong>Requisition ID:</strong> ${requisition._id}</p>
                <p><strong>Purpose:</strong> ${requisition.purpose}</p>
                <p><strong>Submitted:</strong> ${new Date(requisition.submittedAt).toLocaleString()}</p>
                <p><strong>Approved ${approvedByText}:</strong> ${new Date(requisition.approvedAt).toLocaleString()}</p>
              </div>
              
              <div class="section">
                <h3>Items Requested</h3>
                <ul>
                  ${itemsList}
                </ul>
              </div>
              
              <div class="section">
                <h3>Timeline</h3>
                <p><strong>Expected Time to Receive:</strong> ${new Date(requisition.timeReceived).toLocaleString()}</p>
                <p><strong>Expected Return Time:</strong> ${new Date(requisition.timeToReturn).toLocaleString()}</p>
              </div>
              
              ${requisition.comments ? `
              <div class="section">
                <h3>Admin Comments</h3>
                <p>${requisition.comments}</p>
              </div>
              ` : ''}
              
              <p>You can now generate and download your copy of the approved requisition as proof of approval. Please keep this for your records.</p>
              
              <p style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'https://ksucu-mc.co.ke'}/requisitions" class="button">View Your Requisitions</a>
              </p>
              
              <p>If you have any questions, please contact the admin at the provided contact number or email.</p>
            </div>
            
            <div class="footer">
              <p>KSUCU Missions & Community - Requisition System</p>
              <p>© 2026 All rights reserved</p>
            </div>
          </div>
        </body>
      </html>
    `;

    await sendMail(recipientEmail, `Requisition Approved - ${requisition.purpose}`, html);
    console.log(`Approval email sent to ${recipientEmail}`);
  } catch (error) {
    console.error('Error sending requisition approval email:', error);
    throw error;
  }
};

module.exports = {sendMail, generateToken, sendRequisitionApprovalEmail};

