/**
 * Finance role-based authorization middleware.
 * System Admin bypasses all role checks.
 * Patron passes if 'patron' is in the allowed roles.
 * Otherwise checks req.user.role against allowed roles.
 */
module.exports = function financeAuthorize(...allowedRoles) {
  return (req, res, next) => {
    if (req.user.isSuperAdmin) return next();
    if (req.user.isPatron && allowedRoles.includes('patron')) return next();
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
};
