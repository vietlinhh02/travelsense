const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../../models/users/user.model');
const AccountRecovery = require('../../models/auth/accountRecovery.model');
const config = require('../../config/config');

class UserService {
  /**
   * Generate JWT tokens for user
   * @param {Object} user - User object
   * @returns {Object} Access and refresh tokens
   */
  generateTokens(user) {
    const accessToken = jwt.sign(
      { userId: user._id, email: user.email },
      config.jwt.accessTokenSecret,
      { expiresIn: config.jwt.accessToken.expiresIn }
    );

    const refreshToken = jwt.sign(
      { userId: user._id, tokenId: crypto.randomBytes(16).toString('hex') },
      config.jwt.refreshTokenSecret,
      { expiresIn: config.jwt.refreshToken.expiresIn }
    );

    return { accessToken, refreshToken };
  }

  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>} Created user and tokens
   */
  async registerUser({ email, password, firstName, lastName }) {
    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      throw new Error('EMAIL_ALREADY_REGISTERED');
    }

    // Create user (password will be auto-hashed by pre-save hook)
    const user = new User({
      email: email.toLowerCase().trim(),
      password: password,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      emailVerified: false,
      phoneVerified: false,
      twoFactorEnabled: false,
      preferences: {
        interests: [],
        constraints: []
      },
      profile: {
        languages: [],
        specialRequirements: []
      },
      lastLogin: new Date()
    });

    await user.save();

    // Generate tokens
    const { accessToken, refreshToken } = this.generateTokens(user);

    return {
      user: user.toPublicJSON(),
      accessToken,
      refreshToken
    };
  }

  /**
   * Authenticate user login
   * @param {Object} credentials - User login credentials
   * @returns {Promise<Object>} User and tokens
   */
  async loginUser({ email, password }) {
    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      throw new Error('INVALID_CREDENTIALS');
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new Error('INVALID_CREDENTIALS');
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const { accessToken, refreshToken } = this.generateTokens(user);

    return {
      user: user.toPublicJSON(),
      accessToken,
      refreshToken
    };
  }

  /**
   * Get user profile by ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User profile
   */
  async getUserProfile(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    return user.toPublicJSON();
  }

  /**
   * Update user profile
   * @param {string} userId - User ID
   * @param {Object} updateData - Profile update data
   * @returns {Promise<Object>} Updated user profile
   */
  async updateUserProfile(userId, updateData) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    // Build update object for Mongoose
    const updateObject = {};
    
    // Handle simple fields
    Object.keys(updateData).forEach(key => {
      if (key === 'preferences' || key === 'profile') {
        // Handle nested objects
        if (updateData[key] && typeof updateData[key] === 'object') {
          Object.keys(updateData[key]).forEach(nestedKey => {
            updateObject[`${key}.${nestedKey}`] = updateData[key][nestedKey];
          });
        }
      } else {
        updateObject[key] = updateData[key];
      }
    });

    // Add updatedAt timestamp
    updateObject.updatedAt = new Date();

    // Use findByIdAndUpdate to avoid validation issues with required fields
    const updatedUser = await User.findByIdAndUpdate(
      userId, 
      updateObject, 
      { 
        new: true, 
        runValidators: true // Run validators but only on modified fields
      }
    );

    return updatedUser.toPublicJSON();
  }

  /**
   * Change user password
   * @param {string} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<void>}
   */
  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      throw new Error('INVALID_CURRENT_PASSWORD');
    }

    // Update password (will be hashed by pre-save hook)
    user.password = newPassword;
    user.updatedAt = new Date();
    await user.save();
  }

  /**
   * Delete user account
   * @param {string} userId - User ID
   * @param {string} password - User password for confirmation
   * @returns {Promise<void>}
   */
  async deleteAccount(userId, password) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new Error('INVALID_PASSWORD');
    }

    // Delete user account
    await User.findByIdAndDelete(userId);
  }

  /**
   * Google OAuth login
   * @param {string} tokenId - Google token ID
   * @returns {Promise<Object>} User and tokens
   */
  async googleLogin(tokenId) {
    // Mock Google token verification (replace with actual Google API call)
    const mockGoogleData = {
      email: 'google.user@gmail.com',
      firstName: 'Google',
      lastName: 'User',
      googleId: 'google_user_id_12345',
      picture: 'https://example.com/picture.jpg'
    };

    let user = await User.findByEmail(mockGoogleData.email);

    if (!user) {
      // Use findOneAndUpdate with upsert to handle race conditions
      try {
        user = await User.findOneAndUpdate(
          { email: mockGoogleData.email },
          {
            $setOnInsert: {
              email: mockGoogleData.email.toLowerCase().trim(),
              firstName: mockGoogleData.firstName,
              lastName: mockGoogleData.lastName,
              googleId: mockGoogleData.googleId,
              emailVerified: true,
              phoneVerified: false,
              twoFactorEnabled: false,
              preferences: {
                interests: [],
                constraints: []
              },
              profile: {
                languages: [],
                specialRequirements: []
              }
            },
            $set: {
              lastLogin: new Date()
            }
          },
          { 
            upsert: true, 
            new: true, 
            setDefaultsOnInsert: true 
          }
        );
      } catch (error) {
        // If still get duplicate key error, find the existing user
        if (error.code === 11000) {
          user = await User.findByEmail(mockGoogleData.email);
        } else {
          throw error;
        }
      }
    }
    
    // Update existing user data
    if (user && !user.googleId) {
      user.googleId = mockGoogleData.googleId;
    }
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const { accessToken, refreshToken } = this.generateTokens(user);

    return {
      user: user.toPublicJSON(),
      accessToken,
      refreshToken
    };
  }

  /**
   * Request OTP for email login
   * @param {string} email - User email
   * @returns {Promise<string>} Generated OTP code
   */
  async requestOTP(email) {
    const user = await User.findByEmail(email);
    if (!user) {
      throw new Error('EMAIL_NOT_REGISTERED');
    }

    // Generate OTP
    const otpCode = user.generateOTP();
    await user.save();

    return otpCode;
  }

  /**
   * Login with OTP
   * @param {string} email - User email
   * @param {string} otp - OTP code
   * @returns {Promise<Object>} User and tokens
   */
  async otpLogin(email, otp) {
    const user = await User.findByEmail(email);
    if (!user) {
      throw new Error('EMAIL_NOT_REGISTERED');
    }

    // Validate OTP
    if (!user.validateOTP(otp)) {
      throw new Error('INVALID_OR_EXPIRED_OTP');
    }

    // Clear OTP and update last login
    user.clearOTP();
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const { accessToken, refreshToken } = this.generateTokens(user);

    return {
      user: user.toPublicJSON(),
      accessToken,
      refreshToken
    };
  }

  /**
   * Send email verification
   * @param {string} userId - User ID
   * @param {string} email - Email to verify
   * @returns {Promise<string>} Verification token
   */
  async sendEmailVerification(userId, email) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    if (user.emailVerified) {
      throw new Error('EMAIL_ALREADY_VERIFIED');
    }

    // Generate verification token
    const verificationToken = user.generateEmailVerificationToken();
    await user.save();

    return verificationToken;
  }

  /**
   * Verify email with token
   * @param {string} token - Verification token
   * @returns {Promise<void>}
   */
  async verifyEmail(token) {
    try {
      // Verify token
      const decoded = jwt.verify(token, config.jwt.accessTokenSecret);
      
      const user = await User.findById(decoded.userId);
      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      if (user.emailVerified) {
        throw new Error('EMAIL_ALREADY_VERIFIED');
      }

      // Verify stored token matches
      if (!user.validateEmailVerificationToken(token)) {
        throw new Error('INVALID_OR_EXPIRED_TOKEN');
      }

      // Mark email as verified
      user.emailVerified = true;
      user.clearEmailVerificationToken();
      user.updatedAt = new Date();
      await user.save();
    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        throw new Error('INVALID_OR_EXPIRED_TOKEN');
      }
      throw error;
    }
  }

  /**
   * Send phone verification
   * @param {string} userId - User ID
   * @param {string} phoneNumber - Phone number to verify
   * @returns {Promise<string>} Verification code
   */
  async sendPhoneVerification(userId, phoneNumber) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    if (user.phoneVerified) {
      throw new Error('PHONE_ALREADY_VERIFIED');
    }

    // Update phone number and generate verification code
    user.phoneNumber = phoneNumber;
    const verificationCode = user.generatePhoneVerificationCode();
    await user.save();

    return verificationCode;
  }

  /**
   * Verify phone with code
   * @param {string} userId - User ID
   * @param {string} phoneNumber - Phone number
   * @param {string} code - Verification code
   * @returns {Promise<void>}
   */
  async verifyPhone(userId, phoneNumber, code) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    if (user.phoneVerified) {
      throw new Error('PHONE_ALREADY_VERIFIED');
    }

    if (user.phoneNumber !== phoneNumber) {
      throw new Error('PHONE_NUMBER_MISMATCH');
    }

    // Validate verification code
    if (!user.validatePhoneVerificationCode(code)) {
      throw new Error('INVALID_OR_EXPIRED_CODE');
    }

    // Mark phone as verified
    user.phoneVerified = true;
    user.clearPhoneVerificationCode();
    user.updatedAt = new Date();
    await user.save();
  }

  /**
   * Enable 2FA
   * @param {string} userId - User ID
   * @param {string} method - 2FA method
   * @returns {Promise<Object>} 2FA setup data
   */
  async enable2FA(userId, method) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    if (user.twoFactorEnabled) {
      throw new Error('TWO_FACTOR_ALREADY_ENABLED');
    }

    // Enable 2FA
    user.enable2FA(method);
    await user.save();

    const response = { method };

    // If authenticator method, include QR code data
    if (method === 'authenticator') {
      const qrData = user.get2FAQRData();
      if (qrData) {
        response.qrCode = qrData.qrCode;
        response.secret = qrData.secret;
      }
    }

    return response;
  }

  /**
   * Disable 2FA
   * @param {string} userId - User ID
   * @param {string} password - User password (skip for Google users)
   * @returns {Promise<void>}
   */
  async disable2FA(userId, password) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    if (!user.twoFactorEnabled) {
      throw new Error('TWO_FACTOR_NOT_ENABLED');
    }

    // Verify password (skip for Google users who don't have passwords)
    if (!user.googleId && password) {
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        throw new Error('INVALID_PASSWORD');
      }
    }

    // Disable 2FA
    user.disable2FA();
    await user.save();
  }

  /**
   * Request account recovery
   * @param {string} email - User email
   * @param {Object} metadata - Request metadata
   * @returns {Promise<string>} Recovery token
   */
  async requestRecovery(email, metadata = {}) {
    const user = await User.findByEmail(email);
    if (!user) {
      throw new Error('EMAIL_NOT_REGISTERED');
    }

    // Invalidate any existing recovery tokens for this email
    await AccountRecovery.invalidateAllForEmail(email, 'password_reset');

    // Generate recovery token with 1 hour expiration
    const recoveryToken = jwt.sign(
      { userId: user._id, email: user.email, type: 'password_reset' },
      config.jwt.accessTokenSecret,
      { expiresIn: '1h' }
    );

    // Set expiration time
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Store recovery token in database
    await AccountRecovery.createRecovery(
      user._id,
      email,
      recoveryToken,
      expiresAt,
      'password_reset',
      metadata
    );

    return recoveryToken;
  }

  /**
   * Reset password with recovery token
   * @param {string} token - Recovery token
   * @param {string} newPassword - New password
   * @returns {Promise<void>}
   */
  async resetPassword(token, newPassword) {
    try {
      // Verify the recovery token
      const decoded = jwt.verify(token, config.jwt.accessTokenSecret);
      
      // Check if token is for password reset
      if (decoded.type !== 'password_reset') {
        throw new Error('INVALID_RECOVERY_TOKEN');
      }

      // Find and validate the recovery token in database
      const recoveryRecord = await AccountRecovery.findValidRecovery(token, 'password_reset');
      if (!recoveryRecord) {
        throw new Error('INVALID_OR_EXPIRED_TOKEN');
      }

      // Find user by ID
      const user = await User.findById(decoded.userId);
      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      // Update user password (will be hashed by pre-save hook)
      user.password = newPassword;
      user.updatedAt = new Date();
      await user.save();

      // Mark recovery token as used
      await recoveryRecord.markAsUsed();

      // Invalidate all other recovery tokens for this user
      await AccountRecovery.invalidateAllForUser(user._id, 'password_reset');
    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        throw new Error('INVALID_OR_EXPIRED_TOKEN');
      }
      throw error;
    }
  }
}

module.exports = new UserService();