const jwt = require('jsonwebtoken');
const User = require('../models/user');

/**
 * Finance authentication middleware for the main site.
 * Checks sadmin_token first (System Admin = full finance admin),
 * then patron_token (Patron = finance patron access),
 * then falls back to 401.
 *
 * Sets req.user with { id, role, isSuperAdmin?, isPatron? } shape
 * compatible with finance controllers that use req.user.id and req.user.role.
 */
module.exports = (req, res, next) => {
  // 1. Check for System Admin (sadmin_token)
  const adminToken = req.cookies.sadmin_token;
  if (adminToken) {
    try {
      const decoded = jwt.verify(adminToken, process.env.JWT_ADMIN_SECRET);
      req.user = {
        id: decoded.userId,
        role: 'admin',
        isSuperAdmin: true,
      };
      return next();
    } catch (err) {
      // Invalid admin token — fall through to patron check
    }
  }

  // 2. Check for Patron (patron_token)
  const patronToken = req.cookies.patron_token;
  if (patronToken) {
    try {
      const decoded = jwt.verify(patronToken, process.env.JWT_ADMIN_SECRET);
      req.user = {
        id: decoded.userId,
        role: 'patron',
        isPatron: true,
      };
      return next();
    } catch (err) {
      // Invalid patron token — fall through to 401
    }
  }

  // 3. No valid admin/patron token
  return res.status(401).json({ message: 'Authentication failed: Finance access requires System Admin or Patron login.' });
};
