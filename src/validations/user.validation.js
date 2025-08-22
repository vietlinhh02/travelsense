const { body, header } = require('express-validator');
const jwt = require('jsonwebtoken');
const config = require('../config/config');

// Helper function to validate name format (letters, spaces, hyphens, apostrophes)
const nameRegex = /^[a-zA-Z\s\-']+$/;

// Password validation regex
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;

// User registration validation
const registerValidation = [
  body('email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email format')
    .isLength({ max: 254 }).withMessage('Email must not exceed 254 characters')
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8, max: 128 }).withMessage('Password must be between 8 and 128 characters')
    .matches(passwordRegex).withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  
  body('firstName')
    .notEmpty().withMessage('First name is required')
    .isLength({ min: 1, max: 50 }).withMessage('First name must be between 1 and 50 characters')
    .matches(nameRegex).withMessage('First name must contain only letters, spaces, hyphens, and apostrophes')
    .trim(),
  
  body('lastName')
    .notEmpty().withMessage('Last name is required')
    .isLength({ min: 1, max: 50 }).withMessage('Last name must be between 1 and 50 characters')
    .matches(nameRegex).withMessage('Last name must contain only letters, spaces, hyphens, and apostrophes')
    .trim()
];

// User login validation
const loginValidation = [
  body('email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email format')
    .isLength({ max: 254 }).withMessage('Email must not exceed 254 characters')
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8, max: 128 }).withMessage('Password must be between 8 and 128 characters')
];

// Update profile validation
const updateProfileValidation = [
  body('firstName')
    .optional()
    .isLength({ min: 1, max: 50 }).withMessage('First name must be between 1 and 50 characters')
    .matches(nameRegex).withMessage('First name must contain only letters, spaces, hyphens, and apostrophes')
    .trim(),
  
  body('lastName')
    .optional()
    .isLength({ min: 1, max: 50 }).withMessage('Last name must be between 1 and 50 characters')
    .matches(nameRegex).withMessage('Last name must contain only letters, spaces, hyphens, and apostrophes')
    .trim(),
  
  body('preferences.interests')
    .optional()
    .isArray().withMessage('Interests must be an array')
    .custom((interests) => {
      if (interests.length > 20) {
        throw new Error('Maximum of 20 interests allowed');
      }
      for (const interest of interests) {
        if (typeof interest !== 'string' || interest.length > 50) {
          throw new Error('Each interest must be a string with maximum 50 characters');
        }
      }
      return true;
    }),
  
  body('preferences.constraints')
    .optional()
    .isArray().withMessage('Constraints must be an array')
    .custom((constraints) => {
      if (constraints.length > 10) {
        throw new Error('Maximum of 10 constraints allowed');
      }
      for (const constraint of constraints) {
        if (typeof constraint !== 'string' || constraint.length > 100) {
          throw new Error('Each constraint must be a string with maximum 100 characters');
        }
      }
      return true;
    }),
  
  body('preferences.travelStyle')
    .optional()
    .isIn(['budget', 'luxury', 'adventure', 'cultural', 'family', 'business'])
    .withMessage('Travel style must be one of: budget, luxury, adventure, cultural, family, business'),
  
  body('preferences.budgetRange')
    .optional()
    .isIn(['low', 'medium', 'high', 'luxury'])
    .withMessage('Budget range must be one of: low, medium, high, luxury'),
  
  body('profile.dateOfBirth')
    .optional()
    .isISO8601().withMessage('Date of birth must be a valid ISO 8601 date')
    .custom((value) => {
      const date = new Date(value);
      if (date >= new Date()) {
        throw new Error('Date of birth must be in the past');
      }
      return true;
    }),
  
  body('profile.nationality')
    .optional()
    .isLength({ max: 50 }).withMessage('Nationality must not exceed 50 characters')
    .trim(),
  
  body('profile.languages')
    .optional()
    .isArray().withMessage('Languages must be an array')
    .custom((languages) => {
      if (languages.length > 10) {
        throw new Error('Maximum of 10 languages allowed');
      }
      for (const language of languages) {
        if (typeof language !== 'string' || language.length > 30) {
          throw new Error('Each language must be a string with maximum 30 characters');
        }
      }
      return true;
    }),
  
  body('profile.specialRequirements')
    .optional()
    .isArray().withMessage('Special requirements must be an array')
    .custom((requirements) => {
      if (requirements.length > 5) {
        throw new Error('Maximum of 5 special requirements allowed');
      }
      for (const requirement of requirements) {
        if (typeof requirement !== 'string' || requirement.length > 100) {
          throw new Error('Each special requirement must be a string with maximum 100 characters');
        }
      }
      return true;
    })
];

