const { validationResult } = require('express-validator');
const { userService } = require('../../services/users');
const { responseService } = require('../../services/common');
const config = require('../../config/config');
const logger = require('../../config/logger');

// Import rate limiters from middleware
const {
  registerLimiter,
  loginLimiter,
  otpRequestLimiter,
  otpLoginLimiter,
  emailVerificationLimiter,
  phoneVerificationLimiter,
  twoFactorLimiter,
  recoveryRequestLimiter,
  resetPasswordLimiter
} = require('../../middleware/rateLimiters');

// User Registration
const register = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    const { email, password, firstName, lastName } = req.body;

    // Register user using service
    const result = await userService.registerUser({ email, password, firstName, lastName });

    logger.info('User registered successfully', {
      userId: result.user._id,
      email: result.user.email,
      method: 'email',
      timestamp: new Date().toISOString()
    });
    
    responseService.sendAuthResponse(res, result, 'User registered successfully', 201);
  } catch (error) {
    logger.error('User registration error', {
      error: error.message,
      stack: error.stack,
      email: req.body.email,
      timestamp: new Date().toISOString()
    });
    responseService.handleServiceError(res, error, 'Server error');
  }
};

// User Login
const login = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    const { email, password } = req.body;

    // Login user using service
    const result = await userService.loginUser({ email, password });

    logger.info('User login successful', {
      userId: result.user._id,
      email: result.user.email,
      method: 'email',
      timestamp: new Date().toISOString()
    });
    
    responseService.sendAuthResponse(res, result, 'Login successful');
  } catch (error) {
    logger.error('User login error', {
      error: error.message,
      stack: error.stack,
      email: req.body.email,
      timestamp: new Date().toISOString()
    });
    responseService.handleServiceError(res, error, 'Server error');
  }
};

// Get User Profile
const getProfile = async (req, res) => {
  try {
    // User ID comes from JWT token (set by authenticateToken middleware)
    const userId = req.user.userId;

    // Get user profile using service
    const userProfile = await userService.getUserProfile(userId);
    
    logger.info('User profile retrieved', {
      userId: userProfile._id,
      email: userProfile.email,
      timestamp: new Date().toISOString()
    });
    
    responseService.sendSuccess(res, { user: userProfile });
  } catch (error) {
    logger.error('Get user profile error', {
      error: error.message,
      stack: error.stack,
      userId: req.user.userId,
      timestamp: new Date().toISOString()
    });
    responseService.handleServiceError(res, error, 'Server error');
  }
};

// Update User Profile
const updateProfile = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    // User ID comes from JWT token (set by authenticateToken middleware)
    const userId = req.user.userId;

    // Extract fields from request body
    const { firstName, lastName, preferences, profile } = req.body;

    // Update profile using service
    const updatedProfile = await userService.updateUserProfile(userId, {
      firstName,
      lastName,
      preferences,
      profile
    });

    console.log(`Profile updated for user: ${updatedProfile.email}`);
    
    responseService.sendSuccess(res, { user: updatedProfile }, 'Profile updated successfully');
  } catch (error) {
    console.error('Update profile error:', error);
    responseService.handleServiceError(res, error, 'Server error');
  }
};

// Change Password
const changePassword = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    // User ID comes from JWT token (set by authenticateToken middleware)
    const userId = req.user.userId;

    // Extract fields from request body
    const { currentPassword, newPassword } = req.body;

    // Change password using service
    await userService.changePassword(userId, currentPassword, newPassword);

    console.log(`Password changed for user ID: ${userId}`);
    
    responseService.sendSuccess(res, null, 'Password changed successfully');
  } catch (error) {
    console.error('Change password error:', error);
    responseService.handleServiceError(res, error, 'Server error');
  }
};

// Delete Account
const deleteAccount = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    // User ID comes from JWT token (set by authenticateToken middleware)
    const userId = req.user.userId;

    // Extract password from request body
    const { password } = req.body;

    // Delete account using service
    await userService.deleteAccount(userId, password);

    console.log(`Account deleted for user ID: ${userId}`);
    
    // Return 204 No Content (successful deletion)
    res.status(204).send();
  } catch (error) {
    console.error('Delete account error:', error);
    responseService.handleServiceError(res, error, 'Server error');
  }
};

// Google Login
const googleLogin = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    const { tokenId } = req.body;

    // Google login using service
    const result = await userService.googleLogin(tokenId);

    console.log(`Google login successful for user: ${result.user.email}`);
    
    responseService.sendAuthResponse(res, result, 'Google login successful');
  } catch (error) {
    console.error('Google login error:', error);
    responseService.handleServiceError(res, error, 'Server error');
  }
};

// Request OTP
const requestOTP = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    const { email } = req.body;

    // Request OTP using service
    const otpCode = await userService.requestOTP(email);

    // In production, you would send email with OTP
    // For testing, we'll log it
    console.log(`OTP for ${email}: ${otpCode}`);

    responseService.sendSuccess(res, null, 'OTP sent successfully to your email');
  } catch (error) {
    console.error('Request OTP error:', error);
    responseService.handleServiceError(res, error, 'Server error');
  }
};

