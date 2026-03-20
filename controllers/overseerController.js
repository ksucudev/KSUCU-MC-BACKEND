const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Login with password
exports.login = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    const storedHash = process.env.OVERSEER_PASSWORD_HASH;
    if (!storedHash) {
      console.error('OVERSEER_PASSWORD_HASH not configured in .env');
      return res.status(500).json({ message: 'Server configuration error' });
    }

    const isValid = await bcrypt.compare(password, storedHash);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    const token = jwt.sign(
      { role: 'overseer' },
      process.env.JWT_OVERSEER_SECRET,
      { expiresIn: '4h' }
    );

    // Clear user session cookies to avoid conflicts
    res.clearCookie('user_s');
    res.clearCookie('socket_token');

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('overseer_token', token, {
      httpOnly: true,
      secure: isProduction,
      maxAge: 4 * 60 * 60 * 1000,
      sameSite: isProduction ? 'None' : 'Lax',
    });

    res.status(200).json({ message: 'Login successful' });
  } catch (error) {
    console.error('Overseer login error:', error);
    res.status(500).json({ message: 'Error logging in' });
  }
};

// Verify session
exports.verify = (req, res) => {
  res.status(200).json({ valid: true, message: 'Session is valid' });
};

// Logout
exports.logout = (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('overseer_token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'None' : 'Lax'
  });
  res.status(200).json({ message: 'Logout successful' });
};
