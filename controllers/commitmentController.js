const Commitment = require("../models/commitment");
const User = require("../models/user");
const { getRoleForMinistry } = require('../utils/ministryRoleMapping');

exports.submitCommitment = async (req, res) => {
  try {

    const userId = req.userId;
    console.log('--- Submit Commitment Debug ---');
    console.log('User ID from middleware:', userId);
    console.log('Request Body:', req.body);
    const { fullName, phoneNumber, regNo, registrationNumber, yearOfStudy, reasonForJoining, date, signature, croppedImage, ministry } = req.body;

    const finalRegNo = regNo || registrationNumber;

    // Find user details from User model
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // STRICT VALIDATION: Registration Number must match the logged-in user
    const userReg = user.regNo || user.reg;
    if (finalRegNo !== userReg) {
      return res.status(400).json({ message: "Invalid registration number. Please use your registered account." });
    }

    // STRICT VALIDATION: Phone Number must be numeric and at least 10 digits
    const isNumeric = /^\d+$/.test(phoneNumber);
    if (!isNumeric || phoneNumber.length < 10) {
      return res.status(400).json({ message: "Phone number must be at least 10 digits and contain only numbers." });
    }

    // Users are allowed to submit multiple times for different ministries.
    // Each submission is saved as a NEW record.
    if (!userId || !fullName || !phoneNumber || !finalRegNo || !yearOfStudy || !reasonForJoining || !date || !signature) {
      return res.status(400).json({ message: "All required fields must be filled." });
    }

    // Determine assigned_role using centralized mapping utility
    const finalMinistry = ministry || user.ministry || 'Unknown';
    const assigned_role = getRoleForMinistry(finalMinistry);

    const newCommitment = new Commitment({
      userId,
      fullName,
      phoneNumber,
      regNo: finalRegNo,
      yearOfStudy,
      ministry: finalMinistry,
      reasonForJoining,
      date,
      signature,
      croppedImage: croppedImage || null,
      dateApproved: date,
      status: 'pending',
      assigned_role: 'Worship Coordinator', // Force role as requested
      form_type: 'commitment',
      submittedAt: new Date() // Ensure timestamp is present
    });

    await newCommitment.save();
    res.status(200).json({ message: "Commitment form submitted successfully. Waiting for admin approval." });

  } catch (error) {
    console.error("Error saving commitment:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};


// Fetch user details for form auto-population
exports.getUserDetails = async (req, res) => {
  try {
    // Extract user details from middleware
    const userId = req.userId;
    const { ministry } = req.query; // Get ministry from query params
    const user = await User.findById(userId);

    if (!user) {
      return res.status(401).json({ message: "Unauthorized." });
    }

    // Check for commitment SPECIFIC to the requested ministry
    const commitment = ministry
      ? await Commitment.findOne({ userId, ministry })
      : await Commitment.findOne({ userId }); // Fallback if no ministry provided

    // Exhaustive check for registration number fields (reg, regNo, registrationNumber, etc.)
    const userReg = user.reg || user.regNo || user.registrationNumber || user.registrationNo || user.reg_no || "";
    const userYos = user.yos || user.yearOfStudy || user.year || "";

    const responseData = {
      username: user.username,
      phone: user.phone,
      regNo: userReg,
      yearOfStudy: userYos,
      ministry: user.ministry,
      hasSubmitted: !!commitment
    };

    if (commitment) {
      Object.assign(responseData, {
        selectedMinistry: commitment.ministry,
        reasonForJoining: commitment.reasonForJoining,
        date: commitment.date,
        signature: commitment.signature,
        croppedImage: commitment.croppedImage,
        status: commitment.status
      });
    }

    res.status(200).json(responseData);

  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Get commitment forms for a specific ministry (Admin only)
exports.getMinistryCommitments = async (req, res) => {
  try {
    const { ministry } = req.params;

    const commitments = await Commitment.find({ ministry })
      .populate('userId', 'username email')
      .populate('reviewedBy', 'username')
      .sort({ submittedAt: -1 });

    res.status(200).json({ commitments });

  } catch (error) {
    console.error("Error fetching ministry commitments:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Approve commitment form (Admin only)
exports.approveCommitment = async (req, res) => {
  try {
    const { commitmentId } = req.params;
    const adminId = req.userId;

    const commitment = await Commitment.findByIdAndUpdate(
      commitmentId,
      {
        status: 'approved',
        reviewedBy: adminId,
        reviewedAt: new Date()
      },
      { new: true }
    );

    if (!commitment) {
      return res.status(404).json({ message: "Commitment form not found." });
    }

    res.status(200).json({
      message: "Commitment form approved successfully.",
      commitment
    });

  } catch (error) {
    console.error("Error approving commitment:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Revoke commitment form (Admin only)
exports.revokeCommitment = async (req, res) => {
  try {
    const { commitmentId } = req.params;
    const adminId = req.userId;

    const commitment = await Commitment.findByIdAndUpdate(
      commitmentId,
      {
        status: 'revoked',
        reviewedBy: adminId,
        reviewedAt: new Date()
      },
      { new: true }
    );

    if (!commitment) {
      return res.status(404).json({ message: "Commitment form not found." });
    }

    res.status(200).json({
      message: "Commitment form revoked.",
      commitment
    });

  } catch (error) {
    console.error("Error revoking commitment:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Get commitments by assigned role
exports.getCommitmentsByRole = async (req, res) => {
  try {
    const { role } = req.params;
    const decodedRole = decodeURIComponent(role);

    // For debugging
    console.log(`Fetching commitments for role: ${decodedRole}`);

    const commitments = await Commitment.find({ assigned_role: decodedRole })
      .populate('userId', 'username email')
      .sort({ submittedAt: -1 });

    res.status(200).json({ commitments });
  } catch (error) {
    console.error("Error fetching commitments by role:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Legacy endpoint (can be deprecated or redirected)
exports.getWorshipCoordinatorCommitments = async (req, res) => {
  // Redirect to use getCommitmentsByRole logic or just keep as is for now
  try {
    const commitments = await Commitment.find({ assigned_role: 'Worship Coordinator' })
      .sort({ submittedAt: -1 });

    res.status(200).json({ commitments });
  } catch (error) {
    console.error("Error fetching worship coordinator commitments:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
