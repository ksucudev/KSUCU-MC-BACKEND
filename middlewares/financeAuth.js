const jwt = require('jsonwebtoken');

/**
 * Finance authentication middleware.
 * Accepts System Admin (sadmin_token), Patron (patron_token),
 * OR any standard user (user_s) with an authorized finance role.
 *
 * Finance-authorized roles: treasurer, auditor, chair_accounts, chairperson, admin
 */

const FINANCE_ROLES = ['treasurer', 'auditor', 'chair_accounts', 'chairperson', 'admin'];

module.exports = (req, res, next) => {
  // 1. Check for System Admin (sadmin_token)
  const adminToken = req.cookies.sadmin_token;
  if (adminToken) {
    try {
      const decoded = jwt.verify(adminToken, process.env.JWT_ADMIN_SECRET);
      req.user = {
        id: decoded.userId,
        role: decoded.role || 'admin',
        isSuperAdmin: !decoded.role || decoded.role === 'admin',
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
      // Invalid patron token — fall through to standard user check
    }
  }

  // 3. Check for standard user (user_s) with a finance-authorized role
  const userToken = req.cookies.user_s;
  if (userToken) {
    try {
      const decoded = jwt.verify(userToken, process.env.JWT_USER_SECRET);
      const role = (decoded.role || '').toLowerCase();
      if (FINANCE_ROLES.includes(role)) {
        req.user = {
          id: decoded.userId,
          role: role,
        };
        return next();
      }
      // User is authenticated but not authorized for finance
      return res.status(403).json({ message: 'Access denied: Your role does not have finance access.' });
    } catch (err) {
      // Invalid user token — fall through to 401
    }
  }

  // 4. Also check Authorization header (Bearer token) for the finance subdomain SPA
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      // Try user secret first (treasurer/auditor accounts)
      const decoded = jwt.verify(token, process.env.JWT_USER_SECRET);
      const role = (decoded.role || '').toLowerCase();
      if (FINANCE_ROLES.includes(role)) {
        req.user = {
          id: decoded.userId,
          role: role,
        };
        return next();
      }
      return res.status(403).json({ message: 'Access denied: Your role does not have finance access.' });
    } catch (err) {
      try {
        // Try admin secret (admin accounts)
        const decoded = jwt.verify(token, process.env.JWT_ADMIN_SECRET);
        req.user = {
          id: decoded.userId,
          role: decoded.role || 'admin',
          isSuperAdmin: true,
        };
        return next();
      } catch (err2) {
        // Both secrets failed — fall through to 401
      }
    }
  }

  // 5. No valid token found
  return res.status(401).json({ message: 'Authentication required: Please log in to access financial data.' });
};
