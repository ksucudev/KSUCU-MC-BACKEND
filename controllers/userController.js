const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const Soul = require('../models/savedSouls')
const bs = require('../models/biblestudy')
const FeedBack = require('../models/feedbackSchema')
const news = require('../models/adminNews')
const { sendMail, generateToken } = require('../helperModules/sendmail');
const backendURL = 'https://ksucu-mc.co.ke'


exports.login = async (req, res) => {
  try {
    let { email, password } = req.body;

    // Enhanced logging for debugging device-specific issues
    console.log('🔐 LOGIN ATTEMPT:', {
      email: email?.toLowerCase(),
      passwordProvided: !!password,
      userAgent: req.headers['user-agent'],
      origin: req.headers.origin,
      ip: req.ip || req.connection.remoteAddress,
      referer: req.headers.referer,
      timestamp: new Date().toISOString()
    });

    email = email.toLowerCase();

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      console.log('invalid username');

      return res.status(401).json({ message: 'Invalid username or password' });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log('invalid pswd');
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    const token = jwt.sign({ userId: user._id }, process.env.JWT_USER_SECRET, { expiresIn: '3d' });

    // Enhanced cookie settings for better cross-device compatibility
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days in milliseconds
      sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
      // Add domain if in production for better cookie sharing
      ...(process.env.NODE_ENV === 'production' && { domain: '.ksucu-mc.co.ke' })
    };

    console.log('🍪 Setting cookie with options:', cookieOptions);
    console.log('🍪 User agent:', req.headers['user-agent']);
    console.log('🍪 Origin:', req.headers.origin);

    // Set httpOnly cookie for API requests (secure)
    res.cookie('user_s', token, cookieOptions);

    // Set accessible cookie for socket authentication
    const socketCookieOptions = {
      ...cookieOptions,
      httpOnly: false // Make this accessible to JavaScript for socket auth
    };
    res.cookie('socket_token', token, socketCookieOptions);

    // Sending a success response
    res.status(200).json({
      message: 'Login successful',
      user: {
        _id: user._id,
        username: user.username,
        profilePhoto: user.profilePhoto,
        role: user.role || 'student'
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);

    // Ensure we send a string message, not an error object
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({
      message: errorMessage,
      error: errorMessage
    });
  }

}

exports.saveSoul = async (req, res) => {
  const { name, phone, region, village } = req.body;

  const existingUser = await Soul.findOne({ phone });
  if (existingUser) {
    return res.status(400).json({ message: 'Email or phone already exists' });
  }

  try {
    const newPost = new Soul({ name, phone, region, village });
    await newPost.save();
    res.json(newPost);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error saving soul");
  }

}

exports.countSaved = async (req, res) => {
  try {
    const soulCount = await Soul.countDocuments();
    res.json({ count: soulCount });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user count' });
  }
}

exports.bibleStudy = async (req, res) => {
  const { name, residence, yos, phone, gender, isPastor } = req.body;

  const existingUser = await bs.findOne({ phone });
  if (existingUser) {
    return res.status(400).json({ message: 'Email or phone already exists' });
  }

  try {
    const newBs = new bs({ name, residence, yos, phone, gender, isPastor: isPastor || false });
    await newBs.save();
    console.log(`Bible Study user registered: ${name} (${phone}) - Pastor: ${isPastor || false}`);
    res.status(200).send('Successfully saved');
  } catch (err) {
    console.log(err);
    res.status(500).send("Error saving soul");
  }
}


exports.forgetPassword = async (req, res) => {
  try {
    let { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    email = email.toLowerCase();

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }


    const token = generateToken({ email });

    const resetLink = `${backendURL}/reset?token=${token}`;

    const subject = 'Password Reset';

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #000; background-color: #fff; padding: 20px; border: 1px solid #730051; border-radius: 8px; max-width: 600px; margin: auto;">
        <h1 style="color: #00c6ff; text-align: center;">Kisii University Christian Union</h1>
        <h2 style="color: #730051; text-align: center; margin-top: -10px;">Main Campus</h2>
        <p style="font-size: 16px;">We received a request to reset your password. If this was you, click the button below to proceed. The link will expire in <span style="color: #730051; font-weight: bold;">1 hour</span>.</p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${resetLink}" 
             style="display: inline-block; padding: 12px 24px; font-size: 16px; color: #fff; background-color: #730051; text-decoration: none; border-radius: 5px;">
             Reset Password
          </a>
        </div>
        <p style="font-size: 14px;">If you didn’t request a password reset, you can safely ignore this email.</p>
        <p style="color: #730051; font-size: 14px; text-align: center; margin-top: 20px;">Thank you,<br><strong>The Kisii University Christian Union Dev Team</strong></p>
      </div>
    `;

    await sendMail(email, subject, html);


    res.status(200).json({ message: 'Password reset email sent successfully!' });

  } catch (error) {
    res.status(500).json({ message: error });
  }

};

exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.query;
    const { password } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Reset token is required' });
    }

    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_USER_SECRET);

    const userEmail = decoded.email;

    if (!userEmail) {
      return res.status(400).json({ message: 'Email not found in token payload' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await User.updateOne({ email: userEmail }, { password: hashedPassword });

    res.status(200).json({ message: 'Password reset successfully!' });

  } catch (error) {
    console.error('Password reset error:', error);
    res.status(400).json({ message: 'Invalid or expired reset token' });
  }

};

exports.getUserData = async (req, res) => {
  try {
    const userId = req.userId; // Extract user ID from authentication middleware

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate fresh socket token for authenticated users
    const token = jwt.sign({ userId: user._id }, process.env.JWT_USER_SECRET, { expiresIn: '3d' });

    // Set socket token cookie (accessible to JavaScript)
    const socketCookieOptions = {
      httpOnly: false, // Make accessible for socket auth
      secure: process.env.NODE_ENV === 'production',
      maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days
      sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
      ...(process.env.NODE_ENV === 'production' && { domain: '.ksucu-mc.co.ke' })
    };

    res.cookie('socket_token', token, socketCookieOptions);

    const userData = {
      _id: user._id,
      username: user.username,
      email: user.email,
      yos: user.yos,
      ministry: user.ministry,
      reg: user.reg,
      et: user.et,
      course: user.course,
      phone: user.phone,
      profilePhoto: user.profilePhoto,
      role: user.role || 'student',
      graduationYear: user.graduationYear || null
    };
    res.status(200).json(userData);
  } catch (error) {
    res.status(500).json({ message: error });
  }
};

exports.verifyPassword = async (req, res) => {
  try {
    const userId = req.userId;
    const { currentPassword } = req.body;

    if (!currentPassword || currentPassword.trim() === '') {
      return res.status(400).json({ message: 'Current password is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    res.status(200).json({ message: 'Password verified' });
  } catch (error) {
    console.log('Error verifying password:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateUserData = async (req, res) => {
  try {
    const userId = req.userId; // Extract user ID from authentication middleware

    // Extract updated user details from request body
    const { username, email, yos, ministry, reg, et, course, phone, password, graduationYear } = req.body;

    // Check for duplicate phone, email, or reg (excluding current user)
    const duplicateChecks = [];
    if (phone) duplicateChecks.push({ phone });
    if (email) duplicateChecks.push({ email });
    if (reg) duplicateChecks.push({ reg });

    if (duplicateChecks.length > 0) {
      const duplicate = await User.findOne({
        _id: { $ne: userId },
        $or: duplicateChecks
      });

      if (duplicate) {
        if (duplicate.phone === phone) {
          return res.status(400).json({ message: 'Phone number already in use by another account' });
        }
        if (duplicate.email === email) {
          return res.status(400).json({ message: 'Email already in use by another account' });
        }
        if (reg && duplicate.reg === reg) {
          return res.status(400).json({ message: 'Registration number already in use by another account' });
        }
      }
    }

    // Prepare update data
    const updateData = { username, email, yos, ministry, reg, et, course, phone };

    // Include graduationYear if provided (for associates/alumni)
    if (graduationYear !== undefined) {
      updateData.graduationYear = graduationYear;
    }

    // If password is provided, verify old password first, then hash and update
    if (password && password.trim() !== '') {
      const { currentPassword } = req.body;
      if (!currentPassword || currentPassword.trim() === '') {
        return res.status(400).json({ message: 'Current password is required to change password' });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }

      console.log('Updating password for user:', userId);
      const hashedPassword = await bcrypt.hash(password, 10);
      updateData.password = hashedPassword;
    }

    // Find the user by ID and update with the new details
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true } // Return the updated document
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const message = password && password.trim() !== ''
      ? 'User details and password updated successfully'
      : 'User details updated successfully';

    res.status(200).json({ message });
  } catch (error) {
    console.log('Error updating user:', error);
    res.status(500).json({ message: error });
  }
};

exports.logout = async (req, res) => {
  try {
    console.log('🚪 LOGOUT REQUEST:', {
      cookies: req.cookies,
      headers: req.headers,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString()
    });

    // Clear all possible cookie variations with different options
    const cookiesToClear = ['token', 'user_s', 'loginToken', 'sessionToken', 'authToken'];
    const cookieOptions = [
      // Standard options
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
        path: '/'
      },
      // Without httpOnly for client-side clearing
      {
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
        path: '/'
      },
      // With domain for production
      ...(process.env.NODE_ENV === 'production' ? [{
        httpOnly: true,
        secure: true,
        sameSite: 'None',
        path: '/',
        domain: '.ksucu-mc.co.ke'
      }, {
        secure: true,
        sameSite: 'None',
        path: '/',
        domain: '.ksucu-mc.co.ke'
      }] : [])
    ];

    // Clear each cookie with all possible option combinations
    cookiesToClear.forEach(cookieName => {
      cookieOptions.forEach(options => {
        res.clearCookie(cookieName, options);
      });
    });

    console.log('🍪 Cleared all cookies with multiple option combinations');
    return res.status(200).json({
      message: 'Logout successful',
      clearedCookies: cookiesToClear,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error during logout:', error);
    return res.status(500).json({ message: 'An error occurred while processing your request' });
  }
};

exports.feedback = async (req, res) => {
  try {

    const userId = req.userId;

    const user = await User.findById(userId);

    let { anonymous, name, message } = req.body;

    if (!anonymous) {
      name = user.username;
    }

    const feedback = new FeedBack({ anonymous, name, message });
    await feedback.save();

    res.status(201).json({ message: 'Feedback submitted successfully' });
  } catch (error) {
    console.log(error);

    res.status(500).json({ error: 'Server error' });
  }

};

// Check if user exists by email or phone
exports.checkUserExists = async (req, res) => {
  try {
    let { email, phone, regNo } = req.body;

    if (!email && !phone && !regNo) {
      return res.status(400).json({ message: 'Email, phone or registration number is required' });
    }

    // Normalize inputs
    if (email) email = email.toLowerCase().trim();
    if (phone) phone = phone.trim();
    if (regNo) regNo = regNo.trim().toUpperCase();

    // Check if user exists by email, phone, or regNo
    const query = [];
    if (email) query.push({ email });
    if (phone) query.push({ phone });
    if (regNo) query.push({ reg: regNo }); // Field in model is 'reg'

    const user = await User.findOne({ $or: query });

    if (user) {
      return res.status(200).json({
        exists: true,
        message: 'User found in database',
        user: {
          username: user.username,
          regNo: user.reg,
          course: user.course,
          year: user.yos,
          phone: user.phone,
          ministry: user.ministry
        }
      });
    }

    return res.status(200).json({
      exists: false,
      message: 'User not found in database'
    });

  } catch (error) {
    console.error('Error checking user existence:', error);
    res.status(500).json({ message: 'Error checking user existence' });
  }
};

// Self-registration for users (without admin)
exports.signup = async (req, res) => {
  try {
    let { username, email, phone, course, reg, yos, ministry, et, role, graduationYear } = req.body;

    // Determine if this is an associate registration
    const isAssociate = role === 'associate';

    // Validate required fields (associates have fewer required fields)
    if (isAssociate) {
      if (!username || !email || !phone || !course) {
        return res.status(400).json({ message: 'Name, email, phone and course are required' });
      }
    } else {
      if (!username || !email || !phone || !course || !reg || !yos || !ministry || !et) {
        return res.status(400).json({ message: 'All fields are required' });
      }
    }

    // Normalize and clean data (remove extra spaces)
    username = username.trim().replace(/\s+/g, ' ');
    email = email.toLowerCase().trim();
    phone = phone.trim().replace(/\s+/g, '');
    course = course.trim().replace(/\s+/g, ' ');

    if (!isAssociate) {
      reg = reg.trim().replace(/\s+/g, '');
      yos = yos.toString().trim();
      ministry = ministry.trim();
      et = et.trim().toLowerCase();
    }

    // Validate phone format (10 digits starting with 0)
    const phoneRegex = /^0\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ message: 'Phone number must be 10 digits starting with 0' });
    }

    // Validate year of study (1-6) - only for students
    if (!isAssociate) {
      const yosNum = parseInt(yos);
      if (isNaN(yosNum) || yosNum < 1 || yosNum > 6) {
        return res.status(400).json({ message: 'Year of study must be between 1 and 6' });
      }
    }

    // Check if user already exists
    const orQuery = [{ email }, { phone }];
    if (reg) orQuery.push({ reg });
    const existingUser = await User.findOne({ $or: orQuery });
    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({ message: 'Email already registered' });
      }
      if (existingUser.phone === phone) {
        return res.status(400).json({ message: 'Phone number already registered' });
      }
      if (reg && existingUser.reg === reg) {
        return res.status(400).json({ message: 'Registration number already registered' });
      }
    }

    // Use phone number as default password (same as admission process)
    const hashedPassword = await bcrypt.hash(phone, 10);

    // Create new user
    const newUser = new User({
      username,
      email,
      phone,
      course,
      reg: isAssociate ? (reg || null) : reg,
      yos: isAssociate ? null : yos,
      ministry: isAssociate ? (ministry || 'alumni') : ministry,
      et: isAssociate ? (et || 'none') : et,
      role: isAssociate ? 'associate' : 'student',
      graduationYear: isAssociate ? (parseInt(graduationYear) || null) : null,
      password: hashedPassword
    });

    await newUser.save();

    console.log(`New ${isAssociate ? 'associate' : 'student'} self-registered:`, {
      username,
      email,
      phone,
      reg: reg || 'N/A'
    });

    res.status(201).json({
      message: 'Registration successful! You can now login.',
      loginGuide: {
        email: email,
        password: 'Your phone number (' + phone + ')',
        instructions: 'Use your email as username and your phone number as password to login.'
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Error during registration. Please try again.' });
  }
};

// Search users for attendance quick check-in
exports.searchUsers = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.length < 3) {
      return res.status(400).json({ message: 'Search query must be at least 3 characters' });
    }

    // Search by username or registration number (case insensitive)
    const users = await User.find({
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { reg: { $regex: query, $options: 'i' } }
      ]
    })
      .select('username reg course yos phone') // Only return necessary fields
      .limit(10); // Limit results for speed and UX

    res.status(200).json(users);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ message: 'Error searching users' });
  }
};

// Advance all students by one academic year (super admin only)
exports.advanceYears = async (req, res) => {
  try {
    const students = await User.find({ role: { $ne: 'associate' } });

    let advanced = 0;
    let promoted = 0;
    let skipped = 0;

    for (const student of students) {
      const currentYos = parseInt(student.yos);
      if (isNaN(currentYos)) {
        skipped++;
        continue;
      }

      // Check if medical student (course contains 'medicine' or 'medical')
      const isMedical = student.course &&
        (student.course.toLowerCase().includes('medicine') ||
         student.course.toLowerCase().includes('medical'));

      const maxYear = isMedical ? 6 : 4;

      if (currentYos >= maxYear) {
        // Promote to associate
        student.role = 'associate';
        student.graduationYear = new Date().getFullYear();
        student.yos = null;
        promoted++;
      } else {
        // Advance year
        student.yos = (currentYos + 1).toString();
        advanced++;
      }

      await student.save();
    }

    console.log(`Year advancement complete: ${advanced} advanced, ${promoted} promoted, ${skipped} skipped`);

    res.status(200).json({
      message: 'Year advancement complete',
      advanced,
      promoted,
      skipped,
      total: students.length
    });
  } catch (error) {
    console.error('Year advancement error:', error);
    res.status(500).json({ message: 'Error during year advancement' });
  }
};
