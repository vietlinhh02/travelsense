const rateLimit = require('express-rate-limit');

// Rate limiters for different endpoints
const createRateLimiter = (windowMs, max, message, skipInTest = true) => {
  return rateLimit({
    windowMs,
    max: process.env.NODE_ENV === 'test' && skipInTest ? 1000 : max,
    message: { message },
    standardHeaders: true,
    legacyHeaders: false
  });
};

// Authentication rate limiters
const registerLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  3, // 3 registration attempts per 15 minutes
  'Too many registration attempts, please try again later'
);

const loginLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // 5 login attempts per 15 minutes
  'Too many login attempts, please try again later'
);

// OTP rate limiters
const otpRequestLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // 5 OTP requests per 15 minutes
  'Too many OTP requests, please try again later'
);

const otpLoginLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  15, // 15 OTP login attempts per 15 minutes
  'Too many OTP login attempts, please try again later'
);

// Verification rate limiters
const emailVerificationLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // 5 email verification requests per 15 minutes
  'Too many email verification requests, please try again later'
);

const phoneVerificationLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // 5 phone verification requests per 15 minutes
  'Too many phone verification requests, please try again later'
);

// 2FA rate limiters
const twoFactorLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  10, // 10 2FA requests per 15 minutes
  'Too many 2FA requests, please try again later'
);

// Recovery rate limiters
const recoveryRequestLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  3, // 3 recovery requests per 15 minutes
  'Too many recovery requests, please try again later'
);

const resetPasswordLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // 5 password reset attempts per 15 minutes
  'Too many password reset attempts, please try again later'
);

module.exports = {
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