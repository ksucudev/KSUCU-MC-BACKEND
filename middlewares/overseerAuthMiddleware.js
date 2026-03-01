const jwt = require('jsonwebtoken');

const overseerAuth = (req, res, next) => {
  const token = req.cookies.overseer_token;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Overseer authentication required: No token provided.'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_OVERSEER_SECRET);

    if (decoded.role !== 'overseer') {
      return res.status(403).json({
        success: false,
        message: 'Authentication failed: Invalid role.'
      });
    }

    req.overseerAuth = true;
    next();
  } catch (err) {
    return res.status(403).json({
      success: false,
      message: `Authentication failed: ${err.message}`
    });
  }
};

module.exports = { overseerAuth };