// OTP Login
const otpLogin = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    const { email, otp } = req.body;

    // OTP login using service
    const result = await userService.otpLogin(email, otp);

    console.log(`OTP login successful for user: ${result.user.email}`);
    
    responseService.sendAuthResponse(res, result, 'OTP login successful');
  } catch (error) {
    console.error('OTP login error:', error);
    responseService.handleServiceError(res, error, 'Server error');
  }
};

// Send Email Verification
const sendEmailVerification = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    // User ID comes from JWT token (set by authenticateToken middleware)
    const userId = req.user.userId;
    const { email } = req.body;

    // Send email verification using service
    const verificationToken = await userService.sendEmailVerification(userId, email);

    // In production, you would send email with verification link
    // For testing, we'll log it
    console.log(`Email verification token for ${email}: ${verificationToken}`);

    responseService.sendSuccess(res, null, 'Verification email sent successfully');
  } catch (error) {
    console.error('Send email verification error:', error);
    responseService.handleServiceError(res, error, 'Server error');
  }
};

// Verify Email
const verifyEmail = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    const { token } = req.body;

    // Verify email using service
    await userService.verifyEmail(token);

    console.log('Email verified successfully');

    responseService.sendSuccess(res, null, 'Email verified successfully');
  } catch (error) {
    console.error('Verify email error:', error);
    responseService.handleServiceError(res, error, 'Server error');
  }
};

// Send Phone Verification
const sendPhoneVerification = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    // User ID comes from JWT token (set by authenticateToken middleware)
    const userId = req.user.userId;
    const { phoneNumber } = req.body;

    // Send phone verification using service
    const verificationCode = await userService.sendPhoneVerification(userId, phoneNumber);

    // In production, you would send SMS with verification code
    // For testing, we'll log it
    console.log(`Phone verification code for ${phoneNumber}: ${verificationCode}`);

    responseService.sendSuccess(res, null, 'Verification code sent successfully to your phone');
  } catch (error) {
    console.error('Send phone verification error:', error);
    responseService.handleServiceError(res, error, 'Server error');
  }
};

// Verify Phone
const verifyPhone = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    // User ID comes from JWT token (set by authenticateToken middleware)
    const userId = req.user.userId;
    const { phoneNumber, code } = req.body;

    // Verify phone using service
    await userService.verifyPhone(userId, phoneNumber, code);

    console.log(`Phone verified for user: ${phoneNumber}`);

    responseService.sendSuccess(res, null, 'Phone number verified successfully');
  } catch (error) {
    console.error('Verify phone error:', error);
    responseService.handleServiceError(res, error, 'Server error');
  }
};

// Enable Two-Factor Authentication
const enable2FA = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    // User ID comes from JWT token (set by authenticateToken middleware)
    const userId = req.user.userId;
    const { method } = req.body;

    // Enable 2FA using service
    const result = await userService.enable2FA(userId, method);

    console.log(`2FA enabled for user ID: ${userId} with method: ${method}`);

    const response = {
      method: result.method
    };

    // If authenticator method, include QR code data
    if (result.qrCode && result.secret) {
      response.qrCode = result.qrCode;
      response.secret = result.secret;
      console.log(`2FA QR Code generated`);
    }

    responseService.sendSuccess(res, response, 'Two-factor authentication enabled successfully');
  } catch (error) {
    console.error('Enable 2FA error:', error);
    responseService.handleServiceError(res, error, 'Server error');
  }
};

// Disable Two-Factor Authentication
const disable2FA = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    // User ID comes from JWT token (set by authenticateToken middleware)
    const userId = req.user.userId;
    const { password } = req.body;

    // Disable 2FA using service
    await userService.disable2FA(userId, password);

    console.log(`2FA disabled for user ID: ${userId}`);

    responseService.sendSuccess(res, null, 'Two-factor authentication disabled successfully');
  } catch (error) {
    console.error('Disable 2FA error:', error);
    responseService.handleServiceError(res, error, 'Server error');
  }
};

// Request Account Recovery
const requestRecovery = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    const { email } = req.body;

    // Request recovery using service
    const recoveryToken = await userService.requestRecovery(email, {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    // In production, you would send email with recovery link
    // For testing, we'll log it
    console.log(`Recovery token for ${email}: ${recoveryToken}`);
    console.log(`Recovery link: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${recoveryToken}`);

    responseService.sendSuccess(res, null, 'Recovery instructions sent successfully to your email');
  } catch (error) {
    console.error('Request recovery error:', error);
    responseService.handleServiceError(res, error, 'Server error');
  }
};

// Reset Password
const resetPassword = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    const { token, newPassword } = req.body;

    // Reset password using service
    await userService.resetPassword(token, newPassword);

    console.log('Password reset successful');

    responseService.sendSuccess(res, null, 'Password reset successful');
  } catch (error) {
    console.error('Reset password error:', error);
    responseService.handleServiceError(res, error, 'Server error');
  }
};



module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
  googleLogin,
  requestOTP,
  otpLogin,
  sendEmailVerification,
  verifyEmail,
  sendPhoneVerification,
  verifyPhone,
  enable2FA,
  disable2FA,
  requestRecovery,
  resetPassword,
  registerLimiter,
  loginLimiter,
  otpRequestLimiter,
  otpLoginLimiter,
  emailVerificationLimiter,
  phoneVerificationLimiter,
  twoFactorLimiter,
  recoveryRequestLimiter,
  resetPasswordLimiter
};