// Change password validation
const changePasswordValidation = [
  body('currentPassword')
    .notEmpty().withMessage('Current password is required')
    .isLength({ min: 8, max: 128 }).withMessage('Current password must be between 8 and 128 characters'),
  
  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 8, max: 128 }).withMessage('New password must be between 8 and 128 characters')
    .matches(passwordRegex).withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error('New password must be different from current password');
      }
      return true;
    })
];

// Delete account validation
const deleteAccountValidation = [
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8, max: 128 }).withMessage('Password must be between 8 and 128 characters')
];

// Google login validation
const googleLoginValidation = [
  body('tokenId')
    .notEmpty().withMessage('Google token ID is required')
    .isString().withMessage('Token ID must be a string')
    .isLength({ min: 10, max: 2048 }).withMessage('Invalid token ID format')
];

// Request OTP validation
const requestOTPValidation = [
  body('email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email format')
    .isLength({ max: 254 }).withMessage('Email must not exceed 254 characters')
    .normalizeEmail()
];

// OTP login validation
const otpLoginValidation = [
  body('email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email format')
    .isLength({ max: 254 }).withMessage('Email must not exceed 254 characters')
    .normalizeEmail(),
  
  body('otp')
    .notEmpty().withMessage('OTP is required')
    .isLength({ min: 6, max: 6 }).withMessage('OTP must be exactly 6 digits')
    .matches(/^\d{6}$/).withMessage('OTP must contain only digits')
];

// Send email verification validation
const sendEmailVerificationValidation = [
  body('email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email format')
    .isLength({ max: 254 }).withMessage('Email must not exceed 254 characters')
    .normalizeEmail()
];

// Verify email validation
const verifyEmailValidation = [
  body('token')
    .notEmpty().withMessage('Verification token is required')
    .isString().withMessage('Token must be a string')
    .isLength({ min: 10 }).withMessage('Invalid token format')
];

// Send phone verification validation
const sendPhoneVerificationValidation = [
  body('phoneNumber')
    .notEmpty().withMessage('Phone number is required')
    .isString().withMessage('Phone number must be a string')
    .isLength({ min: 10, max: 20 }).withMessage('Phone number must be between 10 and 20 characters')
    .matches(/^\+?[1-9]\d{1,14}$/).withMessage('Invalid phone number format')
    .trim()
];

// Verify phone validation
const verifyPhoneValidation = [
  body('phoneNumber')
    .notEmpty().withMessage('Phone number is required')
    .isString().withMessage('Phone number must be a string')
    .isLength({ min: 10, max: 20 }).withMessage('Phone number must be between 10 and 20 characters')
    .matches(/^\+?[1-9]\d{1,14}$/).withMessage('Invalid phone number format')
    .trim(),
  
  body('code')
    .notEmpty().withMessage('Verification code is required')
    .isLength({ min: 6, max: 6 }).withMessage('Verification code must be exactly 6 digits')
    .matches(/^\d{6}$/).withMessage('Verification code must contain only digits')
];

// Enable 2FA validation
const enable2FAValidation = [
  body('method')
    .notEmpty().withMessage('2FA method is required')
    .isString().withMessage('Method must be a string')
    .isIn(['sms', 'email', 'authenticator']).withMessage('Method must be one of: sms, email, authenticator')
];

// Disable 2FA validation
const disable2FAValidation = [
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8, max: 128 }).withMessage('Password must be between 8 and 128 characters')
];

// Request account recovery validation
const requestRecoveryValidation = [
  body('email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email format')
    .isLength({ max: 254 }).withMessage('Email must not exceed 254 characters')
    .normalizeEmail()
];

// Reset password validation
const resetPasswordValidation = [
  body('token')
    .notEmpty().withMessage('Recovery token is required')
    .isString().withMessage('Token must be a string')
    .isLength({ min: 10 }).withMessage('Invalid token format'),
  
  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 8, max: 128 }).withMessage('New password must be between 8 and 128 characters')
    .matches(passwordRegex).withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
];

// JWT Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ message: 'Access token required' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ message: 'Invalid token format' });
  }

  const token = parts[1];
  if (!token || token.length === 0) {
    return res.status(401).json({ message: 'Access token is required' });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.accessTokenSecret);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired access token' });
  }
};

module.exports = {
  registerValidation,
  loginValidation,
  updateProfileValidation,
  changePasswordValidation,
  deleteAccountValidation,
  googleLoginValidation,
  requestOTPValidation,
  otpLoginValidation,
  sendEmailVerificationValidation,
  verifyEmailValidation,
  sendPhoneVerificationValidation,
  verifyPhoneValidation,
  enable2FAValidation,
  disable2FAValidation,
  requestRecoveryValidation,
  resetPasswordValidation,
  authenticateToken
};