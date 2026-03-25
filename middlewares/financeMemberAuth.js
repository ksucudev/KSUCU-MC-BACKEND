const jwt = require('jsonwebtoken');

/**
 * Finance member auth middleware.
 * Checks the user_s cookie so regular members can view their contributions.
 * Sets req.user = { id } compatible with finance controllers.
 */
module.exports = (req, res, next) => {
  const token = req.cookies.user_s;

  if (!token) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_USER_SECRET);
    req.user = { id: decoded.userId };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};
