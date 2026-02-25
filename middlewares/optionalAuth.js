const jwt = require('jsonwebtoken');
const secretKey = process.env.JWT_USER_SECRET;

module.exports = (req, res, next) => {
    const token = req.cookies.user_s;

    if (token) {
        try {
            const decoded = jwt.verify(token, secretKey);
            req.userId = decoded.userId;
        } catch (err) {
            console.warn('Optional auth failed:', err.message);
        }
    }
    next();
};
